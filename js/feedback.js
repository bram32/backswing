/* Uncoil — feedback module. Registers its view through window.FR (see js/app.js plugin API).
   One anonymous message to the maker of the app, relayed by functions/api/feedback.js.

   Nothing here reads the store and nothing is written to it: the draft lives in this closure for
   as long as the tab is open and is gone the moment it is not. The only bytes that ever leave the
   device are the ones in the textarea, the category, and - if the golfer ticks the box - a single
   version line they can read in full before they send it. */

(() => {
  const FR = window.FR;
  if (!FR || !FR.registerView) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => FR.esc(s);

  /* Absolute on purpose. Inside the iOS wrapper the page is served from a custom scheme, and the
     installed PWA can be opened straight from the cache, so a relative "/api/..." resolves to
     nothing that exists in either. This is the one URL the app ever calls. */
  const ENDPOINT = 'https://backswing-dkg.pages.dev/api/feedback';
  const APP_VERSION = '1.0.0'; /* keep in step with MARKETING_VERSION in ios/project.yml */
  const MAX = 2000;

  const NAV_ICON = '<svg viewBox="0 0 24 24"><path d="M20 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8 8h8M8 11.5h5"/></svg>';
  const SEND_ICON = '<svg viewBox="0 0 24 24"><path d="M21 3L10.5 13.5"/><path d="M21 3l-6.6 18-3.9-7.5L3 9.6z"/></svg>';

  const CATEGORIES = [
    { id: 'bug', label: 'Something is broken' },
    { id: 'idea', label: 'An idea' },
    { id: 'content', label: 'The exercises or advice' },
    { id: 'other', label: 'Something else' }
  ];

  const state = { category: 'bug', message: '', context: false, sent: false, busy: false };

  /* The iOS bridge sets both of these; either one on its own is enough to be sure. */
  function isNativeApp() {
    try {
      if (window.FreeRelief && (window.FreeRelief.isNative || window.FreeRelief.native)) return true;
      return document.documentElement.getAttribute('data-native') === 'ios';
    } catch (e) { return false; }
  }

  /* Deliberately coarse and deliberately visible: the golfer reads this exact string on screen
     before deciding to attach it. navigator.platform is a family name ("iPhone", "MacIntel"), not
     a device identifier, and nothing else about the browser goes with it. */
  function contextLine() {
    let platform = '';
    try { platform = String(navigator.platform || '').trim(); } catch (e) { platform = ''; }
    return `Uncoil ${APP_VERSION} · ${isNativeApp() ? 'iOS app' : 'web'} · ${platform || 'unknown device'}`;
  }

  function setStatus(el, text, tone) {
    const s = $('#fb-status', el);
    if (!s) return;
    s.textContent = text || '';
    s.className = 'fb-status small' + (tone ? ' is-' + tone : '');
  }

  function renderSent(el) {
    el.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Thank you</h1>
          <p>Your message is on its way. It went without a name, an address or an identifier attached.</p>
        </div>
      </div>
      <div class="fb-done">
        <p><b>What happens now.</b> It lands in the maker's inbox as an ordinary e-mail. Because nothing identified you, there is no way to reply — fixes and changes show up in the next release instead.</p>
        <div class="fb-actions">
          <button class="btn" id="fb-again" type="button">Send another</button>
          <a class="btn btn-ghost" href="#home">Back to home</a>
        </div>
      </div>`;
    const again = $('#fb-again', el);
    if (again) again.addEventListener('click', () => { state.sent = false; FR.render(); });
  }

  function render(el) {
    if (state.sent) return renderSent(el);

    el.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Feedback</h1>
          <p>Anonymous. Nothing is sent until you press Send, and nothing identifies you.</p>
        </div>
      </div>

      <div class="fb">
        <form class="fb-form" id="fb-form" novalidate>
          <div class="field">
            <b id="fb-cat-label">What is this about?</b>
            <div class="chips" role="group" aria-labelledby="fb-cat-label">
              ${CATEGORIES.map(c => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${state.category === c.id ? 'true' : 'false'}">${esc(c.label)}</button>`).join('')}
            </div>
          </div>

          <div class="field">
            <label for="fb-msg">Your message</label>
            <textarea id="fb-msg" class="fb-msg" maxlength="${MAX}" rows="9" spellcheck="true"
              placeholder="What happened, what you expected, or what you would change. If it is a bug, the screen you were on and what you tapped helps most."></textarea>
            <div class="fb-count"><span id="fb-count">0</span> / ${MAX}</div>
          </div>

          <label class="fb-check" for="fb-ctx">
            <input type="checkbox" id="fb-ctx"${state.context ? ' checked' : ''}>
            <span>
              <b>Include app version and device type</b>
              <small>Adds one line — <code>${esc(contextLine())}</code> — and nothing else. Off by default.</small>
            </span>
          </label>

          <div class="fb-hp" aria-hidden="true"><label>Website<input type="text" id="fb-website" name="website" tabindex="-1" autocomplete="off"></label></div>

          <div class="fb-actions">
            <button class="btn btn-primary btn-lg" id="fb-send" type="submit">${SEND_ICON} Send</button>
            <p class="fb-status small" id="fb-status" role="status" aria-live="polite"></p>
          </div>
        </form>

        <aside class="fb-aside">
          <div class="plan-section">
            <h3>What gets sent</h3>
            <ul class="plan-list">
              <li>The message you type, and the category above.</li>
              <li>The version line, only if you tick the box.</li>
              <li>Nothing else. No name, no e-mail address, no IP address, no plan, no log, no streak, no settings.</li>
            </ul>
            <p class="small muted">Your message is passed to an e-mail relay that turns it into an e-mail. Because no address travels with it, we cannot write back — put everything we would need into the message itself. <a href="privacy.html">The detail is in the privacy policy</a>.</p>
          </div>
        </aside>
      </div>`;

    const form = $('#fb-form', el);
    const msg = $('#fb-msg', el);
    const count = $('#fb-count', el);
    const ctx = $('#fb-ctx', el);

    msg.value = state.message;
    count.textContent = String(state.message.length);

    $$('[data-cat]', el).forEach(b => b.addEventListener('click', () => {
      state.category = b.dataset.cat;
      $$('[data-cat]', el).forEach(o => o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
    }));

    msg.addEventListener('input', () => {
      state.message = msg.value;
      count.textContent = String(msg.value.length);
      count.parentElement.classList.toggle('is-full', msg.value.length >= MAX);
      setStatus(el, '');
    });

    ctx.addEventListener('change', () => { state.context = ctx.checked; });

    form.addEventListener('submit', (e) => { e.preventDefault(); send(el); });
  }

  async function send(el) {
    if (state.busy) return;
    const message = String(state.message || '').trim();
    if (!message) {
      FR.toast('Write a message first.');
      setStatus(el, 'The message is empty.', 'bad');
      const msg = $('#fb-msg', el); if (msg) msg.focus();
      return;
    }
    if (message.length > MAX) { setStatus(el, `That is longer than ${MAX} characters.`, 'bad'); return; }

    const hp = $('#fb-website', el);
    const btn = $('#fb-send', el);
    state.busy = true;
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
    setStatus(el, 'Sending…');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      state.busy = false;
      if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
      FR.toast('You are offline.');
      setStatus(el, 'You are offline. Your message is still here — press Send again once you have a connection.', 'bad');
      return;
    }

    const body = { category: state.category, message, website: hp ? hp.value : '' };
    if (state.context) body.context = contextLine();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* No cookies, no credentials: the endpoint allows any origin precisely because there is
           nothing to authenticate, and sending credentials would break that. */
        credentials: 'omit',
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok) {
        state.sent = true;
        state.message = '';
        state.busy = false;
        FR.toast('Sent. Thank you.');
        FR.render();
        return;
      }
      throw new Error((data && data.reason) || ('http_' + res.status));
    } catch (e) {
      state.busy = false;
      if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
      FR.toast('Could not send that.');
      setStatus(el, 'That did not go through. Your message is still here — try again in a moment.', 'bad');
    }
  }

  FR.registerView('feedback', {
    render,
    nav: { label: 'Feedback', icon: NAV_ICON, primary: false }
  });

  /* A quiet way in from the launch screen. Done from here, through the public route hook, so
     js/growth.js stays untouched and the link disappears cleanly if this file is ever dropped. */
  FR.on('route', (r) => {
    if (r !== 'feedback') { state.sent = false; }
    if (r !== 'home') return;
    const quick = document.querySelector('.home-quick');
    if (!quick || quick.parentElement.querySelector('.fb-homelink')) return;
    const p = document.createElement('p');
    p.className = 'fb-homelink';
    p.innerHTML = `<a href="#feedback">${NAV_ICON}Something to tell us? Send anonymous feedback</a>`;
    quick.insertAdjacentElement('afterend', p);
  });
})();
