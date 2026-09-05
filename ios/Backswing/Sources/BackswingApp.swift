import SwiftUI

@main
struct BackswingApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
        }
    }
}
