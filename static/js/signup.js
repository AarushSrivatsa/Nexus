'use strict';

Nexus.redirectIfAuthed();
document.getElementById('s-email').focus();

let signupEmail = null;
let otpTimer = null;

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

function goBackToEmail() {
  document.getElementById('s-step-otp').classList.add('hidden');
  document.getElementById('s-step-email').classList.remove('hidden');
  document.getElementById('s-footer-link').classList.remove('hidden');
  document.getElementById('s-heading').textContent = 'Create account';
  document.getElementById('s-sub').textContent = 'Get started in a few seconds';
  document.getElementById('s-otp').value = '';
  Nexus.clrErr('s-err2');
  clearInterval(otpTimer);
}
window.goBackToEmail = goBackToEmail;

async function resendOTP() {
  if (!signupEmail) { Nexus.toast('No email on record — go back and try again', true); return; }
  try {
    const password = document.getElementById('s-pass').value;
    await Nexus.apiPost('/api/v1/authentication/signup/send-otp', { email: signupEmail, password });
    startOtpTimer();
    Nexus.toast('Code resent');
  } catch (err) { Nexus.toast('Failed to resend: ' + err.message, true); }
}
window.resendOTP = resendOTP;

document.getElementById('s-step-email').addEventListener('submit', async (e) => {
  e.preventDefault();
  Nexus.clrErr('s-err');

  const email = Nexus.v('s-email'), password = Nexus.v('s-pass'), pass2 = Nexus.v('s-pass2');
  if (!email || !password || !pass2) { Nexus.setErr('s-err', 'Please fill all fields'); return; }
  if (password !== pass2)  { Nexus.setErr('s-err', 'Passwords do not match'); return; }
  if (password.length < 8) { Nexus.setErr('s-err', 'Minimum 8 characters'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  Nexus.setLoading(btn, 'Sending…');
  try {
    await Nexus.apiPost('/api/v1/authentication/signup/send-otp', { email, password });
    signupEmail = email;
    document.getElementById('s-step-email').classList.add('hidden');
    document.getElementById('s-step-otp').classList.remove('hidden');
    document.getElementById('s-footer-link').classList.add('hidden');
    document.getElementById('s-email-display').textContent = email;
    document.getElementById('s-heading').textContent = 'Check your email';
    document.getElementById('s-sub').textContent = 'Enter the code we just sent you';
    startOtpTimer();
    Nexus.toast('Code sent to your email');
  } catch (err) {
    Nexus.setErr('s-err', err.message);
  } finally {
    Nexus.resetBtn(btn, 'Send code →');
  }
});

document.getElementById('s-step-otp').addEventListener('submit', async (e) => {
  e.preventDefault();
  Nexus.clrErr('s-err2');
  const otp = Nexus.v('s-otp');
  if (!otp) { Nexus.setErr('s-err2', 'Please enter the code'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  Nexus.setLoading(btn, 'Verifying…');
  try {
    const d = await Nexus.apiPost('/api/v1/authentication/signup/verify-otp/' + encodeURIComponent(signupEmail), { otp });
    Nexus.saveTokens(d.access_token, d.refresh_token);
    window.location.href = '/app';
  } catch (err) {
    Nexus.setErr('s-err2', err.message);
    Nexus.resetBtn(btn, 'Verify →');
  }
});
