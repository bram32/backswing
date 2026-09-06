# READ-ONLY dump of the App Store Connect listing: app info, version, review contact,
# localizations, screenshot sets. Safe to run any time.
#   set -a; source .env; set +a; ruby ios/fastlane/asc_listing_state.rb
require 'openssl'; require 'json'; require 'net/http'; require 'base64'
KEY_ID = ENV.fetch('ASC_KEY_ID'); ISSUER = ENV.fetch('ASC_ISSUER_ID'); KEY_PATH = ENV.fetch('ASC_KEY_PATH')
BUNDLE = ENV['ASC_BUNDLE'] || 'com.brampek.backswing'; NEW_NAME = ENV['ASC_APP_NAME'] || 'Free Relief'
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
  res = Net::HTTP.start(uri.host, 443, use_ssl: true) { |h| h.request(req) }
  [res.code.to_i, res.body.to_s.empty? ? {} : JSON.parse(res.body)]
end
def errs(d) = (d['errors'] || []).map { |e| "#{e['title']}: #{e['detail']}" }.join('; ')

APP='6808960319'
def show(label, v) puts "  #{label.ljust(22)} #{v.nil? || v.to_s.empty? ? '(empty)' : v.to_s[0,90].gsub("\n",' ')}" end
_, d = api('GET', "apps/#{APP}?include=appInfos")
a = d['data']['attributes'] rescue {}
puts "APP: #{a['name']} | sku=#{a['sku']} | primaryLocale=#{a['primaryLocale']} | contentRights=#{a['contentRightsDeclaration']}"
_, inf = api('GET', "apps/#{APP}/appInfos")
(inf['data']||[]).each do |i|
  at=i['attributes']; puts "APPINFO #{i['id']}: state=#{at['appStoreState']||at['state']} ageRating=#{at['appStoreAgeRating']} kids=#{at['kidsAgeBand']}"
  _, cat = api('GET', "appInfos/#{i['id']}?include=primaryCategory,secondaryCategory")
  (cat['included']||[]).each { |c| puts "  category: #{c['id']}" }
  _, loc = api('GET', "appInfos/#{i['id']}/appInfoLocalizations")
  (loc['data']||[]).each do |l|
    la=l['attributes']; puts "  locale #{la['locale']}:"; show('name',la['name']); show('subtitle',la['subtitle']); show('privacyPolicyUrl',la['privacyPolicyUrl'])
  end
end
_, vs = api('GET', "apps/#{APP}/appStoreVersions?filter[platform]=IOS&limit=3")
(vs['data']||[]).each do |v|
  va=v['attributes']; puts "VERSION #{va['versionString']} (#{v['id']}): state=#{va['appStoreState']||va['appVersionState']} releaseType=#{va['releaseType']} copyright=#{va['copyright']}"
  _, b = api('GET', "appStoreVersions/#{v['id']}/build"); puts "  build attached: #{b.dig('data','attributes','version') || '(none)'}"
  _, rd = api('GET', "appStoreVersions/#{v['id']}/appStoreReviewDetail")
  r = rd.dig('data','attributes') || {}
  puts "  review contact: #{r['contactFirstName']} #{r['contactLastName']} #{r['contactPhone']} #{r['contactEmail']} demo=#{r['demoAccountRequired']}"
  show('  review notes', r['notes'])
  _, vl = api('GET', "appStoreVersions/#{v['id']}/appStoreVersionLocalizations")
  (vl['data']||[]).each do |l|
    la=l['attributes']; puts "  locale #{la['locale']}:"
    show('description', la['description']); show('keywords', la['keywords']); show('whatsNew', la['whatsNew']); show('promotionalText', la['promotionalText']); show('supportUrl', la['supportUrl']); show('marketingUrl', la['marketingUrl'])
    _, ss = api('GET', "appStoreVersionLocalizations/#{l['id']}/appScreenshotSets")
    (ss['data']||[]).each do |s|
      _, shots = api('GET', "appScreenshotSets/#{s['id']}/appScreenshots")
      puts "    screenshots #{s.dig('attributes','screenshotDisplayType')}: #{(shots['data']||[]).size}"
    end
    puts "    screenshots: (no sets)" if (ss['data']||[]).empty?
  end
end
puts "READ-ONLY, no writes issued"
