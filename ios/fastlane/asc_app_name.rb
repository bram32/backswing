# Reads the App Store Connect record for the app, lists recent builds, and renames the
# record to NEW_NAME when it differs. Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH.
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

_, d = api('GET', "apps?filter[bundleId]=#{BUNDLE}")
app = d.dig('data', 0) or abort('app record not found')
app_id = app['id']; puts "record: '#{app.dig('attributes', 'name')}' (#{app_id}) bundle #{BUNDLE}"
_, d = api('GET', "builds?filter[app]=#{app_id}&sort=-uploadedDate&limit=3")
(d['data'] || []).each { |b| puts "build #{b.dig('attributes', 'version')}: #{b.dig('attributes', 'processingState')}, uploaded #{b.dig('attributes', 'uploadedDate')}" }
_, d = api('GET', "betaGroups?filter[app]=#{app_id}")
(d['data'] || []).each { |g| puts "group: #{g.dig('attributes', 'name')} internal=#{g.dig('attributes', 'isInternalGroup')}" }

if app.dig('attributes', 'name') == NEW_NAME
  puts "name already '#{NEW_NAME}'"
else
  _, d = api('GET', "apps/#{app_id}/appInfos")
  infos = d['data'] || []
  renamed = false
  infos.each do |info|
    _, l = api('GET', "appInfos/#{info['id']}/appInfoLocalizations")
    (l['data'] || []).each do |loc|
      next unless loc.dig('attributes', 'locale') == 'en-US'
      code, r = api('PATCH', "appInfoLocalizations/#{loc['id']}", { data: { type: 'appInfoLocalizations', id: loc['id'], attributes: { name: NEW_NAME } } })
      puts "rename via appInfo #{info['id']} (#{info.dig('attributes', 'appStoreState') || info.dig('attributes', 'state')}): #{code} #{errs(r)}"
      renamed ||= code == 200
    end
  end
  _, d = api('GET', "apps/#{app_id}")
  puts "record name now: '#{d.dig('data', 'attributes', 'name')}' (#{renamed ? 'RENAMED' : 'UNCHANGED'})"
end
