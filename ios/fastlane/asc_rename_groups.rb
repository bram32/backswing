# Renames the TestFlight beta groups (edit RENAMES). Idempotent.
#   set -a; source .env; set +a; ruby ios/fastlane/asc_rename_groups.rb
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

RENAMES = { 'Backswing internal' => 'Free Relief internal', 'Backswing testers' => 'Free Relief testers' }
_, d = api('GET', "apps?filter[bundleId]=#{BUNDLE}")
app = d.dig('data', 0) or abort('app record not found')
app_id = app['id']
puts "app: '#{app.dig('attributes','name')}' (#{app_id})"
_, d = api('GET', "betaGroups?filter[app]=#{app_id}")
(d['data'] || []).each do |g|
  name = g.dig('attributes','name')
  want = RENAMES[name]
  if want.nil?
    puts "  keep   '#{name}'"
    next
  end
  code, r = api('PATCH', "betaGroups/#{g['id']}", { data: { type: 'betaGroups', id: g['id'], attributes: { name: want } } })
  puts "  rename '#{name}' -> '#{want}': HTTP #{code} #{errs(r)}"
end
_, d = api('GET', "betaGroups?filter[app]=#{app_id}")
puts "now: " + (d['data'] || []).map { |g| "'#{g.dig('attributes','name')}'" }.join(', ')
