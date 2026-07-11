'use strict';
/* ═══════════════════════════════════════════════════════════
   NEXUS — common.js
   Shared across every page: token storage, authenticated fetch
   with refresh-on-401, toast, escaping, small DOM helpers.
   ═══════════════════════════════════════════════════════════ */

const Nexus = (() => {
  const API = '';

  function getAccessToken()  { return localStorage.getItem('at'); }
  function getRefreshToken() { return localStorage.getItem('rt'); }

  function saveTokens(at, rt) {
    localStorage.setItem('at', at);
    localStorage.setItem('rt', rt);
  }

  function clearSession() {
    // Preserve model preference across logout, drop everything else.
    const model    = localStorage.getItem('nexus_model');
    const provider = localStorage.getItem('nexus_provider');
    localStorage.clear();
    if (model)    localStorage.setItem('nexus_model', model);
    if (provider) localStorage.setItem('nexus_provider', provider);
  }

  function isAuthed() { return !!getAccessToken(); }

  /** Redirect away from auth pages if already signed in. Call on login/signup/reset pages. */
  function redirectIfAuthed() {
    if (isAuthed()) window.location.href = '/app';
  }

  /** Redirect to login if not signed in. Call on app page. */
  function requireAuth() {
    if (!isAuthed()) window.location.href = '/login';
  }

  async function doRefresh() {
    try {
      const r = await fetch(API + '/api/v1/authentication/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: getRefreshToken() }),
      });
      if (!r.ok) throw new Error('refresh failed');
      const d = await r.json();
      saveTokens(d.access_token, d.refresh_token);
      return true;
    } catch {
      clearSession();
      window.location.href = '/login';
      return false;
    }
  }

  /** Authenticated fetch — retries once with a refreshed token on 401. */
  async function af(url, opts = {}) {
    if (!opts.headers) opts.headers = {};
    opts.headers['Authorization'] = 'Bearer ' + getAccessToken();
    let r = await fetch(API + url, opts);
    if (r.status === 401) {
      if (!await doRefresh()) return null;
      opts.headers['Authorization'] = 'Bearer ' + getAccessToken();
      r = await fetch(API + url, opts);
    }
    return r;
  }

  /** Plain (unauthenticated) JSON POST, throws with server-provided message on failure. */
  async function apiPost(url, body) {
    const r = await fetch(API + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || d.message || 'Request failed');
    return d;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function toast(msg, isError = false) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'fixed left-1/2 z-[500] max-w-[min(500px,calc(100dvw-48px))] -translate-x-1/2 -translate-y-4 rounded-2xl border px-7 py-3.5 text-center text-[13px] font-semibold leading-relaxed opacity-0 shadow-2xl transition-all duration-200 pointer-events-none';
      el.style.top = 'max(24px, calc(env(safe-area-inset-top,0px) + 16px))';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('bg-[#160608]', isError);
    el.classList.toggle('border-danger/50', isError);
    el.classList.toggle('text-[#ff8fa3]', isError);
    el.classList.toggle('bg-surface-2', !isError);
    el.classList.toggle('border-line-2', !isError);
    el.classList.toggle('text-ink-1', !isError);
    el.classList.remove('opacity-0', '-translate-y-4');
    el.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('opacity-100', 'translate-y-0');
      el.classList.add('opacity-0', '-translate-y-4');
    }, 3000);
  }

  function togglePw(inputId, btn) {
    const inp  = document.getElementById(inputId);
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.innerHTML = show
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  function setLoading(btn, label) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = label; btn.disabled = true; }
  function resetBtn(btn, label)   { btn.textContent = label; btn.disabled = false; }
  function setErr(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
  function clrErr(id)      { const el = document.getElementById(id); if (el) el.textContent = ''; }
  function v(id) { return document.getElementById(id).value.trim(); }

  return {
    getAccessToken, getRefreshToken, saveTokens, clearSession, isAuthed,
    redirectIfAuthed, requireAuth, af, apiPost, esc, toast, togglePw,
    setLoading, resetBtn, setErr, clrErr, v,
  };
})();
