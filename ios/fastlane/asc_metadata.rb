# Sets App Store metadata for Free Relief through the App Store Connect REST API.
# Idempotent and safe to re-run: every write is a PATCH/POST of the desired end state,
# no field aborts the run, and everything is read back and printed at the end.
# It never uploads a build and never submits for review.
#
#   set -a; source /path/to/.env; set +a   # ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH
#   ruby ios/fastlane/asc_metadata.rb
#
# ASC_DRY_RUN=1 prints the copy and its character counts without touching Apple.
require 'openssl'; require 'json'; require 'net/http'; require 'base64'

APP_ID       = ENV['ASC_APP_ID'] || '6808960319'
PLATFORM     = 'IOS'
LOCALE       = 'en-US'
VERSION      = ENV['ASC_VERSION'] || '1.0.0'
CATEGORY     = 'HEALTH_AND_FITNESS'
SITE         = 'https://backswing-dkg.pages.dev'
DRY_RUN      = %w[1 true yes].include?(ENV['ASC_DRY_RUN'].to_s.downcase)
EDITABLE     = %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED
                  INVALID_BINARY WAITING_FOR_REVIEW WAITING_FOR_EXPORT_COMPLIANCE
                  DEVELOPER_REMOVED_FROM_SALE REPLACED_WITH_NEW_VERSION].freeze

# --- copy -------------------------------------------------------------------

SUBTITLE = 'Golf back care and swing lab'

DESCRIPTION = <<~TXT.strip
  Free Relief is a back care companion for golfers. It brings the mobility work, the warm-up and the background reading into one app you can open on the way to the first tee.

  See the swing in 3D. The interactive swing lab draws a golfer through the full motion, from address to the top to follow-through, and shades the spine to show where load gathers as the body turns. Scrub through the swing at your own pace, rotate the model to any angle, and toggle stiff hips or a stiff mid-back to watch the picture change. When one area stops moving, the rest of the back takes up the slack, and the swing lab is the clearest way to see that happen.

  Not sure where to start? Tap Fix it. Three short questions about what you notice and when, and the app puts together a plan of mobility and strength work matched to your answers.

  Warm up before you play. Guided warm-up and cool-down routines run on a timer with step-by-step cues, and they are short enough for the car park. No mat, no gym, no equipment.

  The exercise library covers every movement in the app with plain coaching cues and the mistakes people usually make. The mobility self-screen walks you through a handful of tests so you can see which areas move freely and which feel tight. A multi-week program stacks the work into a routine you can actually follow. The injury-prevention guide covers the habits around golf, how you lift the bag, how you practise, how you recover, that matter as much as the exercises do. And the round log records the rounds you play and keeps a streak, so the routine has something to hold on to.

  Built to stay out of the way. Free Relief works fully offline, because every routine, model, page and font is bundled inside the app, so it runs on the plane, in the car park, or anywhere with no signal. Everything you enter stays on your device. There is no account to create, nothing to sign in to, no server behind it, and no data is collected or sent anywhere. It is free, with no ads and nothing to unlock.

  Free Relief offers general fitness and wellness information for golfers. It is not medical advice, it is not a diagnosis, and it is not a substitute for care from a qualified clinician. See a doctor or a physiotherapist before you start if anything concerns you, and especially with symptoms after a fall or an injury, symptoms that wake you at night or keep getting worse, numbness, weakness, or trouble controlling the bladder or bowel. Work in a comfortable range and stop anything that does not feel right.

  Anatomy geometry from BodyParts3D, licensed CC BY 4.0, credited in the app.
TXT

KEYWORDS = 'golf,golfer,back,spine,hips,mobility,stretching,warmup,cooldown,flexibility,posture,swing,fitness'

PROMOTIONAL = 'A 3D swing lab that shows where load goes in the spine, a Fix it planner, timed warm-ups, an exercise library and a round log. Offline, no account, free.'

REVIEW_NOTES = <<~TXT.strip
  Free Relief is a general wellness and fitness guide for golfers: mobility routines, timed warm-ups and cool-downs, an exercise library, a mobility self-screen, a multi-week program, an injury-prevention guide and a round log.

  No account and no login. There is no server, no analytics and no data collection of any kind. Everything the user enters stays on the device in localStorage. The app works fully offline: three.js and the web fonts are bundled in the binary, and nothing is fetched at runtime. The 3D swing lab renders locally with WebGL on Metal.

  Native iOS integrations: haptic feedback, the system share sheet, idle-timer control so the screen stays awake during timed routines, and freerelief:// deep links.

  Not a medical device. The app makes no diagnostic or treatment claims and shows a wellness disclaimer. Anatomy geometry is BodyParts3D, licensed CC BY 4.0 and credited in the app.
TXT

# PLACEHOLDER contact number. Apple validates the format, so the requested
# "+31 000000000" is tried first and the run falls through to the next candidate if
# Apple rejects it. Every one of these is fake, replace before submitting.
PHONE_CANDIDATES = ['+31 000000000', '+31 6 00000000', '+31 6 12345678'].freeze
CONTACT = { contactFirstName: 'Bram', contactLastName: 'Pek', contactEmail: 'brampek@gmail.com',
            demoAccountRequired: false, notes: REVIEW_NOTES }.freeze

# Age-rating attributes we always want at their "no content" value. Apple mixes enum and
# boolean attributes here and the set changes over time, so the live declaration is probed
# first and each key is written on its own with "NONE" then false, never both at once.
AGE_NONE = %w[
  advertising alcoholTobaccoOrDrugUseOrReferences ageAssurance contests gambling gamblingSimulated
  gunsOrOtherWeapons healthOrWellnessTopics horrorOrFearThemes lootBox matureOrSuggestiveThemes
  medicalOrTreatmentInformation messagingAndChat parentalControls profanityOrCrudeHumor
  sexualContentGraphicAndNudity sexualContentOrNudity socialMedia socialMediaAgeRestricted
  unrestrictedWebAccess userGeneratedContent violenceCartoonOrFantasy violenceRealistic
  violenceRealisticProlongedGraphicOrSadistic
].freeze
# Left alone on purpose: kidsAgeBand (null = not in the Kids category), ageRatingOverride*,
# koreaAgeRatingOverride, developerAgeRatingInfoUrl.
# Seeded from the type errors Apple returned on the first run: these took a boolean
# without complaint, everything else in AGE_NONE wants the "NONE" string. The retry loop
# below re-derives this from Apple's errors, so a stale entry self-corrects.
AGE_BOOLEAN = %w[advertising ageAssurance gambling healthOrWellnessTopics lootBox messagingAndChat
                 parentalControls socialMedia socialMediaAgeRestricted unrestrictedWebAccess
                 userGeneratedContent].freeze
AGE_SKIP = %w[kidsAgeBand ageRatingOverride ageRatingOverrideV2 koreaAgeRatingOverride
              developerAgeRatingInfoUrl].freeze

# --- transport --------------------------------------------------------------

KEY_ID = ENV.fetch('ASC_KEY_ID'); ISSUER = ENV.fetch('ASC_ISSUER_ID'); KEY_PATH = ENV.fetch('ASC_KEY_PATH')
abort "private key not found at ASC_KEY_PATH" unless File.file?(KEY_PATH)

def b64(s) = Base64.urlsafe_encode64(s, padding: false)

def jwt
  key = OpenSSL::PKey::EC.new(File.read(KEY_PATH)); now = Time.now.to_i
  header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }.to_json)
  payload = b64({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }.to_json)
  seq = OpenSSL::ASN1.decode(key.sign(OpenSSL::Digest.new('SHA256'), "#{header}.#{payload}"))
  r = seq.value[0].value.to_s(2).rjust(32, "\0")[-32..]; s = seq.value[1].value.to_s(2).rjust(32, "\0")[-32..]
  "#{header}.#{payload}.#{b64(r + s)}"
end

def api(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com/v1/#{path}")
  req = { 'GET' => Net::HTTP::Get, 'POST' => Net::HTTP::Post, 'PATCH' => Net::HTTP::Patch }[method].new(uri)
  req['Authorization'] = "Bearer #{jwt}"; req['Content-Type'] = 'application/json'; req.body = body.to_json if body
  res = Net::HTTP.start(uri.host, 443, use_ssl: true, read_timeout: 60) { |h| h.request(req) }
  [res.code.to_i, res.body.to_s.empty? ? {} : JSON.parse(res.body)]
rescue StandardError => e
  [0, { 'errors' => [{ 'title' => e.class.to_s, 'detail' => e.message }] }]
end

def errs(d)
  msgs = (d['errors'] || []).map { |e| "#{e['title']}: #{e['detail']}" }.uniq
  msgs.length > 4 ? "#{msgs.first(4).join(' | ')} (+#{msgs.length - 4} more)" : msgs.join(' | ')
end

OK = []; BAD = []; SKIPPED = []; PHONE_USED = +''

def trunc(v, n = 70)
  s = v.is_a?(String) ? v.gsub(/\s+/, ' ') : v.inspect
  s.length > n ? "#{s[0, n]}... (#{v.is_a?(String) ? v.length : s.length} chars)" : s
end

def good(field, value, code) = (OK << [field, value, code]; puts "  OK   #{code}  #{field} = #{trunc(value)}")
def bad(field, code, detail) = (BAD << [field, code, detail]; puts "  FAIL #{code}  #{field}: #{detail}")
def skip(field, why) = (SKIPPED << [field, why]; puts "  --        #{field}: #{why}")

# PATCH/POST a resource and report per attribute. Returns the response body on success.
def write(field, method, path, payload, values)
  return (puts "  DRY  ---  #{field}") if DRY_RUN
  code, d = api(method, path, payload)
  if (200..299).cover?(code)
    values.each { |k, v| good("#{field}.#{k}", v, code) }
    d
  else
    bad(field, code, errs(d).empty? ? d.to_s[0, 300] : errs(d))
    nil
  end
end

def patch_attrs(field, type, id, attrs)
  write(field, 'PATCH', "#{type}/#{id}", { data: { type: type, id: id, attributes: attrs } }, attrs)
end

def section(title) = puts("\n== #{title}")

# --- 0. copy sanity ---------------------------------------------------------

section 'copy limits'
[['description', DESCRIPTION, 4000], ['keywords', KEYWORDS, 100], ['promotionalText', PROMOTIONAL, 170],
 ['subtitle', SUBTITLE, 30], ['review notes', REVIEW_NOTES, 4000]].each do |name, text, max|
  flag = text.length > max ? 'OVER LIMIT' : 'ok'
  puts format('  %-14s %4d / %-4d %s', name, text.length, max, flag)
  abort "#{name} is over the App Store limit of #{max} characters" if text.length > max
end
puts "\n  keywords: #{KEYWORDS}"
puts "  promotionalText: #{PROMOTIONAL}"
if DRY_RUN
  puts "\n--- description ---\n#{DESCRIPTION}\n--- review notes ---\n#{REVIEW_NOTES}"
  puts "\nDRY RUN, nothing was sent to Apple."; exit 0
end

# --- 1. app store version ---------------------------------------------------

section 'appStoreVersion'
code, d = api('GET', "apps/#{APP_ID}/appStoreVersions?filter[platform]=#{PLATFORM}&limit=50")
abort "cannot list appStoreVersions: #{code} #{errs(d)}" unless code == 200
versions = d['data'] || []
versions.each { |v| puts "  found #{v.dig('attributes', 'versionString')} #{v.dig('attributes', 'appStoreState')} (#{v['id']})" }
version = versions.find { |v| v.dig('attributes', 'versionString') == VERSION && EDITABLE.include?(v.dig('attributes', 'appStoreState')) } ||
          versions.find { |v| EDITABLE.include?(v.dig('attributes', 'appStoreState')) }

if version.nil?
  code, d = api('POST', 'appStoreVersions', { data: { type: 'appStoreVersions',
    attributes: { platform: PLATFORM, versionString: VERSION },
    relationships: { app: { data: { type: 'apps', id: APP_ID } } } } })
  if (200..299).cover?(code)
    version = d['data']; good('appStoreVersion.created', VERSION, code)
  else
    bad('appStoreVersion.create', code, errs(d)); abort 'no editable version to write to, stopping'
  end
end
VER_ID = version['id']
puts "  using version #{version.dig('attributes', 'versionString')} (#{version.dig('attributes', 'appStoreState')}) id #{VER_ID}"

if version.dig('attributes', 'versionString') == VERSION
  skip('appStoreVersion.versionString', "already #{VERSION}")
else
  # The binaries carry MARKETING_VERSION 1.0.0, so the store record has to agree.
  patch_attrs('appStoreVersion', 'appStoreVersions', VER_ID, { versionString: VERSION })
end

# --- 2. app info: category + localization ------------------------------------

section 'appInfo'
code, d = api('GET', "apps/#{APP_ID}/appInfos")
abort "cannot list appInfos: #{code} #{errs(d)}" unless code == 200
infos = d['data'] || []
info = infos.find { |i| EDITABLE.include?(i.dig('attributes', 'state') || i.dig('attributes', 'appStoreState')) } || infos.first
abort 'no appInfo found' if info.nil?
INFO_ID = info['id']
puts "  using appInfo #{INFO_ID} (#{info.dig('attributes', 'state')})"

code, d = api('GET', "appInfos/#{INFO_ID}/primaryCategory")
current_cat = d.dig('data', 'id')
if current_cat == CATEGORY
  skip('appInfo.primaryCategory', "already #{CATEGORY}")
else
  write('appInfo', 'PATCH', "appInfos/#{INFO_ID}",
        { data: { type: 'appInfos', id: INFO_ID,
                  relationships: { primaryCategory: { data: { type: 'appCategories', id: CATEGORY } } } } },
        { primaryCategory: CATEGORY })
end

code, d = api('GET', "appInfos/#{INFO_ID}/appInfoLocalizations")
loc = (d['data'] || []).find { |l| l.dig('attributes', 'locale') == LOCALE }
if loc
  puts "  appInfoLocalization #{LOCALE} #{loc['id']} name=#{loc.dig('attributes', 'name').inspect} (name left untouched)"
  patch_attrs('appInfoLocalization', 'appInfoLocalizations', loc['id'],
              { subtitle: SUBTITLE, privacyPolicyUrl: "#{SITE}/privacy.html" })
else
  write('appInfoLocalization', 'POST', 'appInfoLocalizations',
        { data: { type: 'appInfoLocalizations',
                  attributes: { locale: LOCALE, subtitle: SUBTITLE, privacyPolicyUrl: "#{SITE}/privacy.html" },
                  relationships: { appInfo: { data: { type: 'appInfos', id: INFO_ID } } } } },
        { locale: LOCALE, subtitle: SUBTITLE, privacyPolicyUrl: "#{SITE}/privacy.html" })
end

# --- 3. version localization -------------------------------------------------

section 'appStoreVersionLocalization'
VERSION_ATTRS = { description: DESCRIPTION, keywords: KEYWORDS, promotionalText: PROMOTIONAL,
                  supportUrl: "#{SITE}/privacy.html#contact", marketingUrl: SITE }.freeze
code, d = api('GET', "appStoreVersions/#{VER_ID}/appStoreVersionLocalizations")
vloc = (d['data'] || []).find { |l| l.dig('attributes', 'locale') == LOCALE }
if vloc
  patch_attrs('versionLocalization', 'appStoreVersionLocalizations', vloc['id'], VERSION_ATTRS)
else
  res = write('versionLocalization', 'POST', 'appStoreVersionLocalizations',
              { data: { type: 'appStoreVersionLocalizations',
                        attributes: VERSION_ATTRS.merge(locale: LOCALE),
                        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VER_ID } } } } },
              VERSION_ATTRS.merge(locale: LOCALE))
  vloc = res && res['data']
end
skip('versionLocalization.whatsNew', 'omitted on purpose, a first 1.0.0 has no release notes')

# --- 4. age rating ------------------------------------------------------------

section 'ageRatingDeclaration'
code, d = api('GET', "appInfos/#{INFO_ID}/ageRatingDeclaration")
decl = d['data']
if decl.nil?
  bad('ageRatingDeclaration', code, errs(d).empty? ? 'no declaration returned' : errs(d))
else
  age_id = decl['id']
  live = decl['attributes'] || {}
  puts "  declaration #{age_id}, #{live.size} attributes returned by Apple"
  unknown = AGE_NONE - live.keys
  puts "  in our map but not offered by the API, skipping: #{unknown.join(', ')}" unless unknown.empty?
  extra = live.keys - AGE_NONE - AGE_SKIP
  puts "  returned but not in our map, left alone: #{extra.join(', ')}" unless extra.empty?

  # Apple rejects a partial declaration ("you must provide a value for 'x' with this
  # request"), so every attribute goes in one PATCH. It also mixes frequency enums
  # ("NONE") with booleans (false) and does not say which is which, so start with the
  # enum everywhere and let Apple's own type errors correct the guesses.
  payload = (AGE_NONE & live.keys).to_h { |k| [k, AGE_BOOLEAN.include?(k) ? false : 'NONE'] }
  # Honest answer for an exercise app: Apple's own example for this descriptor is "exercise recommendations" (rates 9+).
  payload['healthOrWellnessTopics'] = true if payload.key?('healthOrWellnessTopics')
  age_code = nil; age_body = nil
  6.times do
    age_code, age_body = api('PATCH', "ageRatingDeclarations/#{age_id}",
                             { data: { type: 'ageRatingDeclarations', id: age_id, attributes: payload } })
    break if (200..299).cover?(age_code)
    flipped = []
    (age_body['errors'] || []).each do |e|
      det = e['detail'].to_s
      next unless (m = det.match(/attribute '([A-Za-z]+)'\. Expected an? (\w+)/))
      attr, want = m[1], m[2].upcase
      nv = want == 'STRING' ? 'NONE' : false
      next if !payload.key?(attr) || payload[attr] == nv
      payload[attr] = nv; flipped << "#{attr}->#{nv.inspect}"
    end
    # Apple sometimes names a required attribute we did not send at all.
    (age_body['errors'] || []).each do |e|
      next unless (m = e['detail'].to_s.match(/value for the attribute '([A-Za-z]+)'/))
      next if payload.key?(m[1]) || AGE_SKIP.include?(m[1])
      payload[m[1]] = 'NONE'; flipped << "#{m[1]}->added"
    end
    break if flipped.empty?
    puts "  retrying, Apple corrected: #{flipped.join(', ')}"
  end

  if (200..299).cover?(age_code)
    payload.sort.each { |k, v| good("ageRating.#{k}", v, age_code) }
  else
    bad('ageRatingDeclaration', age_code, errs(age_body))
    puts "  attempted payload: #{payload.sort.to_h.inspect}"
  end
end

# --- 5. review details --------------------------------------------------------

section 'appStoreReviewDetail'
code, d = api('GET', "appStoreVersions/#{VER_ID}/appStoreReviewDetail")
detail = d['data']
rd_done = false
# A phone Apple already accepted goes first, so a re-run does not walk the rejects again.
stored = detail && detail.dig('attributes', 'contactPhone')
candidates = ([stored] & PHONE_CANDIDATES) + PHONE_CANDIDATES - [nil]
candidates.uniq!
candidates.each do |phone|
  break if rd_done
  attrs = CONTACT.merge(contactPhone: phone)
  if detail
    c, r = api('PATCH', "appStoreReviewDetails/#{detail['id']}",
               { data: { type: 'appStoreReviewDetails', id: detail['id'], attributes: attrs } })
  else
    c, r = api('POST', 'appStoreReviewDetails',
               { data: { type: 'appStoreReviewDetails', attributes: attrs,
                         relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VER_ID } } } } })
    detail = r['data'] if (200..299).cover?(c)
  end
  if (200..299).cover?(c)
    attrs.each { |k, v| good("reviewDetail.#{k}", v, c) }
    PHONE_USED.replace(phone)
    rd_done = true
  else
    puts "  ..    #{c}  reviewDetail with phone #{phone.inspect}: #{errs(r)}"
  end
end
bad('reviewDetail', 409, "no contactPhone candidate was accepted: #{candidates.join(', ')}") unless rd_done

# --- 6. read everything back --------------------------------------------------

section 'read back'
_, d = api('GET', "appStoreVersions/#{VER_ID}")
a = d.dig('data', 'attributes') || {}
puts "  version: #{a['versionString']}  state: #{a['appStoreState']}  copyright: #{a['copyright'].inspect}"

_, d = api('GET', "appInfos/#{INFO_ID}/primaryCategory")
puts "  primaryCategory: #{d.dig('data', 'id').inspect}"
_, d = api('GET', "appInfos/#{INFO_ID}/secondaryCategory")
puts "  secondaryCategory: #{d.dig('data', 'id').inspect} (deliberately unset)"

_, d = api('GET', "appInfos/#{INFO_ID}/appInfoLocalizations")
(d['data'] || []).each do |l|
  la = l['attributes']
  puts "  appInfoLocalization #{la['locale']}: name=#{la['name'].inspect} subtitle=#{la['subtitle'].inspect}"
  puts "    privacyPolicyUrl=#{la['privacyPolicyUrl'].inspect}"
end

_, d = api('GET', "appStoreVersions/#{VER_ID}/appStoreVersionLocalizations")
(d['data'] || []).each do |l|
  la = l['attributes']
  puts "  versionLocalization #{la['locale']}:"
  %w[supportUrl marketingUrl promotionalText keywords whatsNew].each { |k| puts "    #{k}: #{la[k].inspect}" }
  puts "    description: #{la['description'].to_s.length} chars, #{la['description'] ? 'set' : 'EMPTY'}"
end

_, d = api('GET', "appInfos/#{INFO_ID}/ageRatingDeclaration")
attrs = d.dig('data', 'attributes') || {}
still_null = attrs.reject { |k, v| !v.nil? || AGE_SKIP.include?(k) }.keys
puts "  ageRating set: #{attrs.reject { |_, v| v.nil? }.map { |k, v| "#{k}=#{v}" }.join(' ')}"
puts "  ageRating still null: #{still_null.empty? ? 'none' : still_null.join(', ')}"
_, d = api('GET', "appInfos/#{INFO_ID}")
puts "  appStoreAgeRating: #{d.dig('data', 'attributes', 'appStoreAgeRating').inspect}"

_, d = api('GET', "appStoreVersions/#{VER_ID}/appStoreReviewDetail")
ra = d.dig('data', 'attributes') || {}
puts "  reviewDetail: #{ra['contactFirstName']} #{ra['contactLastName']} <#{ra['contactEmail']}> #{ra['contactPhone']}"
puts "    demoAccountRequired=#{ra['demoAccountRequired'].inspect} notes=#{ra['notes'].to_s.length} chars"

# --- 7. summary ---------------------------------------------------------------

section 'summary'
puts "  #{OK.size} written, #{BAD.size} failed, #{SKIPPED.size} skipped"
BAD.each { |f, c, m| puts "  FAILED #{f} (HTTP #{c}): #{m}" }
puts
puts '  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
puts format('  !!  WARNING: contactPhone %-24s is a PLACEHOLDER.  !!', PHONE_USED.empty? ? '(NOT SET)' : PHONE_USED)
puts '  !!  Replace it with a real, reachable number in App Store Connect !!'
puts '  !!  (App Review Information) BEFORE submitting for review.        !!'
puts '  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
puts
puts '  Still to do by hand on appstoreconnect.com, the API cannot set these:'
puts '   - App Privacy questionnaire, answer "No" to data collection (App > App Privacy).'
puts '   - Pricing and Availability, price Free plus territories (App > Pricing and Availability).'
puts '   - Screenshots, at least one 6.9" iPhone set (App > 1.0.0 > Previews and Screenshots).'
puts '   - Attach build 6 to the version, and set the export compliance answer.'
puts '   - Copyright field and Content Rights on the version page.'
