import { Router } from 'express'
import multer from 'multer'
import { rateLimit } from 'express-rate-limit'
import { config } from '../../config/env.js'
import {
  uploadReturnProof,
  uploadSchemeIdProof,
  uploadCustomJewellery,
  uploadSellJewellery,
  uploadSellInvoice,
  presignCustomerMedia,
} from '../../controllers/customer/customer.media.controller.js'
import { authenticateCustomer } from '../../middlewares/auth.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { validate } from '../../middlewares/validate.js'
import { customerMediaPresignSchema } from '../../validators/media.validators.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxBytes, files: 1 } })
const proofLimit = rateLimit({ windowMs: 60 * 60_000, limit: 30, legacyHeaders: false, standardHeaders: 'draft-8' })
const presignLimit = rateLimit({ windowMs: 60 * 60_000, limit: 60, legacyHeaders: false, standardHeaders: 'draft-8' })

router.post(
  '/presign',
  authenticateCustomer,
  presignLimit,
  validate(customerMediaPresignSchema),
  asyncHandler(presignCustomerMedia),
)
router.post('/return-proof', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadReturnProof))
router.post('/scheme-id-proof', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadSchemeIdProof))
router.post('/custom-jewellery', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadCustomJewellery))
router.post('/sell-jewellery', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadSellJewellery))
router.post('/sell-invoice', authenticateCustomer, proofLimit, upload.single('file'), asyncHandler(uploadSellInvoice))
export default router
