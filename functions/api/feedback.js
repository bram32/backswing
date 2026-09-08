/* Uncoil — anonymous feedback relay (Cloudflare Pages Function, POST /api/feedback).
 *
 * The whole point of this endpoint is that the destination address is never in the app, the site
 * or the repository: it lives in the FEEDBACK_TO secret on the Pages project and is read here,
 * server side, only long enough to build the relay URL. Nothing about the sender is added on the
 * way through — no IP, no user agent, no headers, no timestamp beyond what e-mail adds itself.
 * Only the fields the golfer actually typed are forwarded, so a message genuinely cannot be traced
 * back to a person, and the privacy page can say exactly that.
 *
 * The iOS wrapper serves the same bundle from a custom scheme (freerelief://app), so its requests
 * arrive cross-origin with an Origin of `null` or the custom scheme. That is why the CORS headers
 * allow any origin and why credentials are never involved: `*` and cookies are mutually exclusive,
 * and there is nothing here worth authenticating anyway.
 *
 * Two relays, picked at runtime:
 *
 *   WEB3FORMS_KEY set  ->  api.web3forms.com. Key-authenticated, so it does not care which IP the
 *                          request comes from, and the destination address lives in the Web3Forms
 *                          account rather than in a URL. This is the path to be on.
 *   otherwise          ->  formsubmit.co. Works from a browser, but it rate-limits by source IP
 *                          and every Cloudflare Worker in the world shares an egress IP with every
 *                          other one, so in practice it answers 429 from here. Kept as the
 *                          fallback because it needs no account, and because a 429 is reported
 *                          honestly rather than swallowed.
 */

const CATEGORIES = new Set(['bug', 'idea', 'content', 'other']);
const ALLOWED_KEYS = new Set(['category', 'message', 'context', 'website']);
const MAX_MESSAGE = 2000;
const MAX_CONTEXT = 200;
const RELAY_TIMEOUT_MS = 30000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', ...CORS } });
}

/* Both relays answer 200 with a JSON body whose `success` field carries the real verdict, so the
   HTTP status alone is not enough to call a message delivered. The body itself is never returned
   to the caller or logged: an error page from either service can echo the destination address. */
async function verdict(res) {
  let payload = null;
  try { payload = JSON.parse(await res.text()); } catch (e) { payload = null; }
  const success = payload && (payload.success === true || payload.success === 'true');
  const message = payload && typeof payload.message === 'string' ? payload.message : '';
  return { success, message };
}

async function relayViaWeb3Forms(key, fields) {
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_key: key,
      subject: fields.subject,
      from_name: 'Uncoil feedback',
      message: fields.message,
      category: fields.category,
      context: fields.context,
      botcheck: '',
    }),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  const { success } = await verdict(res);
  if (success) return { ok: true };
  return { ok: false, reason: `relay_${res.status}` };
}

async function relayViaFormSubmit(to, fields) {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      /* FormSubmit refuses anything that does not look like a submission from a hosted page, and
         answers "open this page through a web server" without them. This is our own site, not the
         sender's, so it says nothing about who wrote the message. */
      Origin: 'https://backswing-dkg.pages.dev',
      Referer: 'https://backswing-dkg.pages.dev/feedback',
    },
    body: JSON.stringify({
      _subject: fields.subject,
      _template: 'box',
      _captcha: 'false',
      message: fields.message,
      category: fields.category,
      context: fields.context,
    }),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  const { success, message } = await verdict(res);
  if (success) return { ok: true };
  if (res.status === 429 || /rate limit/i.test(message)) return { ok: false, reason: 'relay_rate_limited' };
  /* First ever submission to a given address: FormSubmit e-mails an "Activate Form" link and does
     not deliver until it is clicked. The message is genuinely not through, so say so. */
  if (/activat/i.test(message)) return { ok: false, reason: 'relay_needs_activation' };
  return { ok: false, reason: `relay_${res.status}` };
}

export async function onRequestPost({ request, env }) {
  const to = (env && env.FEEDBACK_TO ? String(env.FEEDBACK_TO) : '').trim();
  const key = (env && env.WEB3FORMS_KEY ? String(env.WEB3FORMS_KEY) : '').trim();
  if (!to && !key) return json({ ok: false, reason: 'not_configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, reason: 'bad_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, reason: 'bad_body' }, 400);
  for (const key2 of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key2)) return json({ ok: false, reason: 'unexpected_field' }, 400);
  }

  /* Honeypot: a real person never sees this field, so anything in it is a bot. Answer 400 rather
     than pretending to succeed — there is no human on the other end to mislead. */
  if (body.website !== undefined && String(body.website).trim() !== '') {
    return json({ ok: false, reason: 'rejected' }, 400);
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!CATEGORIES.has(category)) return json({ ok: false, reason: 'bad_category' }, 400);

  if (typeof body.message !== 'string') return json({ ok: false, reason: 'bad_message' }, 400);
  const message = body.message.trim();
  if (message.length < 1 || message.length > MAX_MESSAGE) return json({ ok: false, reason: 'bad_message' }, 400);

  /* Context is present only when the golfer ticked the box; it is a short, self-describing line
     (app version, web or iOS app, platform family) that the client builds and shows in full
     before it can be attached. */
  let context = '';
  if (body.context !== undefined && body.context !== null) {
    if (typeof body.context !== 'string') return json({ ok: false, reason: 'bad_context' }, 400);
    context = body.context.trim().slice(0, MAX_CONTEXT);
  }

  const fields = {
    subject: `Uncoil feedback: ${category}`,
    message,
    category,
    context: context || 'not included',
  };

  let result;
  try {
    result = key ? await relayViaWeb3Forms(key, fields) : await relayViaFormSubmit(to, fields);
  } catch (e) {
    return json({ ok: false, reason: 'relay_unreachable' }, 502);
  }
  return result.ok ? json({ ok: true }) : json(result, 502);
}
