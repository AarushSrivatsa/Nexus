'use strict';

Nexus.requireAuth();

/* ── CONSTANTS ───────────────────────────────────────────── */
const FILE_PREFIX = '024b4faf-5861-4f6b-840c-8f9b4cb660b1_';
// Matches the backend default in routers/messages.py — used only until
// /api/v1/models/get_models responds.
const FALLBACK_MODEL    = 'openai/gpt-oss-120b';
const FALLBACK_PROVIDER = 'groq';

// Presentation-only hints for the model dropdown. Purely cosmetic —
// the source of truth for which models exist is the backend response.
const MODEL_HINTS = {
  'openai/gpt-oss-120b':      'Balanced · default',
  'openai/gpt-oss-20b':       'Fast, lighter reasoning',
  'qwen/qwen3-32b':           'Strong reasoning',
  'llama-3.1-8b-instant':     'Fastest responses',
  'llama-3.3-70b-versatile':  'Most capable',
  'groq/compound':            'Agentic + tool use',
};

/* ── STATE ───────────────────────────────────────────────── */
let convId          = null;
let upType           = 'doc';
let selFile          = null;
let busy             = false;
let convMap          = {};
let availableModels  = [];
let selectedModel     = localStorage.getItem('nexus_model')    || FALLBACK_MODEL;
let selectedProvider  = localStorage.getItem('nexus_provider') || FALLBACK_PROVIDER;

/* ═══════════════════════════════════════════════════════════
   MODELS — dropdown
   ═══════════════════════════════════════════════════════════ */
async function loadModels() {
  try {
    const r = await fetch('/api/v1/models/get_models');
    if (!r.ok) throw 0;
    availableModels = await r.json();
  } catch {
    availableModels = [{ id: FALLBACK_MODEL, name: 'GPT OSS 120B', provider: FALLBACK_PROVIDER }];
  }
  if (!availableModels.find(m => m.id === selectedModel)) {
    selectedModel    = availableModels[0]?.id       || FALLBACK_MODEL;
    selectedProvider = availableModels[0]?.provider || FALLBACK_PROVIDER;
    localStorage.setItem('nexus_model', selectedModel);
    localStorage.setItem('nexus_provider', selectedProvider);
  }
  renderModelMenu();
  updateModelButton();
}

function updateModelButton() {
  const m = availableModels.find(x => x.id === selectedModel);
  document.getElementById('model-btn-label').textContent = m?.name || selectedModel;
}

function renderModelMenu() {
  const menu = document.getElementById('model-menu');
  menu.innerHTML = availableModels.map(m => {
    const active = m.id === selectedModel;
    const hint = MODEL_HINTS[m.id] || m.provider;
    return `
      <button type="button" role="option" aria-selected="${active}" data-id="${Nexus.esc(m.id)}"
        onclick="selectModel('${Nexus.esc(m.id)}')"
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${active ? 'bg-accent/10' : 'hover:bg-surface-3'}">
        <span class="min-w-0">
          <span class="block font-display text-[12.5px] font-bold ${active ? 'text-accent' : 'text-ink-1'} truncate">${Nexus.esc(m.name)}</span>
          <span class="block text-[10.5px] text-ink-3 mt-0.5 truncate">${Nexus.esc(hint)}</span>
        </span>
        ${active ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </button>`;
  }).join('');
}

function selectModel(id) {
  const model      = availableModels.find(m => m.id === id);
  selectedModel     = id;
  selectedProvider  = model?.provider || FALLBACK_PROVIDER;
  localStorage.setItem('nexus_model', id);
  localStorage.setItem('nexus_provider', selectedProvider);
  updateModelButton();
  renderModelMenu();
  closeModelMenu();
}
window.selectModel = selectModel;

function toggleModelMenu() {
  const menu = document.getElementById('model-menu');
  menu.classList.contains('hidden') ? openModelMenu() : closeModelMenu();
}
window.toggleModelMenu = toggleModelMenu;

function openModelMenu() {
  document.getElementById('model-menu').classList.remove('hidden');
  document.getElementById('model-btn').setAttribute('aria-expanded', 'true');
  document.getElementById('model-btn-chevron').style.transform = 'rotate(180deg)';
}
function closeModelMenu() {
  document.getElementById('model-menu').classList.add('hidden');
  document.getElementById('model-btn').setAttribute('aria-expanded', 'false');
  document.getElementById('model-btn-chevron').style.transform = '';
}
document.addEventListener('click', (e) => {
  const menu = document.getElementById('model-menu');
  const btn  = document.getElementById('model-btn');
  if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) closeModelMenu();
});

/* ═══════════════════════════════════════════════════════════
   SIDEBAR (mobile)
   ═══════════════════════════════════════════════════════════ */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  const ov = document.getElementById('sb-overlay');
  ov.classList.remove('opacity-0', 'pointer-events-none');
  ov.classList.add('opacity-100', 'pointer-events-auto');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.getElementById('sb-overlay');
  ov.classList.add('opacity-0', 'pointer-events-none');
  ov.classList.remove('opacity-100', 'pointer-events-auto');
}
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;

/* ═══════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════ */
function openModal(id) {
  const bg = document.getElementById(id);
  bg.classList.add('open');
  setTimeout(() => bg.querySelector('input,textarea,button')?.focus(), 120);
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function handleModalBgClick(event, id) { if (event.target.id === id) closeModal(id); }
window.openModal = openModal;
window.closeModal = closeModal;
window.handleModalBgClick = handleModalBgClick;

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openModalEl = document.querySelector('#new-chat-modal.open, #upload-modal.open');
  if (openModalEl) { closeModal(openModalEl.id); return; }
  const menu = document.getElementById('model-menu');
  if (!menu.classList.contains('hidden')) { closeModelMenu(); return; }
  closeSidebar();
});

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await loadModels();
  await loadConvs();
});

/* ═══════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════ */
function handleLogout() {
  Nexus.clearSession();
  window.location.href = '/login';
}
window.handleLogout = handleLogout;

/* ═══════════════════════════════════════════════════════════
   CONVERSATIONS
   ═══════════════════════════════════════════════════════════ */
async function loadConvs() {
  const r = await Nexus.af('/api/v1/conversations/');
  if (!r || !r.ok) return;
  const convs = await r.json();
  convMap = Object.fromEntries(convs.map(c => [c.id, c]));

  const list = document.getElementById('sb-list');
  if (!convs.length) {
    list.innerHTML = '<div class="font-display text-[9px] font-bold tracking-[.14em] uppercase text-ink-3 px-2 pt-3 pb-1.5">No conversations yet</div>';
    return;
  }

  const grouped = {};
  convs.forEach(c => {
    const d = (Date.now() - new Date(c.created_at)) / 86400000;
    const k = d < 1 ? 'Today' : d < 7 ? 'This week' : d < 30 ? 'This month' : 'Older';
    (grouped[k] = grouped[k] || []).push(c);
  });

  const order = ['Today', 'This week', 'This month', 'Older'];
  list.innerHTML = order.filter(k => grouped[k]).map(k =>
    `<div class="font-display text-[9px] font-bold tracking-[.14em] uppercase text-ink-3 px-2 pt-3 pb-1.5">${k}</div>` +
    grouped[k].map(c => `
      <div class="group sb-item flex items-center justify-between gap-2 min-h-[40px] mb-0.5 px-2.5 py-2.5 rounded-[10px] border border-transparent cursor-pointer transition-colors ${String(c.id) === String(convId) ? 'bg-accent/10 border-accent/15' : 'hover:bg-surface-2'}"
        data-id="${c.id}" role="listitem" tabindex="0">
        <span class="text-xs font-medium truncate flex-1 ${String(c.id) === String(convId) ? 'text-accent' : 'text-ink-2 group-hover:text-ink-1'}">${Nexus.esc(c.title)}</span>
        <button class="w-6 h-6 rounded-md text-ink-3 hidden group-hover:flex max-[680px]:flex items-center justify-center shrink-0 transition-colors hover:text-danger" onclick="event.stopPropagation();delConv('${c.id}')" title="Delete" aria-label="Delete ${Nexus.esc(c.title)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`
    ).join('')
  ).join('');

  list.querySelectorAll('.sb-item[data-id]').forEach(el => {
    el.addEventListener('click', () => selConvById(el.dataset.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selConvById(el.dataset.id); } });
  });
}

function openNewChat() {
  document.getElementById('new-title').value = '';
  openModal('new-chat-modal');
}
window.openNewChat = openNewChat;

async function confirmNewChat() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) { Nexus.toast('Please enter a title', true); return; }
  closeModal('new-chat-modal');
  const r = await Nexus.af('/api/v1/conversations/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!r || !r.ok) { Nexus.toast('Failed to create conversation', true); return; }
  const c = await r.json();
  convMap[c.id] = c;
  await loadConvs();
  selConvById(String(c.id));
}
window.confirmNewChat = confirmNewChat;

function selConvById(id) {
  const c = convMap[Object.keys(convMap).find(k => String(k) === String(id))];
  if (!c) { Nexus.toast('Conversation not found', true); return; }
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
  const r = await Nexus.af('/api/v1/conversations/' + id, { method: 'DELETE' });
  if (!r || !r.ok) { Nexus.toast('Failed to delete', true); return; }
  if (String(convId) === String(id)) {
    convId = null;
    document.getElementById('topbar-title').textContent = 'Select a conversation';
    setMsgs(emptyHTML());
  }
  await loadConvs();
  Nexus.toast('Conversation deleted');
}
window.delConv = delConv;

/* ═══════════════════════════════════════════════════════════
   MESSAGES
   ═══════════════════════════════════════════════════════════ */
async function loadMsgs(id) {
  const r = await Nexus.af('/api/v1/conversations/' + id + '/messages/');
  if (!r || !r.ok) return;
  const msgs = await r.json();
  if (!msgs.length) {
    setMsgs(`<div class="flex-1 flex flex-col items-center justify-center gap-3.5 pb-14 pointer-events-none anim-rise">
      <div class="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-accent/[.09] to-accent2/[.04] border border-accent/[.12] flex items-center justify-center text-2xl">✦</div>
      <div class="font-display text-[15px] font-semibold text-ink-2">Start the conversation</div>
      <div class="text-xs text-ink-3 text-center max-w-[260px] leading-relaxed">Ask anything, upload a document, or share an image</div>
    </div>`);
    return;
  }
  document.getElementById('messages').innerHTML = msgs.map(renderMsg).join('');
  scrollBot();
}

function renderMsg(m) {
  if (m.role === 'system' && m.content.startsWith(FILE_PREFIX)) {
    const rest  = m.content.slice(FILE_PREFIX.length);
    const colon = rest.indexOf(':');
    const type  = rest.slice(0, colon);
    const fname = rest.slice(colon + 1);
    return `<div class="flex justify-center my-2">
      <div class="bg-surface-2 border border-line-1 rounded-full px-4 py-1.5 text-[11px] text-ink-3 flex items-center gap-1.5 font-semibold max-w-[90%]">
        <span>${type === 'img' ? '🖼️' : '📄'}</span><span class="truncate">${Nexus.esc(fname)}</span>
      </div>
    </div>`;
  }
  if (m.role === 'system') return '';
  const isUser = m.role === 'user';
  return `<div class="msg-row ${m.role} flex ${isUser ? 'justify-end' : 'justify-start'} anim-rise" role="article">
    <div class="max-w-[72%] max-[680px]:max-w-[90%] px-4.5 py-3 text-[13.5px] leading-relaxed break-words
      ${isUser
        ? 'bg-gradient-to-br from-accent to-accent2 text-black font-medium rounded-[20px_20px_5px_20px] shadow-[0_4px_20px_rgba(0,229,255,.1)]'
        : 'bg-surface-2 text-ink-1 rounded-[20px_20px_20px_5px] border border-line-1'}">
      <div class="md">${fmt(m.content)}</div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   MARKDOWN → HTML  (kept in JS: content is dynamic per message)
   ═══════════════════════════════════════════════════════════ */
function fmt(raw) {
  const blocks = [];
  let t = raw.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code>${Nexus.esc(code.trim())}</code></pre>`);
    return '\x00B' + (blocks.length - 1) + '\x00';
  });

  t = t.replace(/`([^`\n]+)`/g, (_, c) => `<code>${Nexus.esc(c)}</code>`);

  const lines = t.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^### (.+)/.test(line)) { out.push(`<div class="mh3">${inlineFmt(line.slice(4))}</div>`); i++; continue; }
    if (/^## (.+)/.test(line))  { out.push(`<div class="mh2">${inlineFmt(line.slice(3))}</div>`); i++; continue; }
    if (/^# (.+)/.test(line))   { out.push(`<div class="mh1">${inlineFmt(line.slice(2))}</div>`); i++; continue; }

    if (/^---+$/.test(trimmed)) { out.push('<hr>'); i++; continue; }
    if (/^> (.+)/.test(line)) { out.push(`<blockquote>${inlineFmt(line.slice(2))}</blockquote>`); i++; continue; }

    if (/^[-*+] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) { items.push(`<li>${inlineFmt(lines[i].replace(/^[-*+] /, ''))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(`<li>${inlineFmt(lines[i].replace(/^\d+\. /, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (trimmed === '') { i++; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3} |[-*+] |\d+\. |> |---+|\x00B)/.test(lines[i])) {
      para.push(inlineFmt(lines[i]));
      i++;
    }
    if (para.length) out.push(`<p>${para.join(' ')}</p>`);
  }

  let html = out.join('');
  html = html.replace(/\x00B(\d+)\x00/g, (_, idx) => blocks[+idx]);
  return html;
}

function inlineFmt(t) {
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/_(.+?)_/g, '<em>$1</em>');
  t = t.replace(/~~(.+?)~~/g, '<s>$1</s>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/(^|[\s(,>])(https?:\/\/[^\s<)"']+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return t;
}

function scrollBot() {
  const el = document.getElementById('messages');
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}
function setMsgs(html) { document.getElementById('messages').innerHTML = html; }

function emptyHTML() {
  return `<div class="flex-1 flex flex-col items-center justify-center gap-3.5 pb-14 pointer-events-none anim-rise">
    <div class="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-accent/[.09] to-accent2/[.04] border border-accent/[.12] flex items-center justify-center text-2xl">✦</div>
    <div class="font-display text-[15px] font-semibold text-ink-2">Start a conversation</div>
    <div class="text-xs text-ink-3 text-center max-w-[260px] leading-relaxed">Web search · Document memory · Vision</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   SEND MESSAGE
   ═══════════════════════════════════════════════════════════ */
async function sendMessage() {
  if (!convId) { Nexus.toast('Select a conversation first', true); return; }
  const inp = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || busy) return;

  busy = true;
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
  inp.value = '';
  inp.style.height = 'auto';

  const msgs = document.getElementById('messages');
  msgs.querySelector('.no-conv')?.remove();

  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row user flex justify-end anim-rise" role="article">
       <div class="max-w-[72%] max-[680px]:max-w-[90%] px-4.5 py-3 text-[13.5px] leading-relaxed break-words bg-gradient-to-br from-accent to-accent2 text-black font-medium rounded-[20px_20px_5px_20px] shadow-[0_4px_20px_rgba(0,229,255,.1)]">${Nexus.esc(text).replace(/\n/g, '<br>')}</div>
     </div>`
  );
  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row assistant flex justify-start" id="typing-row" role="article">
       <div class="px-4.5 py-3 bg-surface-2 rounded-[20px_20px_20px_5px] border border-line-1">
         <div class="flex gap-1.5 items-center py-1 px-0.5" aria-label="Thinking"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>
       </div>
     </div>`
  );
  scrollBot();

  try {
    const r = await Nexus.af('/api/v1/conversations/' + convId + '/messages/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: selectedModel, provider: selectedProvider }),
    });
    if (!r || !r.ok) {
      let detail = 'Something went wrong';
      try { const d = await r.json(); detail = d.detail || d.message || detail; } catch {}
      throw new Error(detail);
    }
    const d = await r.json();
    document.getElementById('typing-row')?.remove();
    msgs.insertAdjacentHTML('beforeend', renderMsg(d));
    scrollBot();
  } catch (e) {
    document.getElementById('typing-row')?.remove();
    Nexus.toast(e.message || 'Failed to send', true);
  }

  busy = false;
  sendBtn.disabled = false;
  inp.focus();
}
window.sendMessage = sendMessage;

function handleKey(e) {
  const isMobile = window.matchMedia('(max-width:680px)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); sendMessage(); }
}
function resize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
document.getElementById('msg-input').addEventListener('keydown', handleKey);
document.getElementById('msg-input').addEventListener('input', (e) => resize(e.target));

/* ═══════════════════════════════════════════════════════════
   FILE UPLOAD
   ═══════════════════════════════════════════════════════════ */
function openUpload() {
  if (!convId) { Nexus.toast('Select a conversation first', true); return; }
  selFile = null;
  upType = 'doc';
  document.getElementById('file-name').textContent = '';
  document.getElementById('file-input').value = '';
  document.querySelectorAll('.up-tab').forEach((b, i) => setTabState(b, i === 0));
  document.getElementById('dz-icon').textContent = '📄';
  document.getElementById('dz-types').textContent = 'PDF, DOCX, TXT';
  document.getElementById('file-input').accept = '.pdf,.docx,.txt';
  openModal('upload-modal');
}
window.openUpload = openUpload;

function setTabState(btn, on) {
  btn.setAttribute('aria-selected', String(on));
  btn.classList.toggle('bg-surface-3', on);
  btn.classList.toggle('text-ink-1', on);
  btn.classList.toggle('bg-transparent', !on);
  btn.classList.toggle('text-ink-3', !on);
}

function switchUpTab(t) {
  upType = t;
  document.querySelectorAll('.up-tab').forEach(b => setTabState(b, b.dataset.type === t));
  document.getElementById('dz-icon').textContent = t === 'img' ? '🖼️' : '📄';
  document.getElementById('dz-types').textContent = t === 'img' ? 'PNG, JPG, JPEG, WEBP' : 'PDF, DOCX, TXT';
  document.getElementById('file-input').accept = t === 'img' ? 'image/png,image/jpeg,image/webp' : '.pdf,.docx,.txt';
  selFile = null;
  document.getElementById('file-name').textContent = '';
  document.getElementById('file-input').value = '';
}
window.switchUpTab = switchUpTab;

function onFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  selFile = file;
  document.getElementById('file-name').textContent = '✓ ' + file.name;
}
window.onFileSelect = onFileSelect;

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('border-accent/70', 'bg-accent/10');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  selFile = file;
  document.getElementById('file-name').textContent = '✓ ' + file.name;
}
window.onDrop = onDrop;

async function doUpload() {
  if (!selFile) { Nexus.toast('Select a file first', true); return; }
  if (!convId) { Nexus.toast('Select a conversation first', true); closeModal('upload-modal'); return; }

  const ep = upType === 'img'
    ? '/api/v1/conversations/' + convId + '/messages/image'
    : '/api/v1/conversations/' + convId + '/messages/documents';
  const fd = new FormData();
  fd.append('file', selFile);
  const fname = selFile.name, type = upType;
  closeModal('upload-modal');
  selFile = null;

  const msgs = document.getElementById('messages');
  msgs.querySelector('.no-conv')?.remove();
  msgs.insertAdjacentHTML('beforeend',
    `<div id="upload-pending" class="flex justify-center my-2"><div class="bg-surface-2 border border-line-1 rounded-full px-4 py-1.5 text-[11px] text-ink-3 flex items-center gap-1.5 font-semibold max-w-[90%]"><span>${type === 'img' ? '🖼️' : '📄'}</span><span class="truncate">${Nexus.esc(fname)}</span></div></div>`
  );
  msgs.insertAdjacentHTML('beforeend',
    `<div class="msg-row assistant flex justify-start" id="upload-typing"><div class="px-4.5 py-3 bg-surface-2 rounded-[20px_20px_20px_5px] border border-line-1"><div class="flex gap-1.5 items-center py-1 px-0.5"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div></div></div>`
  );
  scrollBot();

  try {
    const r = await Nexus.af(ep, { method: 'POST', body: fd });
    document.getElementById('upload-pending')?.remove();
    document.getElementById('upload-typing')?.remove();
    if (!r || !r.ok) {
      let detail = 'Upload failed';
      try { const d = await r.json(); detail = d.detail || d.message || detail; } catch {}
      throw new Error(detail);
    }
    await loadMsgs(convId);
    Nexus.toast(type === 'img' ? 'Image processed' : 'Document added to memory');
  } catch (e) {
    document.getElementById('upload-pending')?.remove();
    document.getElementById('upload-typing')?.remove();
    Nexus.toast(e.message || 'Upload failed', true);
  }
}
window.doUpload = doUpload;
