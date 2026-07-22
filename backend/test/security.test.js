import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'

describe('security boundaries', () => {
  it('rejects unauthenticated admin access', async () => {
    const response = await request(app).get('/api/v1/admin/reports/sales').expect(401)
    expect(response.body.error.code).toBe('AUTH_REQUIRED')
  })

  it('removes Mongo operator keys from request bodies', async () => {
    const response = await request(app).post('/api/v1/customer/auth/otp/send').send({ phone: { $gt: '' } }).expect(422)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
