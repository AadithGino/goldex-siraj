import { Resend } from 'resend'
import { config } from '../config/env.js'
import { logger } from '../config/logger.js'
import { AppError } from '../utils/AppError.js'
import { resolveStorefrontOrigin } from '../utils/storefrontOrigin.js'

let client = null

function getResendClient() {
  const apiKey = config.otp.resend?.apiKey
  if (!apiKey) {
    throw new AppError(503, 'OTP_PROVIDER_NOT_CONFIGURED', 'Email OTP provider is not configured (RESEND_API_KEY)')
  }
  if (!client) client = new Resend(apiKey)
  return client
}

/**
 * Storefront-matched OTP email: navy brand bar + gold accents, Helvetica/Arial only.
 * Table layout for Outlook; logo from production CDN.
 */
function buildLoginOtpHtml({ to, code, minutes, storefrontUrl }) {
  const origin = String(storefrontUrl || 'https://www.goldexjewellery.ae').replace(/\/+$/, '')
  const logoUrl = `${origin}/GOLDEX2wordmark.png`
  const year = new Date().getFullYear()
  const font = "Helvetica,Arial,sans-serif"
  const loginUrl = `${origin}/login?channel=email&email=${encodeURIComponent(to)}&step=otp`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Your Goldex login code</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:${font};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Your Goldex login code is ${code}. Expires in ${minutes} minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;font-family:${font};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden;font-family:${font};">
          <!-- Logo on white (readable) + navy brand strip -->
          <tr>
            <td style="height:3px;line-height:3px;font-size:0;background:#b8902f;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px 20px;background:#ffffff;">
              <a href="${origin}/" style="text-decoration:none;">
                <img src="${logoUrl}" alt="Goldex Jewellery" width="160" height="auto" style="display:block;width:160px;max-width:70%;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#14213d;padding:14px 24px;text-align:center;">
              <p style="margin:0;font-family:${font};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ffffff;">
                Real gold jewellery · UAE
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 8px;text-align:center;font-family:${font};">
              <p style="margin:0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#b8902f;">
                Account
              </p>
              <h1 style="margin:10px 0 0;font-family:${font};font-size:24px;font-weight:700;line-height:1.3;color:#14213d;">
                Sign in to Goldex
              </h1>
              <p style="margin:12px 0 0;font-family:${font};font-size:15px;line-height:1.6;color:#6b7280;">
                Use this one-time code to access your jewellery account.
              </p>
            </td>
          </tr>
          <!-- OTP on navy panel -->
          <tr>
            <td style="padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#14213d;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:28px 20px;">
                    <p style="margin:0 0 12px;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#d4af5a;">
                      Login code
                    </p>
                    <p style="margin:0;font-family:${font};font-size:36px;font-weight:700;letter-spacing:0.28em;line-height:1.2;color:#ffffff;">
                      ${code}
                    </p>
                    <p style="margin:16px 0 0;font-family:${font};font-size:13px;line-height:1.5;color:#f3e3b3;">
                      Expires in ${minutes} minutes
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td align="center" style="padding:4px 28px 28px;">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;background:#14213d;color:#ffffff;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #0c1730;">
                Enter code &amp; sign in
              </a>
              <p style="margin:14px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#6b7280;">
                Opens login with your email ready — just enter the code above.
              </p>
            </td>
          </tr>
          <!-- Note -->
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <p style="margin:0;font-family:${font};font-size:13px;line-height:1.6;color:#6b7280;">
                If you did not request this code, you can ignore this email. Your account stays secure.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #e6e8ec;text-align:center;background:#ffffff;">
              <p style="margin:0;font-family:${font};font-size:14px;font-weight:600;color:#14213d;">
                Goldex Jewellery
              </p>
              <p style="margin:8px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#6b7280;">
                Real gold jewellery · UAE
              </p>
              <p style="margin:12px 0 0;font-family:${font};font-size:12px;">
                <a href="${origin}/" style="color:#b8902f;text-decoration:none;">goldexjewellery.ae</a>
                &nbsp;·&nbsp;
                <a href="${origin}/search" style="color:#b8902f;text-decoration:none;">Shop</a>
              </p>
              <p style="margin:16px 0 0;font-family:${font};font-size:11px;color:#9ca3af;">
                © ${year} Goldex Jewellery. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send login OTP via official Resend Node SDK.
 * @see https://resend.com/docs/send-with-nodejs
 */
export async function sendLoginOtpEmail({ to, code, idempotencyKey }) {
  const from = config.otp.resend?.fromEmail
  const replyTo = config.otp.resend?.replyTo
  if (!from) {
    throw new AppError(503, 'OTP_PROVIDER_NOT_CONFIGURED', 'RESEND_FROM_EMAIL is not configured')
  }

  const minutes = Math.max(1, Math.round(Number(config.otp.ttlSeconds || 600) / 60))
  const storefrontUrl = resolveStorefrontOrigin()
  const resend = getResendClient()

  const payload = {
    from,
    to: [to],
    subject: 'Your Goldex login code',
    html: buildLoginOtpHtml({ to, code, minutes, storefrontUrl }),
    text: [
      'Goldex Jewellery',
      '',
      `Your login code is ${code}.`,
      `It expires in ${minutes} minutes.`,
      '',
      `Sign in (email ready — enter the code): ${storefrontUrl}/login?channel=email&email=${encodeURIComponent(to)}&step=otp`,
      '',
      'If you did not request this code, you can ignore this email.',
    ].join('\n'),
    tags: [
      { name: 'category', value: 'login_otp' },
      { name: 'app', value: 'goldex' },
    ],
  }
  if (replyTo) payload.replyTo = replyTo

  const { data, error } = await resend.emails.send(payload, {
    idempotencyKey: idempotencyKey || `login-otp/${to}/${code}`,
  })

  if (error) {
    logger.error({ error, to, from }, 'Resend email OTP delivery failed')
    const message = String(error.message || '')
    if (/verify a domain|own email address|testing emails/i.test(message)) {
      throw new AppError(
        502,
        'OTP_EMAIL_DOMAIN_REQUIRED',
        'Resend can only send test emails to the account owner until you verify a domain at resend.com/domains and set RESEND_FROM_EMAIL to that domain',
      )
    }
    throw new AppError(502, 'OTP_DELIVERY_FAILED', message || 'Could not deliver email OTP')
  }

  logger.info({ emailId: data?.id, to }, 'Resend login OTP email sent')
  return data
}
