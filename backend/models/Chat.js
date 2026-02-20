const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true
    },
    participants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        enum: ['client', 'freelancer'],
        required: true
      },
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }],
    status: {
      type: String,
      enum: ['active', 'closed', 'archived'],
      default: 'active'
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true 
  }
);

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'system', 'offer'],
      default: 'text'
    },
    // For file messages
    attachments: [{
      url: String,
      filename: String,
      fileType: String,
      fileSize: Number
    }],
    // For offer messages (rate negotiations)
    offerDetails: {
      proposedRate: Number,
      timeline: String,
      description: String
    },
    // Offer negotiation status
    offerStatus: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: function() {
        return this.messageType === 'offer' ? 'pending' : undefined;
      }
    },
    // Message status
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    // AI-generated summary for long messages (shown to freelancers)
    aiSummary: {
      type: String,
      default: null
    },
    aiActionItems: [{
      type: String
    }],
    aiGeneratedAt: {
      type: Date,
      default: null
    },
    aiModel: {
      type: String,
      default: null
    },
    // Sentiment analysis fields
    sentiment: {
      score: {
        type: Number,
        min: -1,
        max: 1
      },
      magnitude: {
        type: Number,
        min: 0
      },
      label: {
        type: String,
        enum: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      tones: [{
        type: String
      }],
      keywords: [{
        type: String
      }],
      isFlagged: {
        type: Boolean,
        default: false
      },
      flagReason: String,
      suggestions: [String]
    },
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  },
  { 
    timestamps: true 
  }
);

// Indexes for performance
chatSchema.index({ project: 1 });
chatSchema.index({ application: 1 });
chatSchema.index({ 'participants.user': 1 });
chatSchema.index({ lastActivity: -1 });

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Chat, Message };
