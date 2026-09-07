# Sets the App Store version copyright line (required before submission). Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH.
require 'openssl'; require 'json'; require 'net/http'; require 'base64'
KEY_ID = ENV.fetch('ASC_KEY_ID'); ISSUER = ENV.fetch('ASC_ISSUER_ID'); KEY_PATH = ENV.fetch('ASC_KEY_PATH')
VERSION_ID = ENV.fetch('ASC_VERSION_ID', 'b140d279-61fb-44da-b050-809e3325d701')
COPYRIGHT = ENV.fetch('ASC_COPYRIGHT', "#{Time.now.year} Bram Pek")
def b64(s) = Base64.urlsafe_encode64(s, padding: false)
def jwt
  key = OpenSSL::PKey::EC.new(File.read(KEY_PATH)); now = Time.now.to_i
  header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }.to_json)
  payload = b64({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }.to_json)
  seq = OpenSSL::ASN1.decode(key.sign(OpenSSL::Digest.new('SHA256'), "#{header}.#{payload}"))
  r = seq.value[0].value.to_s(2).rjust(32, "\0")[-32..]; s = seq.value[1].value.to_s(2).rjust(32, "\0")[-32..]
  "#{header}.#{payload}.#{b64(r + s)}"
end
uri = URI("https://api.appstoreconnect.apple.com/v1/appStoreVersions/#{VERSION_ID}")
req = Net::HTTP::Patch.new(uri); req['Authorization'] = "Bearer #{jwt}"; req['Content-Type'] = 'application/json'
req.body = { data: { type: 'appStoreVersions', id: VERSION_ID, attributes: { copyright: COPYRIGHT } } }.to_json
res = Net::HTTP.start(uri.host, 443, use_ssl: true) { |h| h.request(req) }
body = JSON.parse(res.body) rescue {}
puts "copyright: #{res.code} #{body.dig('data', 'attributes', 'copyright') || (body['errors'] || []).map { |e| e['detail'] }.join('; ')}"
