#!/usr/bin/env node
/**
 * Send a login OTP via Resend (same path as email login).
 * Usage: cd backend && node scripts/test-resend-otp.js you@example.com
 *
 * With RESEND_FROM_EMAIL=...@resend.dev you can only send to the Resend account owner email
 * until a domain is verified: https://resend.com/domains
 */
import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { config } from '../src/config/env.js'
import { sendOtp } from '../src/services/auth.service.js'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/test-resend-otp.js <email>')
  process.exit(1)
}

console.log('RESEND_API_KEY:', config.otp.resend?.apiKey ? 'set' : 'MISSING')
console.log('RESEND_FROM_EMAIL:', config.otp.resend?.fromEmail)
console.log('Sending login OTP to', email, '…\n')

await connectDatabase()
try {
  const result = await sendOtp({ channel: 'email', email })
  console.log('OK', result)
} catch (error) {
  console.error('FAILED:', error.code || error.message)
  console.error(error.message)
  console.error('\nSee: https://resend.com/docs/introduction')
  console.error('Verify domain: https://resend.com/domains')
  process.exitCode = 1
} finally {
  await disconnectDatabase().catch(() => null)
}
