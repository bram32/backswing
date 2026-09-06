# Free Relief — App Review risk memo

Written 6 September 2026, against the working tree at marketing version 1.0.0, bundle
`com.brampek.backswing` (builds 1-6 are on TestFlight; the next upload will be 7). Verified by
building, installing and running the app in the iOS 26 Simulator on iPhone 17 Pro Max and iPad Air
13-inch — screenshots of that run are in `docs/simulator/`.

Free Relief is a web app in a `WKWebView`. That single fact drives most of the review risk, so it
is worth being honest about the shape of the exposure before the detail:

| Risk | Guideline | Where we stand |
| --- | --- | --- |
| Web wrapper with too little native value | 4.2 | **Highest risk.** Mitigated, not eliminated |
| Health content that could cause harm | 1.4.1 | Low, if the wording stays disciplined |
| Privacy answers not matching reality | 5.1.1 | Low — but the questionnaire is not filled in yet |
| Placeholder content reaching review | 2.1 | **Two live placeholders**, both must go |
| Privacy policy URL does not resolve to a policy | 5.1.1 / 2.1 | **Broken today.** One deploy fixes it |
| Export compliance | 2.1 / 5.1 | Declared, nothing to do |
| CC BY attribution | 5.2 | Satisfied and enforced by the build |

## Top three, in order

1. **Guideline 4.2 — minimum functionality.** A wrapped website is the single most common rejection
   for an app shaped like this one, and it is the one thing here that cannot be fixed by editing a
   field. Section below.
2. **Guideline 2.1 / 5.1.1 — placeholders and a dead privacy URL.** Three concrete defects, all
   currently live: the App Review contact phone is the fake `+31 6 12345678`; `terms.html` still
   says `[COUNTRY]` twice; and `backswing-dkg.pages.dev/privacy.html` does not serve a privacy
   policy at all — the host's catch-all returns the app for every path. Each is minutes of work
   and each is an automatic rejection. Reviewers do open the linked pages.
3. **Guideline 1.4.1 — physical harm.** Health content that reads as diagnosis or treatment invites
   scrutiny the app does not need. The in-app copy is currently well judged; the App Store
   description is the place where an over-claim is most likely to slip in.

---

## 4.2 Minimum functionality

> "Your app should include features, content, and UI that elevate it beyond a repackaged website."

This is the guideline the app is most likely to be rejected under, because the wrapper is exactly
what 4.2 is aimed at. The defence is that Free Relief behaves like an app, not like a bookmark.

### Native integrations present today

| Integration | Where | Status |
| --- | --- | --- |
| Fully offline, no network at all | three.js, fonts, anatomy and all app code bundled | **Done.** Airplane mode is not a degraded mode; it is the normal mode |
| Persistent local storage | `freerelief://` custom scheme gives the page a stable origin, so `localStorage` survives launches | **Done** |
| Haptic feedback | `NativeBridge` — impact, selection and notification generators | **Bridge done, page does not call it yet** |
| System share sheet | `NativeBridge` — `UIActivityViewController` | **Bridge done, page still uses Web Share** |
| Idle-timer control | `NativeBridge` — screen stays awake through a timed routine | **Bridge done, player does not call it yet** |
| Deep links | `freerelief://app/index.html#lab` registered in `CFBundleURLTypes`, routed without a reload | **Done** |
| Safe-area layout | `viewport-fit=cover` + `ignoresSafeArea` + `contentInsetAdjustmentBehavior = .never` | **Done** — verified around the Dynamic Island and home indicator |
| Universal app | Real iPad layout with a sidebar rail, not a stretched phone screen | **Done** — verified on iPad Air 13-inch |
| Launch screen | Colour launch screen matching the app background, light and dark | **Done** |
| GPU rendering | WebGL on Metal, drawing a real 3D scene | **Done** |

The message shapes are documented in `ios/README.md`.

**The gap to close before submission:** three of those integrations are wired in Swift but never
called from the page, which means a reviewer cannot feel them. That is the difference between "the
app has native integrations" and "the app feels native". The cheapest wins, in order:

1. **Call `FreeRelief.share(...)` from the existing Share button on Home.** The button already
   exists and already produces a share card; routing it through the bridge when
   `window.FreeRelief.isNative` turns it into the real iOS share sheet. Perhaps ten lines.
2. **Call `FreeRelief.keepAwake(true/false)` around the routine player.** A guided routine whose
   screen locks halfway through is a genuine defect, so this is worth doing regardless of review.
3. **Call `FreeRelief.haptic('selection')` when the routine advances**, and `'success'` when it
   finishes. Small, but it is the thing a reviewer notices in the first thirty seconds.

Further native value, if 4.2 comes back as a rejection (roughly ascending cost):

- **Home Screen quick actions** (`UIApplicationShortcutItems`): "Warm me up", "Cool me down", "My
  back hurts". Pure Info.plist plus the deep-link router that already exists — nearly free.
- **A daily reminder** via `UNUserNotificationCenter`, opt-in, scheduled locally. Streaks are
  already in the app and a reminder is the obvious partner. Costs a permission prompt.
- **A widget** showing the streak and the next routine. Convincing evidence of "not a website",
  and the data it needs is already stored.
- **Live Activity / Dynamic Island for the routine timer.** Impossible on the web, and this app is
  full of timers.
- **HealthKit**: write a mindful-minutes or workout sample when a routine completes. Highest
  perceived value, but it adds a permission prompt, a usage-description string and a real privacy
  surface — note that this would change the App Privacy answers from "Data Not Collected".
- **App Intents / Siri**: "Hey Siri, start my warm-up".

If a 4.2 rejection does arrive, reply in Resolution Center with the concrete list above rather than
arguing. Point out that the app works with no network, stores everything on device, uses haptics,
the share sheet and the idle timer, renders a real-time 3D scene on the GPU, and has a purpose-built
iPad layout.

## 1.4.1 Physical harm

> "Medical apps that could provide inaccurate data or information … will receive additional
> scrutiny."

Free Relief is a **general wellness** app, not a medical one, and everything must keep reading that
way. The distinction Apple cares about is diagnosis and treatment versus general fitness
information.

What is already right:

- The in-app disclaimer says plainly that it is not medical advice, that the app cannot examine
  you, and that you should get assessed if unsure — and it now links to `privacy.html` and
  `terms.html`.
- `terms.html` carries an explicit red-flag list (cauda equina symptoms, weakness or numbness,
  trauma, fever with weight loss, night pain, chest pain) with "stop and seek care" framing.
- The "Fix it" planner is framed as questions producing suggestions, not a diagnosis.
- The app asks for no data that would make it look like a clinical record.

What to watch:

- **The App Store description and promotional text.** Never say the app treats, cures, heals, fixes
  or prevents pain or injury, and never promise "relief" as an outcome. "General fitness and
  wellness information for golfers" is the register. The app is *named* Free Relief, which is fine
  — a name is not a claim — but the copy around it must not turn the name into one.
- **Screenshot captions.** Same rule; six words is enough room to make a medical claim by accident.
- **Never name a condition as something the app addresses.** No disc herniation, no sciatica, no
  stenosis, no "SI joint dysfunction" as a thing the app fixes.
- The subtitle "Golf back care and swing lab" is safe: care, not treatment.
- The age rating declaration sets *medical or treatment information* to none. That is consistent
  with a general-wellness positioning — keep them consistent, because an inconsistency is an
  invitation to look harder.

## 5.1.1 Privacy

The app collects nothing. Everything that follows is about proving that claim to Apple's
satisfaction, not about changing behaviour.

- **Privacy policy URL:** `https://backswing-dkg.pages.dev/privacy.html`, set on the App Store
  Connect app info. It is a real, specific page: no accounts, no analytics, no server, on-device
  `localStorage` only, contact address, and explicit instructions for deleting the data (delete the
  app, or clear site data).
- **Support URL:** `https://backswing-dkg.pages.dev/privacy.html#contact`.
- **App Privacy questionnaire — NOT YET DONE, website only.** App Store Connect → the app → App
  Privacy → Get Started → answer **"No, we do not collect data from this app"** → Publish. This
  cannot be set through the API and **submission is blocked until it is answered.**
- **Privacy manifest:** `ios/FreeRelief/PrivacyInfo.xcprivacy` now ships at the bundle root. It
  declares no tracking, no collected data types, and the one required-reason API the app touches —
  `NSPrivacyAccessedAPICategoryUserDefaults`, reason `CA92.1`, used only to read the app's own
  `-route` launch argument. There are no third-party SDKs, so nothing else has to be merged.
- **No permission prompts at all:** no camera, microphone, photos, location, contacts, motion or
  HealthKit. That is a strong, checkable privacy story — adding HealthKit later would trade it away.
- The health-related text a user types (where it hurts) never leaves the device, and the privacy
  policy says so explicitly rather than leaving it to inference.

Keep these three consistent with each other: the App Privacy answers, `privacy.html`, and the App
Review notes. A reviewer who finds a contradiction between them will look at everything else too.

## 2.1 Completeness

**Two placeholders are live right now and both are rejection-grade:**

1. **App Review contact phone is `+31 6 12345678`.** Set in `appStoreReviewDetail` by
   `ios/fastlane/asc_metadata.rb`. It is entirely fake — Apple rejected the intended
   `+31 000000000` with "The phone number must be in a valid format", so the script walked a
   candidate list until one passed format validation. Format-valid is not real. Replace it with a
   number that will actually be answered: Apple calls it if review has questions.
2. **`terms.html` §14 governing law says `[COUNTRY — fill in …]` twice.** The disclaimer links to
   this page from inside the app, so a reviewer can reach it in two taps. Replace with the real
   country (and optionally city).

Also before submitting:

- All six navigation routes must render with no dead ends. Verified in the simulator: Home, Swing
  lab, Fix it, Routines all render populated; iPad additionally shows Programs, Tempo, Screen,
  Exercises, Prevent, Log and Evidence.
- The build number must be higher than 6 (builds 1–6 are already on TestFlight).
- Every screenshot must show the shipping UI, at exact pixel sizes, with no debug or seeded state
  that the app cannot actually produce. Note the screenshots use the `?seed=1` demo hook — that
  data is representative of a month of real use, which is legitimate, but nothing on screen should
  be impossible to reach normally.
- **Cold start of the 3D lab took roughly 30 seconds on the iPad simulator** (about 11 on iPhone).
  Simulator WebGL is far slower than real Metal hardware, so this is very likely a simulator
  artifact — but confirm it on a real iPad before submitting. A reviewer who sees "Loading the 3D
  lab…" for thirty seconds may well conclude the headline feature is broken. If real hardware is
  also slow, the loading state needs a progress indication rather than a static line of text.

## Deployment: the privacy policy URL is not live yet

**This is a blocking defect discovered while verifying the URLs.**
`https://backswing-dkg.pages.dev/privacy.html` returns HTTP 200 — but so does
`/definitely-not-a-page.html`, and both are byte-identical to the site root. The Cloudflare Pages
deploy has a catch-all that serves `index.html` for every path, so the privacy policy URL currently
resolves to the app, not to a policy. Apple rejects a privacy policy URL that does not resolve to a
privacy policy.

`privacy.html` and `terms.html` exist locally and `build.js` stages both into `dist/site`, so the
fix is simply to deploy. `.github/workflows/deploy.yml` runs `node build.js` and deploys
`dist/site` on every push to `main`, so **a push to `main` fixes this**.

Two things must be committed for that push to work:

- **`js/vendor/` — currently untracked.** `build.js` now *fails loudly* if the vendored three.js or
  `js/vendor/fonts/fonts.css` is missing, so a push without it breaks the deploy build in CI
  rather than silently shipping a broken lab. That failure is deliberate; the fix is to commit the
  directory, not to soften the check.
- **`privacy.html` and `terms.html`** — also untracked.

After deploying, confirm all three by hand — a 200 is not proof of anything on this host:

```sh
curl -s https://backswing-dkg.pages.dev/privacy.html | grep -o '<title>[^<]*</title>'   # expect "Privacy Policy — Free Relief"
curl -s https://backswing-dkg.pages.dev/terms.html   | grep -o '<title>[^<]*</title>'   # expect "Terms of Use — Free Relief"
curl -s https://backswing-dkg.pages.dev/privacy.html | grep -c 'id="contact"'           # expect 1, the support-URL anchor
```

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `Info.plist` (generated from `project.yml`). The app
uses no encryption of its own — no HTTPS calls, no crypto library, no data protection beyond what
the OS applies by default. Uploads therefore never stop to ask, and no CCATS or year-end
self-classification report is required. Nothing to do.

## Anatomy attribution (5.2 intellectual property)

The spine geometry is derived from BodyParts3D, © The Database Center for Life Science, licensed
**CC BY 4.0**. The licence requires attribution to travel with the work, so:

- The credit is rendered visibly in the app (`<p class="credit">` under the lab), naming the source,
  the licence with a link, and the modifications made (subset selected, simplified, re-rigged).
- `ATTRIBUTION.md` ships alongside the app and is linked from that credit.
- `build.js` **fails the build** if either the `class="credit"` marker or the phrase "Anatomy adapted
  from BodyParts3D" goes missing from `index.html`, `dist/artifact.html` or `dist/site/index.html`.
  A licence condition enforced by a comment is a licence condition that disappears the day someone
  adds a minifier.

Human Atlas (the intermediate source) is MIT. three.js is MIT. Archivo and Atkinson Hyperlegible are
SIL Open Font License 1.1 — all four are vendored into the bundle, and none of their licences
restrict redistribution inside an app.

---

## Submission checklist

Website-only steps are marked **[web]** — they cannot be done through the API.

**Blocking**

- [ ] Replace the App Review contact phone `+31 6 12345678` with a real, reachable number
- [ ] Replace both `[COUNTRY]` placeholders in `terms.html` §14
- [ ] Commit `js/vendor/`, `privacy.html` and `terms.html`, then push to `main` so the Pages deploy
      makes the privacy policy URL resolve to an actual privacy policy
- [ ] **[web]** App Privacy questionnaire → "Data Not Collected" → Publish
- [ ] **[web]** Pricing and Availability → Free, choose territories
- [ ] Upload the remaining screenshot sets. The **6.7" set (1290×2796) is already uploaded** and
      shows `assetDeliveryState: COMPLETE`. The 6.5" (1284×2778) and 12.9" iPad (2048×2732) sets are
      built and waiting in `docs/screenshots/`. If App Store Connect asks for the newer **6.9"**
      size (1320×2868), the raw simulator captures in `docs/simulator/` are natively that size
- [ ] Confirm `privacy.html` and `terms.html` are live (check the `<title>`, not the status code)
- [ ] Upload a build newer than 6, attach it to version 1.0.0, answer the export-compliance question
- [ ] **[web]** Version page → Copyright (still empty) and Content Rights — the answer to "contains
      third-party content" is yes: the BodyParts3D geometry, CC BY 4.0

**Strongly recommended**

- [ ] Wire the page to `FreeRelief.share`, `keepAwake` and `haptic` (the 4.2 argument, and better UX)
- [ ] Verify the 3D lab's cold start on real iPad hardware
- [ ] Read the final App Store description once more purely for medical claims
- [ ] Run through every route on a physical device with airplane mode on

**Already done**

- [x] Privacy policy and terms written, linked from the in-app disclaimer, staged by `build.js`
- [x] three.js and both font families vendored — no CDN, no network, no CDN outage during review
- [x] Service worker precaches the vendored assets; cache version bumped to `freerelief-v3`
- [x] `PrivacyInfo.xcprivacy` at the bundle root, declaring the UserDefaults required-reason API
- [x] `ITSAppUsesNonExemptEncryption: false`
- [x] `UIRequiresFullScreen: false`, orientations set, launch-screen colour set
- [x] Native bridge (haptics, share, idle timer) plus `freerelief://` deep links, verified in the
      simulator — the share sheet was observed presenting from a page-initiated call
- [x] Verified on iPhone and iPad simulators: safe areas respected, nothing clipped, 3D lab drawing
- [x] BodyParts3D CC BY 4.0 credit rendered and enforced by the build
- [x] Category, subtitle, description, keywords, promotional text, URLs, age rating (now
      `FOUR_PLUS`) and review notes set through `ios/fastlane/asc_metadata.rb`, which is idempotent
      and re-runnable
- [x] Version string corrected from `1.0` to `1.0.0` so it matches the builds' `MARKETING_VERSION`
- [x] Six 6.7" screenshots captioned and uploaded, all delivered
