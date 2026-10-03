import express from 'express'
import { authMiddleware } from '../../middlewares/authMiddlewares.js'
import { multerUploadMiddleware } from '../../middlewares/multerUploadMidlleware.js'
import { uploadController } from '../../controllers/uploadController.js'

const Router = express.Router()

Router.route('/')
  .post(
    authMiddleware.isAuthorized,
    multerUploadMiddleware.upload.single('image'),
    uploadController.uploadImage
  )

export const uploadRouter = Router
