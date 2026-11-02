#!/usr/bin/env node
/**
 * Diagnose WhatsApp Cloud OTP (same path as customer login).
 * Usage: cd backend && node scripts/test-whatsapp-otp.js +971501234567
 */
import 'dotenv/config'
import { sendOtp } from '../src/services/auth.service.js'
import { config } from '../src/config/env.js'

const phone = process.argv[2]
if (!phone) {
  console.error('Usage: node scripts/test-whatsapp-otp.js <E.164 phone>')
  process.exit(1)
}

console.log('OTP_PROVIDER:', config.otp.provider)
console.log('Template:', config.otp.whatsappCloud?.templateName)
console.log('Phone number ID:', config.otp.whatsappCloud?.phoneNumberId ? 'set' : 'MISSING')
console.log('Access token:', config.otp.whatsappCloud?.accessToken ? 'set' : 'MISSING')
console.log('Sending test OTP to', phone, '…\n')

try {
  const result = await sendOtp(phone)
  console.log('OK — OTP challenge created.')
  if (result.test_otp) console.log('test_otp (dev only):', result.test_otp)
} catch (error) {
  console.error('FAILED:', error.code || error.message)
  if (error.message) console.error(error.message)
  console.error('\nCommon fixes:')
  console.error('  • Regenerate WHATSAPP_ACCESS_TOKEN in Meta Business Suite (tokens expire).')
  console.error('  • Confirm WHATSAPP_TEMPLATE_NAME is approved (goldex_login_otp).')
  console.error('  • WHATSAPP_PHONE_NUMBER_ID must match the sending number.')
  process.exit(1)
}
