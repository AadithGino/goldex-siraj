import { Router } from 'express'
import multer from 'multer'
import { config } from '../../config/env.js'
import { uploadFile } from '../../controllers/admin/admin.media.controller.js'
import { authenticateStaff, authorizeStaffRoles } from '../../middlewares/auth.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxBytes, files: 1 } })
router.post('/:kind', authenticateStaff, authorizeStaffRoles('manager'), upload.single('file'), asyncHandler(uploadFile))
export default router
