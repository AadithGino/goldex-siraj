import { signMediaUrls } from '../services/storage.service.js'

/**
 * Send a success payload. Media object refs (our S3 keys/URLs) are replaced
 * with fresh presigned GET URLs so private buckets work in the browser.
 */
export async function ok(res, data, status = 200, meta) {
  const signed = await signMediaUrls(data)
  return res.status(status).json({ success: true, data: signed, ...(meta ? { meta } : {}) })
}
