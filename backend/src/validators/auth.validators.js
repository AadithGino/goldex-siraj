import { z } from 'zod'

export const sendOtpSchema = {
  body: z.object({ phone: z.string().min(8).max(20) }),
}
export const verifyOtpSchema = {
  body: z.object({ phone: z.string().min(8).max(20), code: z.string().regex(/^\d{6}$/) }),
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
