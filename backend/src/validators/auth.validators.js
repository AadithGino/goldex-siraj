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
