import SwiftUI
import WebKit

/// Serves the bundled web app from a custom scheme so the page has a stable origin
/// (localStorage persists between launches, unlike file:// pages).
final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "freerelief"
    private let root: URL = Bundle.main.url(forResource: "web", withExtension: nil)!

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }

        // Resolve inside the bundled web root and refuse anything that climbs out of it. Nothing
        // in the app builds a URL from user input today, but a scheme handler that will happily
        // read ../../Documents on request is the kind of thing that only stays harmless by luck.
        let base = root.standardizedFileURL
        let fileURL = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard fileURL.path == base.path || fileURL.path.hasPrefix(base.path + "/"),
              let data = FileManager.default.contents(atPath: fileURL.path) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish()
            return
        }
        let headers = ["Content-Type": Self.mime(for: fileURL.pathExtension), "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "ico": return "image/x-icon"
        case "json": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "txt", "md": return "text/plain; charset=utf-8"
        // The spine geometry ships pre-gzipped and is inflated in JS with DecompressionStream, so
        // it must arrive as opaque bytes: label it application/gzip, never Content-Encoding: gzip,
        // or WebKit would inflate it first and the loader would see already-decoded data.
        case "gz": return "application/gzip"
        default: return "application/octet-stream"
        }
    }
}

struct WebScreen: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalSchemeHandler(), forURLScheme: LocalSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Native bridge: window.webkit.messageHandlers.native, plus the window.FreeRelief shim.
        let controller = WKUserContentController()
        controller.add(context.coordinator.bridge, name: NativeBridge.name)
        controller.addUserScript(WKUserScript(source: NativeBridge.shim,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
        if UserDefaults.standard.bool(forKey: "bridgeSelfTest") {
            controller.addUserScript(WKUserScript(source: NativeBridge.selfTest,
                                                  injectionTime: .atDocumentEnd,
                                                  forMainFrameOnly: true))
        }
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "LaunchBackground")
        webView.scrollView.backgroundColor = UIColor(named: "LaunchBackground")
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.bridge.webView = webView
        DeepLinkRouter.shared.attach(webView)
        webView.load(URLRequest(url: Self.startURL()))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }

    /// The page to open on launch. Normally the app's own entry point; a `-route <hash>` launch
    /// argument opens straight into one screen instead:
    ///
    ///     xcrun simctl launch booted com.brampek.backswing -route "fix?plan=lowback,after,stiff"
    ///
    /// This exists because `simctl openurl` puts an "Open in Free Relief?" system prompt in front
    /// of every deep link, which no unattended screenshot run can dismiss. Launch arguments come
    /// from whoever started the process, so this grants nothing a user could not already reach by
    /// tapping - it only skips the taps.
    static func startURL() -> URL {
        let base = "\(LocalSchemeHandler.scheme)://app/index.html"
        let fallback = URL(string: base)!
        // UserDefaults reads "-key value" launch arguments into its volatile argument domain.
        guard var route = UserDefaults.standard.string(forKey: "route"), !route.isEmpty else { return fallback }
        // A bare value is a route hash; a value starting with ? or # is taken verbatim, so the
        // app's own query-string hooks work too: -route "?seed=1#lab".
        if !route.hasPrefix("#") && !route.hasPrefix("?") { route = "#" + route }
        if let url = URL(string: base + route) { return url }
        if let escaped = route.addingPercentEncoding(withAllowedCharacters: .urlFragmentAllowed),
           let url = URL(string: base + escaped) { return url }
        return fallback
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let bridge = NativeBridge()

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url, url.scheme != LocalSchemeHandler.scheme, navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // target="_blank" links have no frame to load into and would otherwise do nothing at all.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, url.scheme == "http" || url.scheme == "https" || url.scheme == "mailto" {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
