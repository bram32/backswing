# Sets the App Store version's Support URL (and leaves the Marketing URL alone). Apple requires a
# reachable support page; ours is the anonymous feedback form, so no personal address is published.
# Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Optional: ASC_VERSION_ID, ASC_SUPPORT_URL.
require 'openssl'; require 'json'; require 'net/http'; require 'base64'
KEY_ID = ENV.fetch('ASC_KEY_ID'); ISSUER = ENV.fetch('ASC_ISSUER_ID'); KEY_PATH = ENV.fetch('ASC_KEY_PATH')
VERSION_ID = ENV.fetch('ASC_VERSION_ID', 'b140d279-61fb-44da-b050-809e3325d701')
SUPPORT_URL = ENV.fetch('ASC_SUPPORT_URL', 'https://backswing-dkg.pages.dev/feedback')
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
  req = { 'GET' => Net::HTTP::Get, 'PATCH' => Net::HTTP::Patch }[method].new(uri)
  req['Authorization'] = "Bearer #{jwt}"; req['Content-Type'] = 'application/json'; req.body = body.to_json if body
  res = Net::HTTP.start(uri.host, 443, use_ssl: true) { |h| h.request(req) }
  [res.code.to_i, res.body.to_s.empty? ? {} : JSON.parse(res.body)]
end
def errs(d) = (d['errors'] || []).map { |e| "#{e['title']}: #{e['detail']}" }.join('; ')

_, d = api('GET', "appStoreVersions/#{VERSION_ID}/appStoreVersionLocalizations")
loc = (d['data'] || []).find { |l| l.dig('attributes', 'locale') == 'en-US' } or abort("en-US localization not found: #{errs(d)}")
a = loc['attributes']
puts "before: support=#{a['supportUrl'].inspect} marketing=#{a['marketingUrl'].inspect}"

# Only supportUrl is written. marketingUrl is deliberately absent from the payload so App Store
# Connect leaves whatever is there untouched.
code, r = api('PATCH', "appStoreVersionLocalizations/#{loc['id']}",
              { data: { type: 'appStoreVersionLocalizations', id: loc['id'], attributes: { supportUrl: SUPPORT_URL } } })
puts "patch: #{code} #{errs(r)}"
_, d = api('GET', "appStoreVersions/#{VERSION_ID}/appStoreVersionLocalizations")
loc = (d['data'] || []).find { |l| l.dig('attributes', 'locale') == 'en-US' }
a = loc ? loc['attributes'] : {}
puts "after:  support=#{a['supportUrl'].inspect} marketing=#{a['marketingUrl'].inspect}"
