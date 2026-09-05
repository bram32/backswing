# Adds the TestFlight tester through the public App Store Connect API (no fastlane/spaceship).
# Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Prints a summary, never the key.
require 'openssl'; require 'json'; require 'net/http'; require 'base64'
KEY_ID = ENV.fetch('ASC_KEY_ID'); ISSUER = ENV.fetch('ASC_ISSUER_ID'); KEY_PATH = ENV.fetch('ASC_KEY_PATH')
BUNDLE = 'com.brampek.backswing'; EMAIL = 'brampek@gmail.com'; FIRST = 'Bram'; LAST = 'Pek'
INTERNAL = 'Backswing internal'; EXTERNAL = 'Backswing testers'
def b64(s) = Base64.urlsafe_encode64(s, padding: false)
def jwt
  key = OpenSSL::PKey::EC.new(File.read(KEY_PATH)); now = Time.now.to_i
  header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }.to_json)
  payload = b64({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }.to_json)
  der = key.sign(OpenSSL::Digest.new('SHA256'), "#{header}.#{payload}")
  seq = OpenSSL::ASN1.decode(der)
  r = seq.value[0].value.to_s(2).rjust(32, "\0")[-32..]; s = seq.value[1].value.to_s(2).rjust(32, "\0")[-32..]
  "#{header}.#{payload}.#{b64(r + s)}"
end
def api(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com/v1/#{path}")
  req = { 'GET' => Net::HTTP::Get, 'POST' => Net::HTTP::Post, 'PATCH' => Net::HTTP::Patch, 'DELETE' => Net::HTTP::Delete }[method].new(uri)
  req['Authorization'] = "Bearer #{jwt}"; req['Content-Type'] = 'application/json'
  req.body = body.to_json if body
  res = Net::HTTP.start(uri.host, 443, use_ssl: true) { |h| h.request(req) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  [res.code.to_i, data]
end
def errs(d) = (d['errors'] || []).map { |e| "#{e['title']}: #{e['detail']}" }.join('; ')

code, d = api('GET', "apps?filter[bundleId]=#{BUNDLE}")
app = d.dig('data', 0) or abort("app not found (#{code}) #{errs(d)}")
app_id = app['id']; puts "app: #{app.dig('attributes', 'name')} (#{app_id})"

code, d = api('GET', "builds?filter[app]=#{app_id}&sort=-uploadedDate&limit=3")
builds = d['data'] || []
builds.each { |b| puts "build: #{b.dig('attributes', 'version')} state=#{b.dig('attributes', 'processingState')} expired=#{b.dig('attributes', 'expired')} id=#{b['id']}" }
build_id = builds.first && builds.first['id']

code, d = api('GET', "betaGroups?filter[app]=#{app_id}")
groups = d['data'] || []
groups.each { |g| puts "group: #{g.dig('attributes', 'name')} internal=#{g.dig('attributes', 'isInternalGroup')} allBuilds=#{g.dig('attributes', 'hasAccessToAllBuilds')} id=#{g['id']}" }
internal = groups.find { |g| g.dig('attributes', 'isInternalGroup') }
unless internal
  code, d = api('POST', 'betaGroups', { data: { type: 'betaGroups', attributes: { name: INTERNAL, isInternalGroup: true, hasAccessToAllBuilds: true },
                                                 relationships: { app: { data: { type: 'apps', id: app_id } } } } })
  if code == 201 then internal = d['data']; puts "created internal group #{INTERNAL} (#{internal['id']})"
  else puts "internal group create failed (#{code}): #{errs(d)}" end
end

code, d = api('GET', "betaTesters?filter[email]=#{EMAIL}")
tester = d.dig('data', 0)
puts tester ? "tester exists: #{EMAIL} (#{tester['id']})" : "tester not found by email"

done = false
if internal
  gid = internal['id']
  if tester
    code, d = api('POST', "betaGroups/#{gid}/relationships/betaTesters", { data: [{ type: 'betaTesters', id: tester['id'] }] })
    puts "add existing tester to internal group: #{code} #{errs(d)}"
    done = code.between?(200, 204)
  end
  unless done
    code, d = api('POST', 'betaTesters', { data: { type: 'betaTesters', attributes: { email: EMAIL, firstName: FIRST, lastName: LAST },
                                                  relationships: { betaGroups: { data: [{ type: 'betaGroups', id: gid }] } } } })
    puts "create tester in internal group: #{code} #{errs(d)}"
    done = code == 201
  end
  if done && !internal.dig('attributes', 'hasAccessToAllBuilds') && build_id
    code, d = api('POST', "betaGroups/#{gid}/relationships/builds", { data: [{ type: 'builds', id: build_id }] })
    puts "assign latest build to internal group: #{code} #{errs(d)}"
  end
  if done
    code, d = api('GET', "betaGroups/#{gid}/betaTesters")
    puts "internal group members: #{(d['data'] || []).map { |t| t.dig('attributes', 'email') }.join(', ')}"
  end
end

unless done
  ext = groups.find { |g| g.dig('attributes', 'name') == EXTERNAL } || groups.find { |g| !g.dig('attributes', 'isInternalGroup') }
  abort('no external group available either') unless ext
  gid = ext['id']
  if tester
    code, d = api('POST', "betaGroups/#{gid}/relationships/betaTesters", { data: [{ type: 'betaTesters', id: tester['id'] }] })
    puts "add existing tester to external group: #{code} #{errs(d)}"; done = code.between?(200, 204)
  end
  unless done
    code, d = api('POST', 'betaTesters', { data: { type: 'betaTesters', attributes: { email: EMAIL, firstName: FIRST, lastName: LAST },
                                                  relationships: { betaGroups: { data: [{ type: 'betaGroups', id: gid }] } } } })
    puts "create tester in external group: #{code} #{errs(d)}"; done = code == 201
  end
  if done && build_id
    code, d = api('POST', "betaGroups/#{gid}/relationships/builds", { data: [{ type: 'builds', id: build_id }] })
    puts "assign latest build to external group (needs beta review): #{code} #{errs(d)}"
  end
end
puts(done ? 'TESTER_OK' : 'TESTER_FAILED')
