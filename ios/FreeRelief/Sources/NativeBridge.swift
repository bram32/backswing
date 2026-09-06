import OSLog
import UIKit
import WebKit

/// The one place the bundled web app can reach iOS from.
///
/// The page posts a JSON object to `window.webkit.messageHandlers.native`; every message has an
/// `action` and the rest of the keys depend on it. The shapes are documented in ios/README.md and
/// mirrored by the `window.FreeRelief` convenience shim injected below, so the web app can call
/// `FreeRelief.haptic('light')` and get a silent no-op in a plain browser.
///
/// Deliberately narrow: no message can read a file, reach the network, or return data about the
/// device. Everything here is a one-way request to do something the user just asked for.
final class NativeBridge: NSObject, WKScriptMessageHandler {
    static let name = "native"
    static let log = Logger(subsystem: "com.brampek.backswing", category: "bridge")

    /// Injected only when the app is launched with `-bridgeSelfTest 1`. Exercises the round trip
    /// from page to Swift so an unattended run can prove the bridge is wired, without a tap:
    ///
    ///     xcrun simctl launch --console booted com.brampek.backswing -bridgeSelfTest 1
    ///
    /// Look for "native bridge: haptic" / "keepAwake" / "share" in the output.
    static let selfTest = """
    (function () {
      var ok = window.FreeRelief && window.FreeRelief.isNative;
      console.log('bridge self-test: shim ' + (ok ? 'present' : 'MISSING'));
      if (!ok) return;
      window.FreeRelief.haptic('selection');
      window.FreeRelief.keepAwake(true);
      window.FreeRelief.share({ title: 'Free Relief', text: 'bridge self-test', url: 'https://backswing-dkg.pages.dev' });
      window.webkit.messageHandlers.native.postMessage({ action: 'keepAwake', on: false });
    })();
    """

    /// Weak: WKUserContentController retains its handlers, and the handler must not keep the
    /// web view (and therefore the whole view hierarchy) alive in turn.
    weak var webView: WKWebView?

    // Feedback generators are kept alive between calls so `prepare()` actually buys anything -
    // a generator created and released per tap warms the Taptic Engine up and then throws the
    // warm-up away, which is exactly the latency it exists to avoid.
    private var impactGenerators: [String: UIImpactFeedbackGenerator] = [:]
    private lazy var selectionGenerator = UISelectionFeedbackGenerator()
    private lazy var notificationGenerator = UINotificationFeedbackGenerator()

    /// JavaScript injected at document start, before any app script runs.
    ///
    /// Two jobs: mark the document as running inside the native app so CSS and JS can adapt
    /// (`<html data-native="ios">`), and expose a small, forgiving wrapper. The wrapper swallows
    /// every error, so a web build that calls `FreeRelief.haptic()` in a desktop browser does
    /// nothing instead of throwing.
    static let shim = """
    (function () {
      var post = function (msg) {
        try { window.webkit.messageHandlers.native.postMessage(msg); return true; } catch (e) { return false; }
      };
      var api = {
        isNative: true,
        platform: 'ios',
        haptic: function (style) { return post({ action: 'haptic', style: style || 'light' }); },
        share: function (opts) {
          opts = opts || {};
          if (typeof opts === 'string') opts = { text: opts };
          return post({ action: 'share', title: opts.title, text: opts.text, url: opts.url });
        },
        keepAwake: function (on) { return post({ action: 'keepAwake', on: on !== false }); },
        openURL: function (url) { return post({ action: 'openURL', url: url }); }
      };
      window.FreeRelief = Object.assign(window.FreeRelief || {}, api);
      try { document.documentElement.setAttribute('data-native', 'ios'); } catch (e) {}
    })();
    """

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only the bundled app may talk to the bridge. A message from any other origin is dropped:
        // if a future build ever loads remote content, this stays closed by default.
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == LocalSchemeHandler.scheme else { return }

        let body: [String: Any]
        if let dict = message.body as? [String: Any] {
            body = dict
        } else if let action = message.body as? String {
            body = ["action": action]
        } else {
            return
        }
        guard let action = body["action"] as? String else { return }
        Self.log.debug("native bridge: \(action, privacy: .public)")

        switch action {
        case "haptic":
            haptic(style: (body["style"] as? String) ?? "light")
        case "share":
            share(title: body["title"] as? String, text: body["text"] as? String, urlString: body["url"] as? String)
        case "keepAwake":
            // A routine is a timer the user watches from across the mat; letting the screen lock
            // halfway through a 6-minute cool-down is the one thing that makes it unusable.
            UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? true
        case "openURL":
            if let s = body["url"] as? String, let url = URL(string: s),
               url.scheme == "https" || url.scheme == "http" || url.scheme == "mailto" {
                UIApplication.shared.open(url)
            }
        default:
            break
        }
    }

    // MARK: - Haptics

    private func haptic(style: String) {
        switch style {
        case "selection":
            selectionGenerator.selectionChanged()
            selectionGenerator.prepare()
        case "success", "warning", "error":
            let type: UINotificationFeedbackGenerator.FeedbackType =
                style == "success" ? .success : (style == "warning" ? .warning : .error)
            notificationGenerator.notificationOccurred(type)
            notificationGenerator.prepare()
        default:
            let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
            switch style {
            case "medium": feedbackStyle = .medium
            case "heavy": feedbackStyle = .heavy
            case "soft": feedbackStyle = .soft
            case "rigid": feedbackStyle = .rigid
            default: feedbackStyle = .light
            }
            let generator = impactGenerators[style] ?? {
                let g = UIImpactFeedbackGenerator(style: feedbackStyle)
                impactGenerators[style] = g
                return g
            }()
            generator.impactOccurred()
            generator.prepare()
        }
    }

    // MARK: - Share sheet

    private func share(title: String?, text: String?, urlString: String?) {
        var items: [Any] = []
        if let text, !text.isEmpty { items.append(text) }
        if let urlString, let url = URL(string: urlString) { items.append(url) }
        guard !items.isEmpty, let presenter = NativeBridge.topViewController() else { return }

        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let title { sheet.setValue(title, forKey: "subject") }
        // iPad has no modal share sheet: without an anchor UIKit throws at presentation time.
        if let pop = sheet.popoverPresentationController {
            let host = presenter.view ?? UIView()
            pop.sourceView = host
            pop.sourceRect = CGRect(x: host.bounds.midX, y: host.bounds.maxY - 60, width: 1, height: 1)
            pop.permittedArrowDirections = [.down]
        }
        presenter.present(sheet, animated: true)
    }

    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
            ?? scene?.windows.first?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

/// Routes `freerelief://app/index.html#lab` style deep links (and the same URLs opened by
/// `xcrun simctl openurl`) into the already-loaded page, without a full reload.
final class DeepLinkRouter {
    static let shared = DeepLinkRouter()
    weak var webView: WKWebView?
    /// A link that arrived before the web view existed, replayed once it does.
    private var pending: URL?

    func attach(_ webView: WKWebView) {
        self.webView = webView
        if let pending {
            self.pending = nil
            open(pending)
        }
    }

    func open(_ url: URL) {
        guard url.scheme == LocalSchemeHandler.scheme else { return }
        guard let webView, webView.url != nil else {
            pending = url
            return
        }
        // A fragment-only change is a route change in this app, so drive it through location.hash:
        // reloading the document would throw away the 3D scene and the user's place in a routine.
        let fragment = url.fragment(percentEncoded: true) ?? ""
        let path = url.path
        if !fragment.isEmpty, path.isEmpty || path == "/" || path == "/index.html" {
            guard let literal = jsStringLiteral("#" + fragment) else { return }
            webView.evaluateJavaScript("location.hash = \(literal);", completionHandler: nil)
        } else {
            webView.load(URLRequest(url: url))
        }
    }

    private func jsStringLiteral(_ value: String) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: [value]),
              let json = String(data: data, encoding: .utf8) else { return nil }
        return String(json.dropFirst().dropLast())  // ["..."] -> "..."
    }
}
