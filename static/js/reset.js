'use strict';

Nexus.redirectIfAuthed();
document.getElementById('r-email').focus();

let resetStep = 'send';

document.getElementById('r-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  Nexus.clrErr('r-err');
  const email = Nexus.v('r-email');
  const btn = document.getElementById('r-btn');

  if (resetStep === 'send') {
    if (!email) { Nexus.setErr('r-err', 'Please enter your email'); return; }
    Nexus.setLoading(btn, 'Sending…');
    try {
      await Nexus.apiPost('/api/v1/authentication/reset-password/send-otp', { email });
      document.getElementById('r-otp-group').classList.remove('hidden');
      document.getElementById('r-pass-group').classList.remove('hidden');
      document.getElementById('r-pass2-group').classList.remove('hidden');
      document.getElementById('r-email').readOnly = true;
      document.getElementById('r-heading').textContent = 'Check your email';
      document.getElementById('r-sub').textContent = 'Enter the code and choose a new password';
      resetStep = 'verify';
      Nexus.resetBtn(btn, 'Reset password →');
      document.getElementById('r-otp').focus();
      Nexus.toast('Code sent');
    } catch (err) {
      Nexus.setErr('r-err', err.message);
      Nexus.resetBtn(btn, 'Send code →');
    }
  } else {
    const otp = Nexus.v('r-otp'), pass = Nexus.v('r-pass'), pass2 = Nexus.v('r-pass2');
    if (!otp)             { Nexus.setErr('r-err', 'Please enter the code'); return; }
    if (pass !== pass2)   { Nexus.setErr('r-err', 'Passwords do not match'); return; }
    if (pass.length < 8)  { Nexus.setErr('r-err', 'Minimum 8 characters'); return; }
    Nexus.setLoading(btn, 'Resetting…');
    try {
      const d = await Nexus.apiPost('/api/v1/authentication/reset-password/' + encodeURIComponent(email), { otp, new_password: pass });
      Nexus.saveTokens(d.access_token, d.refresh_token);
      window.location.href = '/app';
    } catch (err) {
      Nexus.setErr('r-err', err.message);
      Nexus.resetBtn(btn, 'Reset password →');
    }
  }
});
