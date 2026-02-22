import secrets
import requests
from fastapi import BackgroundTasks
from config import BREVO_API_KEY, BREVO_SENDER_EMAIL
from datetime import datetime

def generate_otp(length: int = 6) -> str:
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))

def email_the_otp(email: str, otp: str):
    try:
        html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your identity</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background:#0d0d0d; font-family:'Fraunces', Georgia, serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh; background:#0d0d0d;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:100%;">
          <tr>
            <td style="padding-bottom:24px; text-align:center;">
              <span style="font-family:'DM Mono', monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#555555;">
                verification required
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#161616; border-radius:4px; border:1px solid #2a2a2a; overflow:hidden;">
              <div style="height:3px; background:linear-gradient(90deg, #c8f542 0%, #42f5b3 100%);"></div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:52px 48px 40px;">
                    <p style="margin:0 0 8px; font-family:'Fraunces', Georgia, serif; font-size:28px; font-weight:600; color:#f0f0f0; line-height:1.2;">
                      Here's your code.
                    </p>
                    <p style="margin:0 0 44px; font-family:'Fraunces', Georgia, serif; font-style:italic; font-size:16px; font-weight:300; color:#666666; line-height:1.5;">
                      Use it within the next 5 minutes.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#0d0d0d; border:1px solid #2a2a2a; border-radius:4px; padding:32px 24px; text-align:center;">
                          <span style="font-family:'DM Mono', monospace; font-size:42px; font-weight:500; letter-spacing:16px; color:#c8f542; text-indent:16px; display:inline-block;">
                            {otp}
                          </span>
                        </td>
                      </tr>
                    </table>
                    <table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                      <tr>
                        <td style="padding:8px 16px; background:#1e2a10; border-radius:2px; border:1px solid #3a4f1a;">
                          <span style="font-family:'DM Mono', monospace; font-size:12px; color:#9ab84a; letter-spacing:1px;">
                            ⏳ expires in 5 minutes
                          </span>
                        </td>
                      </tr>
                    </table>
                    <div style="height:1px; background:#222222; margin:40px 0;"></div>
                    <p style="margin:0; font-family:'Fraunces', Georgia, serif; font-style:italic; font-size:13px; color:#444444; line-height:1.8;">
                      Didn't ask for this? You can safely ignore it —<br>no action is needed on your part.
                    </p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 48px; border-top:1px solid #1e1e1e;">
                    <p style="margin:0; font-family:'DM Mono', monospace; font-size:11px; color:#333333; letter-spacing:1px;">
                      © {datetime.now().year} — all rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "accept": "application/json",
                "api-key": BREVO_API_KEY,
                "content-type": "application/json",
            },
            json={
                "sender": {"name": "Nexus", "email": BREVO_SENDER_EMAIL},
                "to": [{"email": email}],
                "subject": "Your verification code",
                "htmlContent": html,
                "textContent": f"Your OTP is: {otp}\n\nThis code is valid for 5 minutes.\nIf you didn't request this, ignore this email.",
            }
        )
        print("Brevo response:", response.status_code, response.text)

    except Exception as e:
        print("Email error:", e)


def send_otp(bg: BackgroundTasks, email: str):
    otp = generate_otp()
    bg.add_task(email_the_otp, email, otp)
    return otp