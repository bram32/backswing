import SwiftUI

@main
struct FreeReliefApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
        }
    }
}
