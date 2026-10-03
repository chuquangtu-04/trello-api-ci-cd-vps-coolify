import express from 'express'
import { aiController } from '../../controllers/aiController.js'
import { authMiddleware } from '../../middlewares/authMiddlewares.js'

const Router = express.Router()

// Route cho AI Chatbot - Yêu cầu đăng nhập
Router.route('/chat')
  .post(authMiddleware.isAuthorized, aiController.chat)

export const aiRouter = Router
