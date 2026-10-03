import express from 'express'
import { invitationController } from '../../controllers/invitationController.js'
import { authMiddleware } from '../../middlewares/authMiddlewares.js'
import { invitationValidation } from '../../validations/invitationValidation.js'
const Router = express.Router()

Router.route('/board')
  .post(
    authMiddleware.isAuthorized,
    invitationValidation.createNewBoardInvitation,
    invitationController.createNewBoardInvitation
  )
Router.route('/')
// lấy invitation theo user
  .get(
    authMiddleware.isAuthorized,
    invitationController.getInvitations
  )
Router.route('/board/:invitationId')
// lấy invitation theo user
  .put(
    authMiddleware.isAuthorized,
    invitationValidation.updateInvitations,
    invitationController.updateInvitations
  )

export const invitationRouter = Router