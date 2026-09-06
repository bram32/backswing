# Attaches a processed TestFlight build to App Store version 1.0.0.
#   set -a; source .env; set +a; BUILD_NUMBER=8 ruby ios/fastlane/asc_attach_build.rb
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
APP='6808960319'; VER='b140d279-61fb-44da-b050-809e3325d701'
want = (ENV['BUILD_NUMBER'] || '7').to_s
_, b = api('GET', "builds?filter[app]=#{APP}&filter[version]=#{want}&limit=1")
bd = b.dig('data',0) or abort("build #{want} not found")
st = bd.dig('attributes','processingState'); puts "build #{want} (#{bd['id']}): #{st}"
abort('not processed yet') unless st == 'VALID'
c, r = api('PATCH', "appStoreVersions/#{VER}/relationships/build", { data: { type: 'builds', id: bd['id'] } })
puts "attach build #{want} to version 1.0.0: HTTP #{c} #{errs(r)}"
_, chk = api('GET', "appStoreVersions/#{VER}/build"); puts "version 1.0.0 now has build: #{chk.dig('data','attributes','version') || '(none)'}"
