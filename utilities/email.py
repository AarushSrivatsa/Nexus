import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import BackgroundTasks
from config import SMTP_EMAIL, SMTP_PASSWORD, SMTP_PORT, SMTP_SERVER
from datetime import datetime

def generate_otp(length: int = 6) -> str:
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))

def email_the_otp(email: str, otp: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Verification <{SMTP_EMAIL}>"
        msg["To"] = email
        msg["Subject"] = "Your verification code"

        # Plain-text fallback
        text = f"""
Your OTP is: {otp}

This code is valid for 5 minutes.
If you didn't request this, ignore this email.
"""

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

          <!-- Top label -->
          <tr>
            <td style="padding-bottom:24px; text-align:center;">
              <span style="font-family:'DM Mono', monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#555555;">
                verification required
              </span>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#161616; border-radius:4px; border:1px solid #2a2a2a; overflow:hidden;">

              <!-- Thin accent line -->
              <div style="height:3px; background:linear-gradient(90deg, #c8f542 0%, #42f5b3 100%);"></div>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:52px 48px 40px;">

                    <p style="margin:0 0 8px; font-family:'Fraunces', Georgia, serif; font-size:28px; font-weight:600; color:#f0f0f0; line-height:1.2;">
                      Here's your code.
                    </p>
                    <p style="margin:0 0 44px; font-family:'Fraunces', Georgia, serif; font-style:italic; font-size:16px; font-weight:300; color:#666666; line-height:1.5;">
                      Use it within the next 5 minutes.
                    </p>

                    <!-- OTP display -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="
                          background:#0d0d0d;
                          border:1px solid #2a2a2a;
                          border-radius:4px;
                          padding:32px 24px;
                          text-align:center;
                        ">
                          <span style="
                            font-family:'DM Mono', monospace;
                            font-size:42px;
                            font-weight:500;
                            letter-spacing:16px;
                            color:#c8f542;
                            text-indent:16px;
                            display:inline-block;
                          ">{otp}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry pill -->
                    <table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                      <tr>
                        <td style="
                          padding:8px 16px;
                          background:#1e2a10;
                          border-radius:2px;
                          border:1px solid #3a4f1a;
                        ">
                          <span style="font-family:'DM Mono', monospace; font-size:12px; color:#9ab84a; letter-spacing:1px;">
                            ⏳ expires in 5 minutes
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height:1px; background:#222222; margin:40px 0;"></div>

                    <p style="margin:0; font-family:'Fraunces', Georgia, serif; font-style:italic; font-size:13px; color:#444444; line-height:1.8;">
                      Didn't ask for this? You can safely ignore it —<br>no action is needed on your part.
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Footer -->
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
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)

    except Exception as e:
        print("Email error:", e)


def send_otp(bg: BackgroundTasks, email: str):
    otp = generate_otp()
    bg.add_task(email_the_otp, email, otp)
    return otp
