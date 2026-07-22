import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { Staff } from '../src/models/auth.models.js'
import { hashPassword } from '../src/services/auth.service.js'

const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
const password = process.env.OWNER_PASSWORD
const fullName = process.env.OWNER_NAME?.trim() || 'Store Owner'

if (!email || !password || password.length < 12) {
  process.stderr.write('Set OWNER_EMAIL and an OWNER_PASSWORD of at least 12 characters.\n')
  process.exit(1)
}

try {
  await connectDatabase()
  const existing = await Staff.findOne({ email })
  if (existing) throw new Error('A staff account with this email already exists')
  const owner = await Staff.create({ email, fullName, role: 'owner', passwordHash: await hashPassword(password), isActive: true })
  process.stdout.write(`Owner created: ${owner.email}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
