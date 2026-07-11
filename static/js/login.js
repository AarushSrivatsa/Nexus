'use strict';

Nexus.redirectIfAuthed();
document.getElementById('l-email').focus();

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  Nexus.clrErr('l-err');

  const email = Nexus.v('l-email');
  const password = Nexus.v('l-pass');
  if (!email || !password) { Nexus.setErr('l-err', 'Please fill all fields'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  Nexus.setLoading(btn, 'Signing in…');
  try {
    const d = await Nexus.apiPost('/api/v1/authentication/login', { email, password });
    Nexus.saveTokens(d.access_token, d.refresh_token);
    window.location.href = '/app';
  } catch (err) {
    Nexus.setErr('l-err', err.message);
    Nexus.resetBtn(btn, 'Sign in →');
  }
});
