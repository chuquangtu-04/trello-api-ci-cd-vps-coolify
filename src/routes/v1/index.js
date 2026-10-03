import express from 'express'
import { StatusCodes } from 'http-status-codes'
import { boardRouter } from './boardRoute.js'
import { cardRouter } from './cardRouter.js'
import { columnRouter } from './columnRouter.js'
import { userRouter } from './userRoute.js'
import { invitationRouter } from './invitationRouter.js'
import { uploadRouter } from './uploadRoute.js'
import { aiRouter } from './aiRoute.js'
const Router = express.Router()

// Check Api v1.status
Router.get('/status', (req, res ) => {
  res.status(StatusCodes.OK).json({ message: 'you access about', code: StatusCodes.OK })
})
// Board APIs
Router.use('/boards', boardRouter)
// Column APIs
Router.use('/columns', columnRouter)
// Card APIs
Router.use('/cards', cardRouter)
// Users APIs
Router.use('/users', userRouter)
// invitation APIs
Router.use('/invitations', invitationRouter)
// Upload image APIs
Router.use('/upload', uploadRouter)
// AI APIs
Router.use('/ai', aiRouter)

export const APIs_v1 = Router