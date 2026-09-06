# Free Relief — iOS wrapper

A thin SwiftUI shell around the web app. The web app is built by `../build.js` into `dist/site`,
copied into `FreeRelief/web` by `./sync-web.sh`, and served inside a `WKWebView` by a custom
`WKURLSchemeHandler` on the `freerelief://` scheme.

Everything ships in the bundle — three.js, the fonts, the anatomy geometry — so **the app makes no
network requests at all** and works with the device in airplane mode. That is a deliberate
property, not a coincidence: the privacy policy promises it and App Review is told it.

```
./sync-web.sh                 # node ../build.js, then copy dist/site -> FreeRelief/web
xcodegen generate             # regenerate FreeRelief.xcodeproj from project.yml
fastlane generate             # both of the above
fastlane beta                 # archive + upload to TestFlight
```

Never edit `FreeRelief.xcodeproj` or `FreeRelief/Info.plist` by hand — both are generated from
`project.yml`, and edits are silently discarded on the next `xcodegen generate`.

## Why a custom scheme and not `file://`

A `file://` page gets an opaque origin, so `localStorage` is thrown away between launches — the
streak, the log and the plan would all vanish. Serving the same bytes from `freerelief://app/`
gives the page a stable origin, so storage persists exactly as it does on the website.

`LocalSchemeHandler` resolves every request inside the bundled `web` directory and refuses any
path that escapes it.

## The native bridge

`NativeBridge` is registered as a `WKScriptMessageHandler` under the name `native`, so the page can
call `window.webkit.messageHandlers.native.postMessage({...})`. A convenience shim is injected at
document start, so the web app can use `window.FreeRelief.*` and get a **silent no-op in a plain
browser** rather than a thrown `TypeError`:

```js
if (window.FreeRelief && window.FreeRelief.isNative) { /* running inside the iOS app */ }
```

The shim also sets `<html data-native="ios">`, so CSS and JS can adapt without sniffing the user
agent.

### Message shapes

| Call | Raw message | What iOS does |
| --- | --- | --- |
| `FreeRelief.haptic(style)` | `{action:"haptic", style:"light"}` | `UIImpactFeedbackGenerator` / `UISelectionFeedbackGenerator` / `UINotificationFeedbackGenerator` |
| `FreeRelief.share(opts)` | `{action:"share", title, text, url}` | `UIActivityViewController` (the system share sheet) |
| `FreeRelief.keepAwake(on)` | `{action:"keepAwake", on:true}` | `UIApplication.shared.isIdleTimerDisabled` |
| `FreeRelief.openURL(url)` | `{action:"openURL", url}` | Opens `http`, `https` or `mailto` in the system browser |

**`haptic` styles:** `light` (default), `medium`, `heavy`, `soft`, `rigid` — impact;
`selection` — the light tick for moving between options; `success`, `warning`, `error` —
notification feedback. Anything unrecognised falls back to `light`.

Suggested use: `selection` when a routine advances to the next exercise, `success` when one
finishes, `light` on a segmented-control change. Haptics are silent on a device with the Taptic
Engine disabled and on iPad — never make one load-bearing.

**`share`:** `text` and `url` are both optional but at least one must be present, or nothing is
presented. `title` becomes the mail subject. On iPad the sheet is anchored to the bottom centre of
the presenting view.

**`keepAwake`:** switch it on when a timed routine starts and **off again when it ends or is
abandoned** — it is a global flag, and leaving it on drains the battery until the app is killed.

Every message is dropped unless it comes from the main frame of a `freerelief://` page, so the
bridge stays closed if remote content is ever loaded.

### Not wired up yet

The bridge is present and tested but the web app does not call it yet: the "Share" button on Home
still uses the Web Share API, and the routine player does not request `keepAwake`. Wiring those two
is the cheapest remaining win — see `../docs/app-review-checklist.md`, guideline 4.2.

## Deep links

`freerelief://` is registered in `CFBundleURLTypes`, so the same URL shape works inside and outside
the web view:

```sh
xcrun simctl openurl booted "freerelief://app/index.html#lab"
```

`DeepLinkRouter` drives a fragment-only change through `location.hash` rather than reloading, so
the 3D scene and the user's place in a routine survive. A link that arrives before the web view
exists is held and replayed once it does.

Note: iOS puts an **"Open in Free Relief?" system alert** in front of every cross-app URL open, so
`simctl openurl` cannot be used unattended. Use the launch argument below instead.

## Testing hooks

```sh
# open straight into a route (bare value = a hash; a leading ? or # is taken verbatim)
xcrun simctl launch booted com.brampek.backswing -route lab
xcrun simctl launch booted com.brampek.backswing -route "?seed=1#fix"

# prove the native bridge round-trips, with no taps: look for "native bridge: <action>" lines
xcrun simctl launch --console booted com.brampek.backswing -bridgeSelfTest 1
xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.brampek.backswing"'
```

`-route` and `-bridgeSelfTest` are read from `UserDefaults`' volatile argument domain. They grant
nothing a user could not reach by tapping; they only skip the taps. `?seed=1` is the **web app's**
own hook — it fills the store with a plausible month of demo data and marks onboarding complete,
which is what makes unattended screenshots possible.

### Running it end to end

```sh
cd ios && ./sync-web.sh && xcodegen generate
UD=$(xcrun simctl list devices available | grep -m1 'iPhone 17 Pro Max' | grep -oE '[0-9A-F-]{36}')
xcodebuild -project FreeRelief.xcodeproj -scheme FreeRelief -configuration Debug \
  -destination "id=$UD" -derivedDataPath build/sim build
xcrun simctl boot "$UD"; xcrun simctl bootstatus "$UD" -b
xcrun simctl install "$UD" build/sim/Build/Products/Debug-iphonesimulator/FreeRelief.app
xcrun simctl launch "$UD" com.brampek.backswing -route "?seed=1#lab"
xcrun simctl io "$UD" screenshot ../docs/simulator/lab.png
```

Use `-destination "id=$UD"`, not `-destination 'name=...'`: several installed simulators have a
suffix in their name (`iPhone 17 Pro Max (AppStore)`) and the name match fails against the plain
name. Screenshots from a verified run are in `../docs/simulator/`.

## Configuration that App Review cares about

Set in `project.yml` (which generates `Info.plist`):

- `ITSAppUsesNonExemptEncryption: false` — the app uses no encryption beyond the OS's own, so no
  export-compliance documentation is needed and TestFlight/App Store uploads never stop to ask.
- `UIRequiresFullScreen: false` — required for iPad multitasking; `TARGETED_DEVICE_FAMILY "1,2"`
  means this is a universal app and Apple reviews it on iPad too.
- Orientations: all but upside-down on iPhone, all four on iPad.
- `UILaunchScreen` / `UIColorName: LaunchBackground` — a plain colour launch screen that matches
  the app background (`#0e261b` dark, `#edf2ec` light), so launch does not flash white.
- No usage-description keys: the app uses no camera, microphone, photos, location, contacts,
  motion or HealthKit, so it asks for no permissions at all and shows no permission prompts.

The bundle id stays `com.brampek.backswing` even though the app is now called Free Relief: the App
Store Connect record and the existing TestFlight testers are tied to it, and the API cannot create
a replacement record.

## Layout and the safe area

`WebScreen` is `.ignoresSafeArea()` with `contentInsetAdjustmentBehavior = .never`, and
`index.html` sets `viewport-fit=cover`. That combination is what makes `env(safe-area-inset-*)`
report real values in the page, which the CSS uses to keep the bottom bar clear of the home
indicator and the headers clear of the Dynamic Island. Change any one of the three and the bottom
bar starts sitting under the home indicator.
