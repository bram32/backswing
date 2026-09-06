import SwiftUI

@main
struct FreeReliefApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
                // freerelief://app/index.html#lab — used by Home Screen shortcuts, by anything
                // that links into a specific routine, and by `xcrun simctl openurl` in testing.
                .onOpenURL { url in DeepLinkRouter.shared.open(url) }
        }
    }
}
