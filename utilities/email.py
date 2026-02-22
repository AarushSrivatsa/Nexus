import secrets
import resend
from fastapi import BackgroundTasks
from config import RESEND_API_KEY
from datetime import datetime

resend.api_key = RESEND_API_KEY

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
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#080b0f;font-family:'Plus Jakarta Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;background:#080b0f;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="460" cellpadding="0" cellspacing="0" style="max-width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#00d4ff,#0099cc);
                    border-radius:10px;
                    width:32px;height:32px;
                    text-align:center;
                    vertical-align:middle;
                    font-family:'Plus Jakarta Sans',sans-serif;
                    font-size:14px;font-weight:800;color:#000;
                    padding:0;line-height:32px;
                  ">N</td>
                  <td style="padding-left:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#8899b4;">
                    NEXUS
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="
              background:#0d1117;
              border-radius:20px;
              border:1px solid #1e2a3a;
              overflow:hidden;
            ">
              <!-- Accent line -->
              <div style="height:2px;background:linear-gradient(90deg,#00d4ff,#0099cc);"></div>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:44px 44px 36px;">

                    <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:600;color:#e2eaf5;line-height:1.3;letter-spacing:-0.02em;">
                      Verify your identity
                    </p>
                    <p style="margin:0 0 36px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:400;color:#4a5a72;line-height:1.6;">
                      Use the code below to complete your sign in. Valid for 5 minutes.
                    </p>

                    <!-- OTP box -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="
                          background:#080b0f;
                          border:1px solid #1e2a3a;
                          border-radius:14px;
                          padding:28px 20px;
                          text-align:center;
                        ">
                          <span style="
                            font-family:'Fira Code',monospace;
                            font-size:38px;
                            font-weight:500;
                            letter-spacing:14px;
                            color:#00d4ff;
                            text-indent:14px;
                            display:inline-block;
                          ">{otp}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry pill -->
                    <table cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
                      <tr>
                        <td style="
                          padding:6px 14px;
                          background:#00d4ff12;
                          border-radius:100px;
                          border:1px solid #00d4ff22;
                        ">
                          <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#00d4ff;letter-spacing:0.04em;">
                            ⏳ &nbsp;Expires in 5 minutes
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height:1px;background:#1e2a3a;margin:36px 0;"></div>

                    <p style="margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#4a5a72;line-height:1.8;">
                      Didn't request this? You can safely ignore this email — no action needed.
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:18px 44px;border-top:1px solid #111820;">
                    <p style="margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;color:#253347;letter-spacing:0.04em;">
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
</html>
"""

        resend.Emails.send({
            "from": "Nexus <noreply@yourdomain.com>",
            "to": email,
            "subject": "Your Nexus verification code",
            "html": html,
            "text": f"Your Nexus OTP is: {otp}\n\nThis code expires in 5 minutes.\nIf you didn't request this, ignore this email."
        })

    except Exception as e:
        print("Email error:", e)


def send_otp(bg: BackgroundTasks, email: str):
    otp = generate_otp()
    bg.add_task(email_the_otp, email, otp)
    return otp