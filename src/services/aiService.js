/* eslint-disable no-console */
import { OpenRouter } from '@openrouter/sdk'
import { env } from '../config/environment.js'
import { boardModel } from '../models/boardModel.js'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../utils/ApiError.js'
import moment from 'moment'

// Khởi tạo OpenRouter
const openrouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY
})

const buildBoardContext = async (userId, boardId) => {
  const board = await boardModel.getDetails(userId, boardId)
  if (!board) throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found')

  // Kết hợp owners và members thành một danh sách duy nhất để AI nhận diện đúng tất cả thành viên
  const allBoardMembers = [...(board.owners || []), ...(board.members || [])]

  const context = {
    title: board.title,
    description: board.description,
    columns: board.columns.map(col => {
      // Lọc ra các card thuộc về column này và không phải là placeholder card
      const columnCards = board.cards.filter(card =>
        card.columnId.toString() === col._id.toString() &&
        !card.FE_PlaceholderCard
      )

      return {
        columnId: col._id,
        title: col.title,
        cardCount: columnCards.length,
        cards: columnCards.map(card => {
          // Ánh xạ memberIds sang thông tin displayName/email của thành viên (quét qua cả owners và members)
          const cardMembers = allBoardMembers
            .filter(m => card.memberIds?.some(id => id.toString() === m._id.toString()))
            .map(m => `${m.displayName} (${m.email})`)

          return {
            cardId: card._id,
            title: card.title,
            description: card.description || 'None',
            members: cardMembers.length > 0 ? cardMembers : 'No members assigned',
            startDate: card.startDate || 'None',
            dueDate: card.dueDate ? `${card.dueDate} ${card.dueTime || ''}`.trim() : 'None',
            isOverdue: card.dueDate && !card.completed && moment(`${card.dueDate} ${card.dueTime || '23:59'}`, 'YYYY-MM-DD HH:mm').isBefore(moment()),
            reminder: card.reminder ? `${card.reminder.value} ${card.reminder.unit}` : 'None',
            repeat: card.repeat || 'None',
            completed: !!card.completed,
            labels: card.labels?.map(l => l.name) || [],
            commentCount: card.comments?.length || 0,
            attachmentCount: card.attachments?.length || 0,
            cover: card.cover || 'None'
          }
        })
      }
    }),
    totalCards: board.cards.filter(card => !card.FE_PlaceholderCard).length,
    boardMembers: allBoardMembers.map(m => `${m.displayName} (${m.email})`)
  }

  return JSON.stringify(context)
}

const chat = async (userId, boardId, userMessage) => {
  try {
    // Lưu ý: KHÔNG dùng 401 cho lỗi của dịch vụ AI, vì Front-end coi mọi 401 là hết phiên đăng nhập và sẽ tự logout người dùng.
    if (!env.OPENROUTER_API_KEY) {
      throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Thiếu OPENROUTER_API_KEY. Vui lòng cấu hình OpenRouter API key trong biến môi trường.')
    }

    const boardContext = await buildBoardContext(userId, boardId)

    const systemPrompt = `
      Bạn là AI Workspace Assistant cho ứng dụng quản lý công việc Trello Clone.
      Dưới đây là dữ liệu hiện tại của Board (JSON format):
      ${boardContext}

      Nhiệm vụ của bạn:
      1. Trả lời các câu hỏi về tiến độ, các task quá hạn, hoặc tóm tắt project.
      2. Nếu người dùng yêu cầu tạo task mới (ví dụ: "Tạo task cho tính năng X"), hãy gợi ý các task cụ thể kèm theo mô tả ngắn.
      3. Luôn trả lời ngắn gọn, chuyên nghiệp và thân thiện bằng tiếng Việt.
      4. Nếu có các task overdue (quá hạn so với thời điểm hiện tại: ${moment().format('YYYY-MM-DD HH:mm')}), hãy nhắc nhở người dùng.
      
      QUAN TRỌNG: Nếu người dùng yêu cầu "tạo task" hoặc "generate tasks", hãy trả về kết quả theo định dạng JSON ở CUỐI câu trả lời của bạn (sau một dòng phân cách "---TASKS_JSON---") để hệ thống có thể tự động xử lý. Định dạng JSON là một mảng các object: [{"title": "tên task", "description": "mô tả"}]
    `

    const response = await openrouter.chat.send({
      chatRequest: {
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      }
    })

    // OpenRouter SDK returns choices[0].message.content
    const responseText = response.choices[0]?.message?.content || ''

    return responseText
  } catch (error) {
    console.error('OpenRouter AI Service Error Details:', error)

    // Lỗi do chính hệ thống mình ném ra (vd: Board not found) thì giữ nguyên
    if (error instanceof ApiError) throw error

    // Lỗi từ OpenRouter SDK: SDK gắn mã HTTP vào statusCode (hoặc status).
    // Chuyển các mã này sang 502/503 để Front-end KHÔNG hiểu nhầm là hết phiên đăng nhập (401) mà logout người dùng.
    const upstreamStatus = error.statusCode || error.status
    const detail = error.message || 'Unknown Error'

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, `OpenRouter API Key không hợp lệ hoặc đã hết hạn. Vui lòng tạo key mới và cập nhật OPENROUTER_API_KEY. Chi tiết: ${detail}`)
    }
    if (upstreamStatus === 402) {
      throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Tài khoản OpenRouter đã hết credit. Vui lòng nạp thêm hoặc đổi sang model miễn phí.')
    }
    if (upstreamStatus === 429) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'OpenRouter đang bị quá tải hoặc hết hạn mức. Vui lòng thử lại sau.')
    }
    if (upstreamStatus === 400 || upstreamStatus === 404) {
      throw new ApiError(StatusCodes.BAD_GATEWAY, `Model AI không khả dụng trên OpenRouter, hãy kiểm tra OPENROUTER_MODEL. Chi tiết: ${detail}`)
    }

    throw new ApiError(StatusCodes.BAD_GATEWAY, `AI Assistant hiện không khả dụng qua OpenRouter. Chi tiết: ${detail}`)
  }
}

export const aiService = { chat }
