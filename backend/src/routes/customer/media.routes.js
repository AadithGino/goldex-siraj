import { Router } from 'express'
import multer from 'multer'
import { rateLimit } from 'express-rate-limit'
import { config } from '../../config/env.js'
import { uploadReturnProof } from '../../controllers/customer/customer.media.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxBytes, files: 1 } })
const proofLimit = rateLimit({ windowMs: 60 * 60_000, limit: 30, legacyHeaders: false, standardHeaders: 'draft-8' })
router.post('/return-proof', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadReturnProof))
export default router
