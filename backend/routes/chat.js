const express = require('express');
const { Chat, Message } = require('../models/Chat');
const Application = require('../models/Application');
const { auth } = require('../middlewares/auth');
const { shouldSummarize, summarizeMessage } = require('../services/chatSummarizer');
const router = express.Router();

// GET /api/chats - Get user's chats
router.get('/', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 GET USER CHATS - User ID:', req.user.userId);
  try {
    const chats = await Chat.find({
      'participants.user': req.user.userId,
      status: { $ne: 'archived' }
    })
    .populate({
      path: 'project',
      select: 'title category categoryName status'
    })
    .populate({
      path: 'application',
      select: 'status proposedRate'
    })
    .populate({
      path: 'participants.user',
      select: 'fullName profilePicture rating.average'
    })
    .populate({
      path: 'lastMessage',
      select: 'content messageType createdAt sender',
      populate: {
        path: 'sender',
        select: 'fullName'
      }
    })
    .sort('-lastActivity');

    console.log('✅ Found', chats.length, 'chats');
    res.json({
      success: true,
      chats
    });
  } catch (error) {
    console.error('❌ Error fetching chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats',
      error: error.message
    });
  }
});

// GET /api/chats/:chatId - Get specific chat with messages
router.get('/:chatId', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 GET CHAT DETAILS - Chat ID:', req.params.chatId);
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Find chat and verify user access
    const chat = await Chat.findById(chatId)
      .populate({
        path: 'project',
        select: 'title description budgetAmount budgetType deadline status category categoryName agreedPrice priceLockedAt finalRate',
        populate: {
          path: 'client',
          select: 'fullName profilePicture rating.average'
        }
      })
      .populate({
        path: 'application',
        select: 'status proposedRate proposedTimeline coverLetter',
        populate: {
          path: 'freelancer',
          select: 'fullName profilePicture rating.average profile.skills profile.hourlyRate'
        }
      })
      .populate({
        path: 'participants.user',
        select: 'fullName profilePicture rating.average'
      });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => p.user._id.toString() === req.user.userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat.'
      });
    }

    // Get messages with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await Message.find({ chat: chatId })
      .populate({
        path: 'sender',
        select: 'fullName profilePicture'
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Reverse messages to show oldest first
    messages.reverse();

    // Mark messages as read by current user
    await Message.updateMany(
      { 
        chat: chatId, 
        sender: { $ne: req.user.userId },
        'readBy.user': { $ne: req.user.userId }
      },
      {
        $addToSet: {
          readBy: {
            user: req.user.userId,
            readAt: new Date()
          }
        }
      }
    );

    const totalMessages = await Message.countDocuments({ chat: chatId });
    const totalPages = Math.ceil(totalMessages / parseInt(limit));

    console.log('✅ Chat details retrieved with', messages.length, 'messages');
    res.json({
      success: true,
      chat,
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMessages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching chat details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat details',
      error: error.message
    });
  }
});

// POST /api/chats/:chatId/messages - Send message
router.post('/:chatId/messages', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 SEND MESSAGE - Chat ID:', req.params.chatId);
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text', attachments = [], offerDetails } = req.body;

    if (!content && messageType === 'text') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (content && content.length > 10000) {
      return res.status(400).json({
        success: false,
        message: `Message is too long (${content.length} characters). Maximum allowed is 10,000 characters.`
      });
    }

    // Verify chat exists and user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const isParticipant = chat.participants.some(
      p => p.user.toString() === req.user.userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat.'
      });
    }

    if (chat.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages to a closed chat'
      });
    }

    // --- Offer cap enforcement for freelancers ---
    if (messageType === 'offer' && offerDetails?.proposedRate) {
      const Project = require('../models/Project');
      const project = await Project.findById(chat.project);

      if (project?.agreedPrice) {
        return res.status(400).json({
          success: false,
          message: `Price is already locked at ₹${project.agreedPrice.toLocaleString()}. No further offers allowed.`
        });
      }

      // Determine sender role
      const senderParticipant = chat.participants.find(
        p => p.user.toString() === req.user.userId
      );

      if (senderParticipant?.role === 'freelancer' && project?.budgetAmount) {
        const maxAllowed = project.budgetAmount * 1.20; // 20% above client budget
        if (offerDetails.proposedRate > maxAllowed) {
          return res.status(400).json({
            success: false,
            message: `Offer exceeds the allowed maximum of ₹${maxAllowed.toLocaleString()} (20% above project budget of ₹${project.budgetAmount.toLocaleString()}).`,
            maxAllowed,
            clientBudget: project.budgetAmount
          });
        }
      }
    }

    // Create message
    const message = new Message({
      chat: chatId,
      sender: req.user.userId,
      content,
      messageType,
      attachments,
      offerDetails,
      offerStatus: messageType === 'offer' ? 'pending' : undefined,
      readBy: [{
        user: req.user.userId,
        readAt: new Date()
      }]
    });

    await message.save();

    // --- AI summarization for long client messages (non-blocking) ---
    if (messageType === 'text' && shouldSummarize(content)) {
      try {
        // Figure out project title for better context
        const chatWithProject = await Chat.findById(chatId).populate('project', 'title').lean();
        const projectTitle = chatWithProject?.project?.title || '';

        // Determine sender role (is the sender a client?)
        const senderParticipant = chat.participants.find(
          p => p.user.toString() === req.user.userId
        );
        const isClientSender = senderParticipant?.role === 'client';

        if (isClientSender) {
          const result = await summarizeMessage(content, projectTitle);
          if (result) {
            message.aiSummary = result.summary;
            message.aiActionItems = result.actionItems;
            message.aiGeneratedAt = new Date();
            message.aiModel = 'llama-3.3-70b-versatile';
            await message.save();
            console.log('🤖 AI summary attached to message', message._id);
          }
        }
      } catch (aiErr) {
        console.warn('⚠️ AI summarization failed (non-blocking):', aiErr.message);
      }
    }

    // Populate sender info
    await message.populate({
      path: 'sender',
      select: 'fullName profilePicture'
    });

    // Update chat's last message and activity
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();
    await chat.save();

    // Emit real-time event via Socket.IO to chat room
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('message-received', {
        chatId,
        message: message.toObject(),
      });
      console.log('📡 Real-time message emitted to chat room:', chatId);
    }

    console.log('✅ Message sent successfully');
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// PUT /api/chats/:chatId/close - Close chat (client only)
router.put('/:chatId/close', auth(['client']), async (req, res) => {
  console.log('🔥 CLOSE CHAT - Chat ID:', req.params.chatId);
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId).populate('project');
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Verify user is the project client
    if (chat.project.client.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the project client can close the chat'
      });
    }

    chat.status = 'closed';
    await chat.save();

    // Send system message
    const systemMessage = new Message({
      chat: chatId,
      sender: req.user.userId,
      content: 'Chat has been closed by the client.',
      messageType: 'system'
    });

    await systemMessage.save();

    console.log('✅ Chat closed successfully');
    res.json({
      success: true,
      message: 'Chat closed successfully'
    });
  } catch (error) {
    console.error('❌ Error closing chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close chat',
      error: error.message
    });
  }
});

// POST /api/chats/:chatId/award - Award project to freelancer (client only)
router.post('/:chatId/award', auth(['client']), async (req, res) => {
  console.log('🔥 AWARD PROJECT - Chat ID:', req.params.chatId);
  try {
    const { chatId } = req.params;
    const { finalRate, finalTimeline, terms } = req.body;

    const chat = await Chat.findById(chatId)
      .populate('project')
      .populate('application');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Verify user is the project client
    if (chat.project.client.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the project client can award the project'
      });
    }

    if (chat.project.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Project has already been completed'
      });
    }

    // Update project status
    chat.project.status = 'in_progress';
    // You could add awardedTo field to project schema
    // chat.project.awardedTo = chat.application.freelancer;
    await chat.project.save();

    // Send system message about award
    const systemMessage = new Message({
      chat: chatId,
      sender: req.user.userId,
      content: `Project awarded! Final rate: Rs.${finalRate}. Timeline: ${finalTimeline}`,
      messageType: 'system',
      offerDetails: {
        proposedRate: finalRate,
        timeline: finalTimeline,
        description: terms
      }
    });

    await systemMessage.save();

    // Update chat
    chat.lastMessage = systemMessage._id;
    chat.lastActivity = new Date();
    await chat.save();

    console.log('✅ Project awarded successfully');
    res.json({
      success: true,
      message: 'Project awarded successfully',
      details: {
        finalRate,
        finalTimeline,
        terms
      }
    });
  } catch (error) {
    console.error('❌ Error awarding project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to award project',
      error: error.message
    });
  }
});

// POST /api/chats/application/:applicationId - Create or get chat for an application
router.post('/application/:applicationId', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 CREATE/GET CHAT FOR APPLICATION - Application ID:', req.params.applicationId);
  try {
    const { applicationId } = req.params;

    // Find the application
    const application = await Application.findById(applicationId)
      .populate('project')
      .populate('freelancer', 'fullName profilePicture')
      .populate('client', 'fullName profilePicture');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify user is either the client or freelancer
    const isClient = application.client._id.toString() === req.user.userId;
    const isFreelancer = application.freelancer._id.toString() === req.user.userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not involved in this application.'
      });
    }

    // Check if chat already exists for this application
    let chat = await Chat.findOne({ application: applicationId })
      .populate({
        path: 'participants.user',
        select: 'fullName profilePicture'
      });

    if (chat) {
      console.log('✅ Chat already exists for this application');
      return res.json({
        success: true,
        chat,
        message: 'Chat already exists'
      });
    }

    // Create new chat
    chat = new Chat({
      project: application.project._id,
      application: applicationId,
      participants: [
        {
          user: application.client._id,
          role: 'client',
          joinedAt: new Date()
        },
        {
          user: application.freelancer._id,
          role: 'freelancer',
          joinedAt: new Date()
        }
      ],
      status: 'active',
      lastActivity: new Date()
    });

    await chat.save();

    // Populate the created chat
    await chat.populate({
      path: 'participants.user',
      select: 'fullName profilePicture'
    });

    // Create initial system message
    const initialMessage = new Message({
      chat: chat._id,
      sender: req.user.userId,
      messageType: 'system',
      content: `Chat started for project: ${application.project.title}`,
      readBy: [
        {
          user: req.user.userId,
          readAt: new Date()
        }
      ]
    });

    await initialMessage.save();
    chat.lastMessage = initialMessage._id;
    await chat.save();

    console.log('✅ Chat created successfully for application');
    res.status(201).json({
      success: true,
      chat,
      message: 'Chat created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating chat for application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat',
      error: error.message
    });
  }
});

// PUT /api/chats/messages/:messageId/respond-to-offer - Accept or decline an offer
router.put('/messages/:messageId/respond-to-offer', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 RESPOND TO OFFER - Message ID:', req.params.messageId);
  try {
    const { messageId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    if (!action || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "accept" or "decline"'
      });
    }

    // Find the offer message
    const message = await Message.findById(messageId)
      .populate('chat')
      .populate('sender', 'fullName');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.messageType !== 'offer') {
      return res.status(400).json({
        success: false,
        message: 'This message is not an offer'
      });
    }

    if (message.offerStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This offer has already been ${message.offerStatus}`
      });
    }

    // Verify user is participant in this chat
    const chat = await Chat.findById(message.chat._id);
    const isParticipant = chat.participants.some(
      p => p.user.toString() === req.user.userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only the person who didn't send the offer can accept/decline it
    if (message.sender._id.toString() === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot respond to your own offer'
      });
    }

    // Update offer status
    message.offerStatus = action === 'accept' ? 'accepted' : 'declined';
    await message.save();

    // If accepted, lock in the agreed price across project, application, milestones
    if (action === 'accept' && message.offerDetails) {
      const Application = require('../models/Application');
      const Project = require('../models/Project');
      const Milestone = require('../models/Milestone');
      const Workspace = require('../models/Workspace');
      
      // Find the application for this chat's project
      const application = await Application.findOne({
        project: chat.project,
        $or: [
          { freelancer: chat.participants[0].user },
          { freelancer: chat.participants[1].user }
        ]
      });

      const agreedAmount = message.offerDetails.proposedRate;
      const agreedTimeline = message.offerDetails.timeline;

      if (application) {
        application.proposedRate = agreedAmount;
        application.proposedTimeline = agreedTimeline;
        application.negotiatedAt = new Date();
        // Mark application as accepted (NOT awarded) - client must click "Select for Job" to award
        if (application.status === 'pending') {
          application.status = 'accepted';
        }
        application.respondedAt = new Date();
        await application.save();
        console.log('✅ Application accepted with negotiated rate:', agreedAmount, '(client must Select for Job to award)');
      }

      // Lock the agreed price on the project (but do NOT auto-award - client must Select for Job)
      const project = await Project.findById(chat.project);
      if (project) {
        project.agreedPrice = agreedAmount;
        project.finalRate = agreedAmount;
        project.budgetAmount = agreedAmount; // Overwrite budget so milestones & cards use it
        project.priceLockedAt = new Date();
        project.priceLockedBy = 'offer_accepted';
        project.finalTimeline = agreedTimeline;

        // Do NOT auto-award the project - the client must click "Select for Job"
        // Just keep the project status as-is (open/pending) so the Select for Job button appears

        // Record in negotiation history
        project.negotiationHistory.push({
          offeredBy: message.sender._id || message.sender,
          offeredByRole: chat.participants.find(p => p.user.toString() === (message.sender._id || message.sender).toString())?.role,
          amount: agreedAmount,
          timeline: agreedTimeline,
          status: 'accepted',
          respondedBy: req.user.userId,
          respondedAt: new Date()
        });

        // Recalculate service charges with the agreed price
        const serviceChargePercentage = project.serviceChargePercentage || 5;
        const fixedServiceCharge = project.serviceCharge || 35;
        project.totalProjectValue = agreedAmount + Math.max(fixedServiceCharge, (agreedAmount * serviceChargePercentage) / 100);

        await project.save();
        console.log('✅ Project agreedPrice locked at:', agreedAmount, '- awaiting client Select for Job');
      }

      // Decline any other pending offers in this chat
      const declinedOffers = await Message.updateMany(
        {
          chat: message.chat._id,
          messageType: 'offer',
          offerStatus: 'pending',
          _id: { $ne: message._id }
        },
        { offerStatus: 'declined' }
      );
      console.log(`✅ Auto-declined ${declinedOffers.modifiedCount} other pending offers`);
    } else if (action === 'decline' && message.offerDetails) {
      // Record declined offer in project negotiation history
      const Project = require('../models/Project');
      const project = await Project.findById(chat.project);
      if (project) {
        project.negotiationHistory.push({
          offeredBy: message.sender._id || message.sender,
          offeredByRole: chat.participants.find(p => p.user.toString() === (message.sender._id || message.sender).toString())?.role,
          amount: message.offerDetails.proposedRate,
          timeline: message.offerDetails.timeline,
          status: 'declined',
          respondedBy: req.user.userId,
          respondedAt: new Date()
        });
        await project.save();
      }
    }

    // Send a system message about the response
    const responseMessage = new Message({
      chat: message.chat._id,
      sender: req.user.userId,
      content: action === 'accept' 
        ? `✅ Offer accepted: Rs.${message.offerDetails.proposedRate} - ${message.offerDetails.timeline}`
        : `❌ Offer declined`,
      messageType: 'system',
      readBy: [{
        user: req.user.userId,
        readAt: new Date()
      }]
    });
    await responseMessage.save();
    await responseMessage.populate('sender', 'fullName');

    // Emit real-time events
    const io = req.app.get('io');
    if (io) {
      io.to(message.chat._id.toString()).emit('offer-response', {
        messageId: message._id,
        offerStatus: message.offerStatus,
        responseMessage: responseMessage.toObject()
      });
      io.to(message.chat._id.toString()).emit('message-received', {
        chatId: message.chat._id,
        message: responseMessage.toObject()
      });
    }

    console.log(`✅ Offer ${action}ed successfully`);
    res.json({
      success: true,
      message: `Offer ${action}ed successfully`,
      data: {
        message: message.toObject(),
        responseMessage: responseMessage.toObject()
      }
    });
  } catch (error) {
    console.error('❌ Error responding to offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to offer',
      error: error.message
    });
  }
});

module.exports = router;
