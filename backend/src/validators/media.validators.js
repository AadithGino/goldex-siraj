import { z } from 'zod'

export const customerMediaPresignSchema = {
  body: z.object({
    kind: z.enum(['custom-jewellery', 'sell-jewellery', 'sell-invoice']),
    content_type: z.string().trim().min(3).max(120),
    content_length: z.coerce.number().finite().positive().max(50 * 1024 * 1024),
  }).strict(),
}
