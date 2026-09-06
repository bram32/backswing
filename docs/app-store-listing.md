# Free Relief: App Store Connect listing copy

Draft for App Store Connect. Every field below carries a character count.
Counts were measured on the exact text in the fenced block, excluding the fence.

---

## App name

Field limit: 30 characters.

```
Free Relief: Golf Back Care
```

Count: 27 / 30.

Notes: the name field is indexed for search, so the two words that carry search
weight (golf, back) sit inside it. "Free Relief" alone is 11 characters and
searchable by nobody. Apple rejects names that read as keyword strings, so keep
it to one descriptive clause after the colon.

Fallback if App Review objects to the descriptor: `Free Relief: Golf Back` (22).

---

## Subtitle

Field limit: 30 characters. Indexed for search, so every word here should be a
word the app name does not already contain.

```
Stretches for lower back pain
```

Count: 29 / 30.

The name contributes *free, relief, golf, back, care*. This subtitle adds
*stretches, lower, pain*. Apple combines terms across fields automatically, so
the pair manufactures "golf back pain", "golf stretches", "lower back pain" and
"golf lower back" without spending a single keyword byte on them.

Alternates, all inside the limit:

- `Golf stretches for a sore back` (30) drops "pain", which is the highest
  intent word available. Use only if App Review objects to "pain" anywhere.
- `Play golf without back pain` (27) reads better and indexes worse: "golf" and
  "back" are already in the name.
- `Warm up, fix it, keep playing` (29) is the most human and the least findable.

## Keyword field

Field limit: **100 bytes**, not characters. Apple's own reference says bytes
("You can provide up to 100 bytes of content"), so plain ASCII is one byte per
character but any accented letter costs more. Comma separated, no spaces.

Rules that actually matter, from Apple's [product page
guidance](https://developer.apple.com/app-store/product-page/): no plurals, no
category names, no the word "app", no duplicate words, and **no competing app
names** (Apple lists that among prohibited keywords, and it is a documented
rejection reason). Words already in the name and subtitle are indexed anyway, so
repeating them is wasted space; Apple does not weight keyword density.

```
swing,lumbar,spine,sciatica,mobility,posture,physio,warmup,hip,rotation,rehab,stiff,injury,core
```

Count: 95 / 100 bytes.

Why these, given a competitive picture where the golf side is nearly undefended
and the back-pain side is a fortress:

- `swing`, `hip`, `rotation`, `warmup`, `mobility` combine with "golf" from the
  name to reach the winnable terms: golf swing, golf mobility, golf warm up,
  golf hip. Searching the store today, "golf mobility" returns apps matching the
  word "mobile", which is an open goal.
- `lumbar`, `spine`, `stiff`, `core`, `posture` combine with "lower" and "back"
  from the subtitle for the long tail.
- `sciatica` is high intent and medically adjacent. Keep it only while the app
  never claims to treat sciatica; it appears in the injury guide as a red flag,
  which is honest usage.
- `physio`, `rehab`, `injury` carry the credibility and prevention framing.

**What is deliberately absent.** No attempt at "back pain", "posture" or
"sciatica" as head terms. Bend has 173,220 App Store ratings and Hinge Health
has 162,310; a zero-rating app cannot place against them, and Apple blends text
relevance with downloads and ratings. The word **golf** is the moat precisely
because neither of them will ever want it.

Hold this as the A/B challenger if the first field underperforms, swapping the
performance framing for the symptom framing:

```
sciatica,lumbar,spine,disc,stiff,ache,sore,injury,rehab,physio,mobility,posture
```

Count: 79 / 100 bytes. Change one metadata field at a time, at least four weeks
apart, or nothing is learnable.

## Promotional text

Field limit: 170 characters. Editable without a new build, so use it for the
current release note or seasonal hook.

```
New: a two-minute mobility self-screen that turns your own limits into a 3D avatar, plus multi-week programs for golfer's elbow, return to golf, and clubhead speed.
```

Count: 164 / 170.

Launch-day alternate, before programs ship:

```
Free, no account, nothing leaves your phone. See exactly where your swing puts load on your lower back, then get the routine that takes it off.
```

Count: 143 / 170.

---

## Description

Field limit: 4000 characters. **Not indexed for App Store search.** Apple's own
[search page](https://developer.apple.com/app-store/search/) lists the ranking
inputs as title, subtitle, keywords and primary category, plus downloads and
ratings; the description is absent and promotional text "doesn't affect your
app's search ranking". So this is written for the human who is deciding, not for
the algorithm. The first three lines are what shows above the fold.

```
Most golf back pain is not a mystery. It is the lower back doing a job the mid back and hips were meant to do.

Free Relief shows you that in three dimensions, then gives you something to do about it. No account. No subscription. Nothing leaves your phone.

THE SWING LAB
A golfer with a real anatomical spine, 24 vertebrae and discs, rendered on your device. Play the swing, then switch on stiff hips, a stiff mid back, or a reverse spine angle and watch the rotation get pushed down into the lumbar spine, which lights up as it passes its roughly 10 degrees of capacity. Orbit it, scrub it, watch it face on or down the line. Tap any part of the body to start a plan for that part.

FIX IT
Tell it where it hurts, when it hurts, and what it feels like. You get a plain verdict on whether to play, a short explanation of what is probably going on, a timed set of exercises to do now, a daily routine, the swing faults that usually cause it, what to avoid, and the specific signs that mean you should stop reading an app and see someone.

ROUTINES
Seven guided routines with a timer and voice cues, built around where you actually are. A seven-minute first-tee warm-up with no floor work. A post-round cool-down you can do at the cart. Daily back care. A mid-back unlock. Elbow rehab. Strength basics. A 90-second reset between holes.

EXERCISES
Forty-five exercises with clear line drawings, steps, the one cue that matters, the mistake people make, and the golf reason you are doing it at all.

PREVENT
The seven injuries golfers actually get, ten swing faults with the body reason behind each, and what to do on the morning of a round.

LOG
Pain after each round, whether you warmed up, how you got around. A chart shows you whether the warm-up is paying off. This is the part that tells you if any of it is working.

BUILT FOR GOLFERS, NOT FOR A GYM
Right and left handed. Most of it needs no equipment and no floor. The exercises are written for someone standing next to a cart in a polo shirt, not lying on a studio mat.

PRIVACY, PLAINLY
There is no account, no sign-up, no server, and no analytics. Everything you enter is stored on your device and stays there. Delete the app and it is gone. That is not a setting you have to find. It is the only way the app works.

A HONEST NOTE ON WHAT THIS IS
This is general exercise and injury-prevention guidance for golfers, the kind a good physiotherapist gives everyone before they get to the specifics of you. It is not a diagnosis, it is not physiotherapy, and it cannot examine you. Exercise helps non-specific back pain on average, and the average effect in the research is real but modest. If you have leg weakness, numbness in the saddle area, unexplained weight loss, pain that wakes you every night, or pain after a fall, the app will tell you to stop and see a doctor. Please do.

Free Relief is also free. There is no paywall, no trial, and no upsell.
```

Count: 2,913 / 4000.

---

## What's new

Field limit: 4000 characters. For version 1.0.

```
First release.

- Swing lab: a 3D golfer with a real anatomical spine. Toggle stiff hips, a stiff mid back, or a reverse spine angle and watch the load move into the lumbar spine.
- Fix it: three questions, then a plan for right now.
- Seven guided routines with a timer, from a seven-minute first-tee warm-up to a 90-second reset between holes.
- Forty-five exercises with drawings, cues and the golf reason for each.
- The seven common golf injuries and ten swing faults, with the body cause behind each.
- A round log that charts whether warming up is actually helping you.

Right and left handed. No account, no subscription, no data leaving your phone.
```

Count: 657 / 4000.

Template for later versions: lead with the one thing a returning user would
care about, keep it to six lines, never write "bug fixes and improvements" alone.

---

## Category

- Primary: **Health & Fitness**
- Secondary: **Sports**

Health & Fitness is the right primary. It is where the intent lives ("back
pain", "stretches") and where the app's substance is. Sports as secondary picks
up golf browsing. Do not flip them: Sports primary would put the app next to
score trackers and live scores, where it loses.

---

## Age rating

Target **4+**.

Answers for the questionnaire:

- Cartoon or fantasy violence: none
- Realistic violence: none
- Sexual content or nudity: none. The 3D figure is an anatomical skeleton inside
  a holographic body outline, not a nude human, and no genitalia are modelled.
- Profanity or crude humour: none
- Alcohol, tobacco, or drug use or references: none
- Horror or fear themes: none
- Medical or treatment information: **yes, infrequent/mild**. The app discusses
  injuries, symptoms, and when to see a clinician. Answering yes here is
  honest and typically keeps the rating at 4+ or moves it to 12+; either is
  fine. Do not answer no in order to hold 4+.
- Gambling, contests, unrestricted web access, user-generated content: none
- Made for Kids: **no**

---

## App Review notes

Paste into the "Notes" field of App Review Information.

```
WHAT THE APP IS
Free Relief is a general wellness app for recreational golfers. It contains an interactive 3D anatomy visualisation of a golf swing, a library of 45 stretching and mobility exercises, seven guided timed routines, an educational guide to common golf injuries and swing faults, and a personal round log.

NO ACCOUNT, NO SERVER, NO DATA COLLECTION
There is no sign-in, no registration, and no back end. All user input is stored locally on device via the web view's local storage and never leaves the device. The app makes no network requests to any server operated by us. The privacy nutrition label is therefore "Data Not Collected". No demo account is needed; every feature is available immediately on first launch.

GENERAL WELLNESS, NOT A MEDICAL DEVICE
The app does not diagnose, treat, cure, mitigate or prevent any disease, and does not make any such claim. It provides general exercise and injury-prevention guidance of the kind found in a printed golf fitness book. The "Fix it" feature is a content router: it asks three questions and shows a pre-written, non-individualised education page and exercise list for that body area. It does not compute a diagnosis, does not adapt a treatment plan, and does not process any measured physiological data. It falls under the FDA's General Wellness: Policy for Low Risk Devices, and outside the definition of a medical device under EU MDR Annex VIII Rule 11 and MDCG 2019-11, as it is intended for general fitness and wellbeing.

SAFETY AND DISCLAIMERS (guideline 1.4.1)
A permanent disclaimer appears on the main screen and on every generated plan, stating that the app gives general guidance, is not medical advice, and cannot examine the user. Every plan ends with a "See someone" section listing specific red-flag symptoms (leg weakness, numbness in the saddle area, loss of bladder or bowel control, unexplained weight loss, night pain, pain following a fall) with an instruction to stop and see a doctor or physiotherapist. Exercises are low-load stretching and mobility movements with explicit stop-if-it-hurts guidance and a listed common mistake to avoid.

TECHNOLOGY (guideline 4.2)
The interface is rendered with WebKit inside the app, but the app is not a web wrapper and does not load a remote website. The entire application, including the 3D engine, the anatomical geometry and all content, is bundled inside the app and served from a local custom URL scheme. It functions fully with the device in airplane mode. The 3D swing lab is a real-time WebGL scene with an articulated 24-vertebra spine, inverse kinematics, orbit and scrub controls, and interactive hit testing on body parts. It is not available on any comparable free website in this form.

ANATOMY ATTRIBUTION
The skeletal geometry is derived from BodyParts3D (c) The Database Center for Life Science, used under CC BY 4.0. The attribution is displayed in the app beneath the swing lab and in full in the bundled ATTRIBUTION file.

BUSINESS MODEL
The app is free with no in-app purchases, no subscriptions, no advertising, and no third-party SDKs of any kind.

HOW TO TEST THE MAIN FEATURE
On launch, press the play button under the 3D figure to run the swing, then tap "Stiff hips" and "Stiff mid back" under "What if" and watch the "Lumbar rotation" readout move past 10 degrees. Tap the lower back on the 3D figure to generate a plan.
```

Count: 3,377 characters (the field has no published hard limit; keep it under
4,000 to be safe).

---

## Screenshot captions

Five captions, one per screenshot, 6.9" and 6.5" sets. Keep each under about 40
characters so it stays legible at gallery size.

The first three carry almost all the weight. Apple states that "the first one to
three images will appear in search results when no app preview is available", so
in portrait those three images are the advertisement, seen by people who never
open the product page. StoreMaven's 500 million session dataset finds that 60
percent of visitors never scroll past that first impression. Lead with the
lumbar load visualisation, because it is the one image no competitor can copy.

1. **`See where your back takes the load`** (34)
   Screenshot: the 3D swing lab at the top of the backswing, lumbar bar in the
   orange "working" band, X-factor readout visible.

2. **`Stiff hips? Watch it move to the spine`** (38)
   Screenshot: the same frame with "Stiff hips" and "Stiff mid back" switched on,
   the lumbar bar in the red band reading past 10 degrees.

3. **`Three questions, then a plan`** (28)
   Screenshot: the Fix it result, showing the Play on / Take a drop verdict and
   the first two exercises.

4. **`Seven minutes on the first tee`** (30)
   Screenshot: the warm-up routine mid-timer, one exercise drawing large, no
   floor work badge visible.

5. **`No account. Nothing leaves your phone`** (37)
   Screenshot: the round log chart showing warm-up versus pain, with the privacy
   line beneath it.

Optional sixth if the set allows: **`45 exercises, every one for golf`** (32),
showing the exercise grid.

---

## App preview video

Up to three previews, 30 seconds each. Worth making one, with two constraints
from Apple's own guidance: previews play muted by default, so the point has to
land in captions, and the first frames decide whether anyone keeps watching.

The 30 second cut: address, swing plays, lumbar bar sits in the amber band, tap
"Stiff hips", swing repeats, bar goes red past 10 degrees, cut to the plan
screen. No narration. Reuse the same file as the Featuring Nomination
supplemental material and as the social asset.

---

## Featuring Nomination

Free, and takes an hour. In App Store Connect: your app, then Featuring,
Nominations, plus button. Requires Account Holder, Admin, App Manager or
Marketing role. Submit at least three weeks before launch; Apple suggests up to
three months for wider consideration.

- **Nomination type:** App Launch
- **Nomination name** (60 chars): `Free Relief: golf back care in 3D` (33)
- **Nomination description** (1000 chars): lead with the mechanism. A real
  anatomical spine, 24 vertebrae, rendered on device, showing where a golf swing
  puts load on the lower back and what happens to that load when the hips or the
  mid back stop turning. Then the substance: 45 exercises, seven timed routines,
  a symptom-to-exercise planner, no account and no data collection of any kind.
- **Supplemental materials** (up to 5 URLs): the preview video, a TestFlight
  public link (Apple explicitly permits this here), the web version, the
  attribution page, and a still of the lab.
- **Helpful details** (500 chars): the solo developer story, the BodyParts3D
  anatomy licensing, and the fact that everything runs on device with no server.
  Apple asks here for "a unique approach to helping users or a behind-the-scenes
  look", so answer that question rather than pitching.

Apple's stated featuring criteria are user experience, UI design, innovation,
uniqueness, accessibility, localization and the product page. This app scores
well on innovation and uniqueness and scores zero on localization, which is a
known and accepted trade for now.

---

## Support and marketing URLs

- Support URL: required. Point it at a page on the Cloudflare Pages site with an
  email address and a short FAQ. A bare mailto is not accepted.
- Marketing URL: `https://backswing-dkg.pages.dev` (optional; note the domain
  still says backswing, which looks careless next to the name Free Relief.
  Register and point a real domain before launch if possible.)
- Privacy Policy URL: **required even when the app collects nothing.** Publish a
  short page saying exactly that.

---

## Privacy nutrition label

Select **Data Not Collected**. This is true today and it is the app's single
strongest differentiator. It stops being true the moment analytics, crash
reporting, or an account is added, so any future SDK decision is also a
marketing decision.

---

## Copy that must not appear anywhere in the listing

These invite either an App Review rejection under 1.4.1, an ASA or FTC problem,
or a medical device classification question.

| Do not write | Write instead |
| --- | --- |
| Cure your back pain | Back care built for golfers |
| Treat your sciatica | Understand what the pain might be |
| Diagnose your injury | Narrow down where it hurts |
| Clinically proven | Built on published guidance, with the sources listed |
| Physiotherapist approved (with no named clinician) | Physio-informed guidance |
| Prevents golf injuries | Injury prevention habits for golfers |
| Fix your back in 7 days | Seven minutes before you tee off |
