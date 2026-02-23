'use strict';

/* ── CONSTANTS ───────────────────────────────────────────── */
const API          = '';
const FILE_PREFIX  = '024b4faf-5861-4f6b-840c-8f9b4cb660b1_';
const DEFAULT_MODEL = 'moonshotai/kimi-k2-instruct-0905';

const HIDDEN_MODELS = new Set([
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'canopylabs/orpheus-v1-english',
]);

/* ── STATE ───────────────────────────────────────────────── */
let token        = localStorage.getItem('at')  || null;
let rtoken       = localStorage.getItem('rt')  || null;
let convId       = null;
let upType       = 'doc';
let selFile      = null;
let signupStep   = 'send';
let resetStep    = 'send';
let signupEmail  = null;
let busy         = false;
let otpTimer     = null;
let convMap      = {};
let toastTimer   = null;
let selectedModel = localStorage.getItem('nexus_model') || DEFAULT_MODEL;
let availableModels = [];

/* ═══════════════════════════════════════════════════════════
   MODELS
   ═══════════════════════════════════════════════════════════ */
async function loadModels() {
  try {
    const r = await fetch(API + '/api/v1/models/get_models');
    if (!r.ok) throw 0;
    availableModels = await r.json();
  } catch {
    availableModels = [{ id: DEFAULT_MODEL, name: 'Kimi K2' }];
  }
  renderModelBar(availableModels.filter(m => !HIDDEN_MODELS.has(m.id)));
}

function renderModelBar(models) {
  const bar = document.getElementById('model-bar');
  bar.querySelectorAll('.model-chip').forEach(el => el.remove());

  if (!models.find(m => m.id === selectedModel)) {
    selectedModel = models[0]?.id || DEFAULT_MODEL;
    localStorage.setItem('nexus_model', selectedModel);
  }

  models.forEach(m => {
    const btn = document.createElement('button');
    btn.className  = 'model-chip' + (m.id === selectedModel ? ' active' : '');
    btn.dataset.id = m.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(m.id === selectedModel));
    btn.innerHTML  = '<span class="model-chip-dot" aria-hidden="true"></span>' + esc(m.name);
    btn.addEventListener('click', () => selectModel(m.id));
    bar.appendChild(btn);
  });
}

function selectModel(id) {
  selectedModel = id;
  localStorage.setItem('nexus_model', id);
  document.querySelectorAll('.model-chip').forEach(el => {
    const on = el.dataset.id === id;
    el.classList.toggle('active', on);
    el.setAttribute('aria-checked', String(on));
  });
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR (MOBILE)
   ═══════════════════════════════════════════════════════════ */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await loadModels();
  if (token) { showApp(); await loadConvs(); }
  else { document.getElementById('l-email').focus(); }
});

// Escape key: close sidebar or topmost modal
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const openModal = [...document.querySelectorAll('.modal-bg.open')].pop();
  if (openModal) { openModal.classList.remove('open'); return; }
  closeSidebar();
});

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */
function handleModalBgClick(event, id) {
  if (event.target.id === id) closeModal(id);
}

function switchTab(t) {
  ['login','signup','reset'].forEach((x, i) => {
    document.getElementById('tab-' + x).style.display = x === t ? '' : 'none';
    const btn = document.querySelectorAll('.seg-btn')[i];
    btn.classList.toggle('on', x === t);
    btn.setAttribute('aria-selected', String(x === t));
  });
  const labels = {
    login:  ['Welcome back',     'Sign in to continue'],
    signup: ['Create account',   'Get started for free'],
    reset:  ['Reset password',   'Enter your email'],
  };
  document.getElementById('auth-heading').textContent  = labels[t][0];
  document.getElementById('auth-subtext').textContent  = labels[t][1];

  if (t === 'signup') {
    document.getElementById('s-step-email').style.display = '';
    document.getElementById('s-step-otp').style.display   = 'none';
    ['s-email','s-pass','s-pass2','s-otp'].forEach(id => { document.getElementById(id).value = ''; });
    clrErr('s-err'); clrErr('s-err2');
    signupStep = 'send'; clearInterval(otpTimer);
  }
  if (t === 'reset') {
    resetStep = 'send';
    ['r-otp-group','r-pass-group','r-pass2-group'].forEach(id => { document.getElementById(id).style.display = 'none'; });
    document.getElementById('r-btn').textContent = 'Send OTP →';
    clrErr('r-err');
  }
}

function startOtpTimer() {
  let secs = 300;
  const btn = document.getElementById('s-resend-btn');
  const el  = document.getElementById('s-timer');
  btn.disabled = true;
  clearInterval(otpTimer);
  otpTimer = setInterval(() => {
    secs--;
    const m = Math.floor(secs / 60), s = secs % 60;
    el.textContent = '(' + m + ':' + String(s).padStart(2, '0') + ')';
    if (secs <= 0) { clearInterval(otpTimer); btn.disabled = false; el.textContent = ''; }
  }, 1000);
}

function togglePw(id, btn) {
  const inp  = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  btn.innerHTML = show
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
       </svg>`;
}

function goBackToEmail() {
  document.getElementById('s-step-otp').style.display   = 'none';
  document.getElementById('s-step-email').style.display = '';
  document.getElementById('s-otp').value = '';
  clrErr('s-err2');
  signupStep = 'send';
  clearInterval(otpTimer);
}

async function handleLogin() {
  clrErr('l-err');
  const email = v('l-email'), password = v('l-pass');
  if (!email || !password) { setErr('l-err', 'Please fill all fields'); return; }
  const btn = document.querySelector('#tab-login .btn-main');
  setLoading(btn, 'Signing in…');
  try {
    const d = await apiPost('/api/v1/authentication/login', { email, password });
    saveTokens(d.access_token, d.refresh_token);
    showApp(); await loadConvs();
  } catch(e) { setErr('l-err', e.message); }
  finally { resetBtn(btn, 'Sign in →'); }
}

async function handleSignup() {
  if (signupStep === 'send') {
    clrErr('s-err');
    const email = v('s-email'), password = v('s-pass'), pass2 = v('s-pass2');
    if (!email || !password || !pass2) { setErr('s-err', 'Please fill all fields'); return; }
    if (password !== pass2)  { setErr('s-err', 'Passwords do not match'); return; }
    if (password.length < 8) { setErr('s-err', 'Minimum 8 characters'); return; }
    const btn = document.querySelector('#s-step-email .btn-main');
    setLoading(btn, 'Sending…');
    try {
      await apiPost('/api/v1/authentication/signup/send-otp', { email, password });
      signupEmail = email;
      document.getElementById('s-step-email').style.display = 'none';
      document.getElementById('s-step-otp').style.display   = '';
      document.getElementById('s-email-display').textContent = email;
      signupStep = 'verify';
      startOtpTimer();
      toast('OTP sent to your email');
    } catch(e) { setErr('s-err', e.message); }
    finally { resetBtn(btn, 'Send OTP →'); }
  } else {
    clrErr('s-err2');
    const otp = v('s-otp');
    if (!otp) { setErr('s-err2', 'Please enter the OTP'); return; }
    const btn = document.querySelector('#s-step-otp .btn-main');
    setLoading(btn, 'Verifying…');
    try {
      const d = await apiPost('/api/v1/authentication/signup/verify-otp/' + signupEmail, { otp });
      saveTokens(d.access_token, d.refresh_token);
      showApp(); await loadConvs();
    } catch(e) { setErr('s-err2', e.message); }
    finally { resetBtn(btn, 'Verify →'); }
  }
}

async function resendOTP() {
  if (!signupEmail) { toast('No email on record — go back and try again'); return; }
  try {
    const password = document.getElementById('s-pass').value;
    await apiPost('/api/v1/authentication/signup/send-otp', { email: signupEmail, password });
    startOtpTimer();
    toast('OTP resent');
  } catch(e) { toast('Failed to resend: ' + e.message); }
}

async function handleReset() {
  clrErr('r-err');
  const email = v('r-email');
  const btn   = document.getElementById('r-btn');

  if (resetStep === 'send') {
    if (!email) { setErr('r-err', 'Please enter your email'); return; }
    setLoading(btn, 'Sending…');
    try {
      await apiPost('/api/v1/authentication/reset-password/send-otp', { email });
      ['r-otp-group','r-pass-group','r-pass2-group'].forEach(id => { document.getElementById(id).style.display = ''; });
      btn.textContent = 'Reset Password →';
      resetStep = 'verify';
      toast('OTP sent');
    } catch(e) { setErr('r-err', e.message); resetBtn(btn, 'Send OTP →'); }
    finally { btn.disabled = false; }
  } else {
    const pass = v('r-pass'), pass2 = v('r-pass2');
    if (!v('r-otp'))     { setErr('r-err', 'Please enter the OTP'); return; }
    if (pass !== pass2)  { setErr('r-err', 'Passwords do not match'); return; }
    if (pass.length < 8) { setErr('r-err', 'Minimum 8 characters'); return; }
    setLoading(btn, 'Resetting…');
    try {
      const d = await apiPost('/api/v1/authentication/reset-password/' + email, { otp: v('r-otp'), new_password: pass });
      saveTokens(d.access_token, d.refresh_token);
      showApp(); await loadConvs();
    } catch(e) { setErr('r-err', e.message); resetBtn(btn, 'Reset Password →'); }
    finally { btn.disabled = false; }
  }
}

function saveTokens(at, rt) {
  token = at; rtoken = rt;
  localStorage.setItem('at', at);
  localStorage.setItem('rt', rt);
}

async function doRefresh() {
  try {
    const d = await apiPost('/api/v1/authentication/refresh', { refresh_token: rtoken });
    saveTokens(d.access_token, d.refresh_token);
    return true;
  } catch { handleLogout(); return false; }
}

/* authenticated fetch — auto-refreshes on 401 */
async function af(url, opts = {}) {
  if (!opts.headers) opts.headers = {};
  opts.headers['Authorization'] = 'Bearer ' + token;
  let r = await fetch(API + url, opts);
  if (r.status === 401) {
    if (!await doRefresh()) return null;
    opts.headers['Authorization'] = 'Bearer ' + token;
    r = await fetch(API + url, opts);
  }
  return r;
}

function handleLogout() {
  token = null; rtoken = null;
  const saved = selectedModel;
  localStorage.clear();
  localStorage.setItem('nexus_model', saved);
  convId = null; convMap = {};
  closeSidebar();
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('sb-list').innerHTML = '';
  document.getElementById('topbar-title').textContent = 'Select a conversation';
  setMsgs(emptyHTML());
}

function showApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════
   CONVERSATIONS
   ═══════════════════════════════════════════════════════════ */
async function loadConvs() {
  const r = await af('/api/v1/conversations/');
  if (!r || !r.ok) return;
  const convs = await r.json();
  convMap = Object.fromEntries(convs.map(c => [c.id, c]));

  const list = document.getElementById('sb-list');
  if (!convs.length) {
    list.innerHTML = '<div class="sb-section">No conversations yet</div>';
    return;
  }

  const grouped = {};
  convs.forEach(c => {
    const d = (Date.now() - new Date(c.created_at)) / 86400000;
    const k = d < 1 ? 'Today' : d < 7 ? 'This week' : d < 30 ? 'This month' : 'Older';
    (grouped[k] = grouped[k] || []).push(c);
  });

  const order = ['Today','This week','This month','Older'];
  list.innerHTML = order.filter(k => grouped[k]).map(k =>
    `<div class="sb-section">${k}</div>` +
    grouped[k].map(c => `
      <div class="sb-item${String(c.id) === String(convId) ? ' active' : ''}" data-id="${c.id}" role="listitem" tabindex="0">
        <span class="sb-item-title">${esc(c.title)}</span>
        <button class="sb-del" onclick="event.stopPropagation();delConv('${c.id}')" title="Delete" aria-label="Delete ${esc(c.title)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`
    ).join('')
  ).join('');

  list.querySelectorAll('.sb-item[data-id]').forEach(el => {
    el.addEventListener('click', () => selConvById(el.dataset.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selConvById(el.dataset.id); }});
  });
}

function openNewChat() {
  document.getElementById('new-title').value = '';
  openModal('new-chat-modal');
  setTimeout(() => document.getElementById('new-title').focus(), 150);
}

async function confirmNewChat() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) { toast('Please enter a title'); return; }
  closeModal('new-chat-modal');
  const r = await af('/api/v1/conversations/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!r || !r.ok) { toast('Failed to create conversation'); return; }
  const c = await r.json();
  convMap[c.id] = c;
  await loadConvs();
  selConvById(String(c.id));
}

function selConvById(id) {
  const c = convMap[Object.keys(convMap).find(k => String(k) === String(id))];
  if (!c) { toast('Conversation not found'); return; }
  selConv(c.id, c.title);
}

async function selConv(id, title) {
  convId = id;
  document.getElementById('topbar-title').textContent = title;
  closeSidebar();
  await loadConvs();
  await loadMsgs(id);
}

async function delConv(id) {
  const r = await af('/api/v1/conversations/' + id, { method: 'DELETE' });
  if (!r || !r.ok) { toast('Failed to delete'); return; }
  if (String(convId) === String(id)) {
    convId = null;
    document.getElementById('topbar-title').textContent = 'Select a conversation';
    setMsgs(emptyHTML());
  }
  await loadConvs();
  toast('Conversation deleted');
}

/* ═══════════════════════════════════════════════════════════
   MESSAGES
   ═══════════════════════════════════════════════════════════ */
async function loadMsgs(id) {
  const r = await af('/api/v1/conversations/' + id + '/messages/');
  if (!r || !r.ok) return;
  const msgs = await r.json();
  if (!msgs.length) {
    setMsgs(`<div class="empty">
      <div class="empty-glyph" aria-hidden="true">✦</div>
      <div class="empty-title">Start the conversation</div>
      <div class="empty-hint">Ask anything, upload a document, or share an image</div>
    </div>`);
    return;
  }
  document.getElementById('messages').innerHTML = msgs.map(renderMsg).join('');
  scrollBot();
}

function renderMsg(m) {
  if (m.role === 'system' && m.content.startsWith(FILE_PREFIX)) {
    const rest   = m.content.slice(FILE_PREFIX.length);
    const colon  = rest.indexOf(':');
    const type   = rest.slice(0, colon);
    const fname  = rest.slice(colon + 1);
    return `<div class="file-pill"><div class="file-pill-inner">${type === 'img' ? '🖼️' : '📄'} <span>${esc(fname)}</span></div></div>`;
  }
  if (m.role === 'system') return '';
  return `<div class="msg-row ${m.role}" role="article"><div class="msg-bubble">${fmt(m.content)}</div></div>`;
}

/* ═══════════════════════════════════════════════════════════
   MARKDOWN → HTML
   ═══════════════════════════════════════════════════════════ */
function fmt(raw) {
  /* 1 — protect fenced code blocks */
  const blocks = [];
  let t = raw.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code>${esc(code.trim())}</code></pre>`);
    return '\x00B' + (blocks.length - 1) + '\x00';
  });

  /* 2 — inline code */
  t = t.replace(/`([^`\n]+)`/g, (_, c) => `<code>${esc(c)}</code>`);

  /* 3 — line-by-line parse */
  const lines = t.split('\n');
  const out   = [];
  let i = 0;

  while (i < lines.length) {
    const line    = lines[i];
    const trimmed = line.trim();

    /* headings */
    if (/^### (.+)/.test(line)) { out.push(`<div class="mh3">${inlineFmt(line.slice(4))}</div>`); i++; continue; }
    if (/^## (.+)/.test(line))  { out.push(`<div class="mh2">${inlineFmt(line.slice(3))}</div>`); i++; continue; }
    if (/^# (.+)/.test(line))   { out.push(`<div class="mh1">${inlineFmt(line.slice(2))}</div>`); i++; continue; }

    /* horizontal rule */
    if (/^---+$/.test(trimmed)) { out.push('<hr>'); i++; continue; }

    /* blockquote */
    if (/^> (.+)/.test(line)) { out.push(`<blockquote>${inlineFmt(line.slice(2))}</blockquote>`); i++; continue; }

    /* unordered list — collect consecutive */
    if (/^[-*+] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(`<li>${inlineFmt(lines[i].replace(/^[-*+] /, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    /* ordered list — collect consecutive */
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineFmt(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    /* blank line — skip */
    if (trimmed === '') { i++; continue; }

    /* paragraph — collect consecutive non-special lines */
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3} |[-*+] |\d+\. |> |---+|\x00B)/.test(lines[i])
    ) {
      para.push(inlineFmt(lines[i]));
      i++;
    }
    if (para.length) out.push(`<p>${para.join(' ')}</p>`);
  }

  /* 4 — restore code blocks */
  let html = out.join('');
  html = html.replace(/\x00B(\d+)\x00/g, (_, idx) => blocks[+idx]);
  return html;
}

function inlineFmt(t) {
  /* bold+italic combo */
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/__(.+?)__/g,         '<strong>$1</strong>');
  t = t.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g,         '<em>$1</em>');
  t = t.replace(/_(.+?)_/g,           '<em>$1</em>');
  t = t.replace(/~~(.+?)~~/g,         '<s>$1</s>');

  /* ── LINKS — clickable, open new tab ───────────────────── */
  /* markdown links [text](url) */
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  /* bare URLs — not already inside an href */
  t = t.replace(
    /(^|[\s(,>])(https?:\/\/[^\s<)"']+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  return t;
}

function scrollBot() {
  const el = document.getElementById('messages');
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

/* ═══════════════════════════════════════════════════════════
   SEND MESSAGE
   ═══════════════════════════════════════════════════════════ */
async function sendMessage() {
  if (!convId)   { toast('Select a conversation first'); return; }
  const inp  = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || busy) return;

  busy = true;
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
  inp.value = '';
  inp.style.height = 'auto';

  const msgs = document.getElementById('messages');
  msgs.querySelector('.empty')?.remove();
  msgs.querySelector('.no-conv')?.remove();

  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row user" role="article"><div class="msg-bubble">${esc(text).replace(/\n/g,'<br>')}</div></div>`
  );
  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row assistant" id="typing-row" role="article">
       <div class="msg-bubble">
         <div class="typing" aria-label="Thinking">
           <div class="tdot"></div><div class="tdot"></div><div class="tdot"></div>
         </div>
       </div>
     </div>`
  );
  scrollBot();

  try {
    const r = await af('/api/v1/conversations/' + convId + '/messages/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, model: selectedModel }),
    });
    if (!r || !r.ok) {
      let detail = 'Error sending message';
      try { const d = await r.json(); detail = d.detail || detail; } catch {}
      throw new Error(detail);
    }
    const d = await r.json();
    document.getElementById('typing-row')?.remove();
    msgs.insertAdjacentHTML('beforeend', renderMsg(d));
    scrollBot();
  } catch(e) {
    document.getElementById('typing-row')?.remove();
    toast(e.message || 'Failed to send');
  }

  busy = false;
  sendBtn.disabled = false;
  inp.focus();
}

/* Enter sends on desktop; on mobile Enter = newline */
function handleKey(e) {
  const isMobile = window.matchMedia('(max-width:680px)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
    e.preventDefault();
    sendMessage();
  }
}

function resize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

/* ═══════════════════════════════════════════════════════════
   FILE UPLOAD
   ═══════════════════════════════════════════════════════════ */
function openUpload() {
  if (!convId) { toast('Select a conversation first'); return; }
  selFile  = null;
  upType   = 'doc';
  document.getElementById('file-name').textContent  = '';
  document.getElementById('file-input').value       = '';
  document.querySelectorAll('.up-tab').forEach((b, i) => {
    b.classList.toggle('on', i === 0);
    b.setAttribute('aria-selected', String(i === 0));
  });
  document.getElementById('dz-icon').textContent   = '📄';
  document.getElementById('dz-types').textContent  = 'PDF, DOCX, TXT';
  document.getElementById('file-input').accept     = '.pdf,.docx,.txt';
  openModal('upload-modal');
}

function switchUpTab(t) {
  upType = t;
  document.querySelectorAll('.up-tab').forEach((b, i) => {
    const on = i === (t === 'doc' ? 0 : 1);
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.getElementById('dz-icon').textContent  = t === 'img' ? '🖼️' : '📄';
  document.getElementById('dz-types').textContent = t === 'img' ? 'PNG, JPG, JPEG, WEBP' : 'PDF, DOCX, TXT';
  document.getElementById('file-input').accept    = t === 'img' ? 'image/png,image/jpeg,image/webp' : '.pdf,.docx,.txt';
  selFile = null;
  document.getElementById('file-name').textContent = '';
  document.getElementById('file-input').value      = '';
}

function onFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  selFile = file;
  document.getElementById('file-name').textContent = '✓ ' + file.name;
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  selFile = file;
  document.getElementById('file-name').textContent = '✓ ' + file.name;
}

async function doUpload() {
  if (!selFile)  { toast('Select a file first'); return; }
  if (!convId)   { toast('Select a conversation first'); closeModal('upload-modal'); return; }

  const ep   = upType === 'img'
    ? '/api/v1/conversations/' + convId + '/messages/image'
    : '/api/v1/conversations/' + convId + '/messages/documents';
  const fd   = new FormData();
  fd.append('file', selFile);
  const fname = selFile.name, type = upType;
  closeModal('upload-modal');
  selFile = null;

  const msgs = document.getElementById('messages');
  msgs.querySelector('.empty')?.remove();
  msgs.querySelector('.no-conv')?.remove();
  msgs.insertAdjacentHTML('beforeend',
    `<div id="upload-pending" class="file-pill"><div class="file-pill-inner">${type === 'img' ? '🖼️' : '📄'} <span>${esc(fname)}</span></div></div>`
  );
  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row assistant" id="upload-typing"><div class="msg-bubble">
       <div class="typing"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>
     </div></div>`
  );
  scrollBot();

  try {
    const r = await af(ep, { method: 'POST', body: fd });
    document.getElementById('upload-pending')?.remove();
    document.getElementById('upload-typing')?.remove();
    if (!r || !r.ok) {
      let detail = 'Upload failed';
      try { const d = await r.json(); detail = d.detail || detail; } catch {}
      throw new Error(detail);
    }
    await loadMsgs(convId);
    toast(type === 'img' ? 'Image processed' : 'Document added to memory');
  } catch(e) {
    document.getElementById('upload-pending')?.remove();
    document.getElementById('upload-typing')?.remove();
    toast(e.message || 'Upload failed');
  }
}

/* ═══════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════ */
function v(id)          { return document.getElementById(id).value.trim(); }
function setErr(id, msg){ const el = document.getElementById(id); if (el) el.textContent = msg; }
function clrErr(id)     { const el = document.getElementById(id); if (el) el.textContent = ''; }
function setMsgs(html)  { document.getElementById('messages').innerHTML = html; }

function openModal(id) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => {
    document.getElementById(id).querySelector('input,textarea,button')?.focus();
  }, 120);
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function setLoading(btn, label) { btn.textContent = label; btn.disabled = true; }
function resetBtn(btn, label)   { btn.textContent = label; btn.disabled = false; }

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

async function apiPost(url, body) {
  const r = await fetch(API + url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || 'Request failed');
  return d;
}

function emptyHTML() {
  return `<div class="no-conv">
    <div class="no-conv-glyph" aria-hidden="true">✦</div>
    <div class="no-conv-text">Start a conversation</div>
    <div class="empty-hint">Web search · Document memory · Vision</div>
  </div>`;
}