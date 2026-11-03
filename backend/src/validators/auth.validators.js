import { z } from 'zod'

const otpChannel = z.enum(['phone', 'email'])

/** Clients often send the unused channel as null — treat as omitted. */
const nullToUndefined = (value) => (value == null || value === '' ? undefined : value)
const optionalPhone = z.preprocess(nullToUndefined, z.string().min(8).max(20).optional())
const optionalEmail = z.preprocess(nullToUndefined, z.email().optional())

export const sendOtpSchema = {
  body: z.object({
    channel: otpChannel.optional().default('phone'),
    phone: optionalPhone,
    email: optionalEmail,
  }).superRefine((value, ctx) => {
    const channel = value.channel || 'phone'
    if (channel === 'phone' && !value.phone) {
      ctx.addIssue({ code: 'custom', message: 'phone is required', path: ['phone'] })
    }
    if (channel === 'email' && !value.email) {
      ctx.addIssue({ code: 'custom', message: 'email is required', path: ['email'] })
    }
  }),
}

export const verifyOtpSchema = {
  body: z.object({
    channel: otpChannel.optional().default('phone'),
    phone: optionalPhone,
    email: optionalEmail,
    code: z.string().regex(/^\d{6}$/),
  }).superRefine((value, ctx) => {
    const channel = value.channel || 'phone'
    if (channel === 'phone' && !value.phone) {
      ctx.addIssue({ code: 'custom', message: 'phone is required', path: ['phone'] })
    }
    if (channel === 'email' && !value.email) {
      ctx.addIssue({ code: 'custom', message: 'email is required', path: ['email'] })
    }
  }),
}

export const staffLoginSchema = {
  body: z.object({ email: z.email(), password: z.string().min(8).max(128) }),
}
export const profileSchema = {
  body: z.object({
    full_name: z.string().min(1).max(120).optional(),
    email: z.email().nullable().optional(),
    avatar_url: z.url().nullable().optional(),
  }),
}
export const changePasswordSchema = {
  body: z.object({
    current_password: z.string().min(8).max(128),
    new_password: z.string().min(8).max(128),
  }),
}

/** Cookie is preferred; body refresh_token supports cross-origin SPAs (S3/CloudFront). */
export const refreshSessionSchema = {
  body: z.object({
    refresh_token: z.string().min(20).max(2000).optional(),
    refreshToken: z.string().min(20).max(2000).optional(),
  }).optional().default({}),
}
