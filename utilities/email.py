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
        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your identity</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background:#05080d; font-family:'DM Sans', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh; background:#05080d;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:100%;">

          <!-- Logo mark + wordmark -->
          <tr>
            <td style="padding-bottom:28px; text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,#00e5ff,#0066ff); text-align:center; vertical-align:middle;">
                    <span style="font-family:'JetBrains Mono', monospace; font-size:14px; font-weight:500; color:#000;">✦</span>
                  </td>
                </tr>
              </table>
              <span style="font-family:'Space Grotesk', sans-serif; font-size:13px; font-weight:700; letter-spacing:0.18em; background:linear-gradient(135deg,#00e5ff,#0066ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; color:#00e5ff;">
                NEXUS
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#080e16; border-radius:16px; border:1px solid #162030; overflow:hidden;">

              <!-- Accent bar -->
              <div style="height:2px; background:linear-gradient(90deg,#00e5ff,#0066ff);"></div>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:48px 44px 36px;">

                    <p style="margin:0 0 6px; font-family:'Space Grotesk', sans-serif; font-size:22px; font-weight:600; color:#eef4ff; letter-spacing:-0.02em; line-height:1.2;">
                      Verify your identity
                    </p>
                    <p style="margin:0 0 40px; font-family:'DM Sans', sans-serif; font-size:14px; font-weight:400; color:#3a5470; line-height:1.6;">
                      Enter this code to continue. It expires in 5 minutes.
                    </p>

                    <!-- OTP box -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#05080d; border:1px solid #1e2e42; border-radius:12px; padding:28px 20px; text-align:center;">
                          <span style="font-family:'JetBrains Mono', monospace; font-size:40px; font-weight:500; letter-spacing:14px; color:#00e5ff; text-indent:14px; display:inline-block;">
                            {otp}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry badge -->
                    <table cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
                      <tr>
                        <td style="padding:7px 14px; background:#00e5ff12; border-radius:100px; border:1px solid #00e5ff22;">
                          <span style="font-family:'Space Grotesk', sans-serif; font-size:11px; font-weight:700; color:#00e5ff; letter-spacing:0.06em;">
                            ⏳ &nbsp;EXPIRES IN 5 MINUTES
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height:1px; background:#0c1520; margin:36px 0;"></div>

                    <p style="margin:0; font-family:'DM Sans', sans-serif; font-size:12px; color:#3a5470; line-height:1.8;">
                      Didn't request this? You can safely ignore this email —<br>no action is needed on your part.
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 44px; border-top:1px solid #080e16;">
                    <p style="margin:0; font-family:'Space Grotesk', sans-serif; font-size:10px; color:#162030; letter-spacing:0.1em; text-transform:uppercase;">
                      © {datetime.now().year} Nexus — all rights reserved
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
</html>"""


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