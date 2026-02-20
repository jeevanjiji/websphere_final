// backend/server.js
require('dotenv').config();

console.log('[DEBUG] MONGODB_URI from env:', process.env.MONGODB_URI);

// Initialize Cloudinary
const { validateCloudinaryConfig } = require('./utils/cloudinaryConfig');
validateCloudinaryConfig();

const express   = require('express');
const cors      = require('cors');
const mongoose  = require('mongoose');
const path      = require('path');
const session   = require('express-session');
const MongoStore = require('connect-mongo');
const http      = require('http');
const socketIo  = require('socket.io');
const JobScheduler = require('./jobs/scheduler');
const EscrowScheduler = require('./jobs/escrowScheduler');

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://websphere-w8k6.onrender.com';


const app  = express();
const server = http.createServer(app);
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production'
      ? [FRONTEND_URL]
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:8000']);

const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

/* ──────────────────────────────────────────
   Global Middleware
────────────────────────────────────────── */
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true
  })
);

  // ...existing code...
  app.set('io', io);
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} – ${req.method} ${req.path}`);
  next();
});

/* ──────────────────────────────────────────
   MongoDB Connection
────────────────────────────────────────── */
const connectDB = async (retries = 5) => {
  try {
    console.log('🔄 Connecting to MongoDB Atlas…');

    if (!process.env.MONGODB_URI)
      throw new Error('MONGODB_URI environment variable is not set');

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ MongoDB Atlas Connected!');
    console.log(`📊 Host: ${conn.connection.host}`);
    console.log(`🗃️ Database: ${conn.connection.name}`);
    
    // Start milestone deadline checker
    const { startDeadlineChecker } = require('./middlewares/deadlineCheck');
    startDeadlineChecker();
    
    // Initialize job scheduler for due date notifications
    JobScheduler.init();
    
    // Initialize escrow scheduler for automatic fund releases
    EscrowScheduler.start();
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    if (retries > 0) {
      console.log(`🔄 Retrying… (${retries} attempts left)`);
      setTimeout(() => connectDB(retries - 1), 5_000);
    } else {
      console.error('💀 Max retries reached. Exiting…');
      process.exit(1);
    }
  }
};
connectDB();

/* ──────────────────────────────────────────
   Static File Serving - BEFORE 404 handlers
────────────────────────────────────────── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ──────────────────────────────────────────
   Routers
────────────────────────────────────────── */
console.log('📁 Loading routers…');

// Auth router
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
  console.log('✅ Auth router connected → /api/auth');
} catch (err) {
  console.error('❌ Failed to load auth router:', err.message);
  console.error('Full error:', err);
}

// Admin router (optional)
try {
  const adminRouter = require('./routes/admin');
  app.use('/api/admin', adminRouter);
  console.log('✅ Admin router connected → /api/admin');
} catch (err) {
  console.warn('ℹ️  No admin router found – skipping');
}

// Project router
try {
  const projectRouter = require('./routes/project');
  app.use('/api/projects', projectRouter);
  console.log('✅ Project router connected → /api/projects');
} catch (err) {
  console.error('❌ Failed to load project router:', err.message);
}

// Profile router
try {
  const profileRouter = require('./routes/profile');
  app.use('/api/profile', profileRouter);
  console.log('✅ Profile router connected → /api/profile');
} catch (err) {
  console.error('❌ Failed to load profile router:', err.message);
}

// Applications router
try {
  const applicationsRouter = require('./routes/applications');
  app.use('/api/applications', applicationsRouter);
  console.log('✅ Applications router connected → /api/applications');
} catch (err) {
  console.error('❌ Failed to load applications router:', err.message);
}

// Freelancers router
try {
  const freelancersRouter = require('./routes/freelancers');
  app.use('/api/freelancers', freelancersRouter);
  console.log('✅ Freelancers router connected → /api/freelancers');
} catch (err) {
  console.error('❌ Failed to load freelancers router:', err.message);
}

// Chat router
try {
  const chatRouter = require('./routes/chat');
  app.use('/api/chats', chatRouter);
  console.log('✅ Chat router connected → /api/chats');
} catch (err) {
  console.error('❌ Failed to load chat router:', err.message);
}

// Workspace router
try {
  const workspaceRouter = require('./routes/workspace');
  app.use('/api/workspaces', workspaceRouter);
  console.log('✅ Workspace router connected → /api/workspaces');
} catch (err) {
  console.error('❌ Failed to load workspace router:', err.message);
}

// Files router
try {
  const filesRouter = require('./routes/files');
  app.use('/api/files', filesRouter);
  console.log('✅ Files router connected → /api/files');
} catch (err) {
  console.error('❌ Failed to load files router:', err.message);
}

// Payments router
try {
  const paymentsRouter = require('./routes/payments');
  app.use('/api/payments', paymentsRouter);
  console.log('✅ Payments router connected → /api/payments');
} catch (err) {
  console.error('❌ Failed to load payments router:', err.message);
}

// Milestones router
try {
  const milestonesRouter = require('./routes/milestones');
  app.use('/api/workspaces', milestonesRouter);
  app.use('/api/milestones', milestonesRouter); // Mount for template routes
  console.log('✅ Milestones router connected → /api/workspaces/**/milestones');
  console.log('✅ Milestones templates router connected → /api/milestones/templates');
} catch (err) {
  console.error('❌ Failed to load milestones router:', err.message);
}

// Notifications router
try {
  const notificationsRouter = require('./routes/notifications');
  app.use('/api/notifications', notificationsRouter);
  console.log('✅ Notifications router connected → /api/notifications');
} catch (err) {
  console.error('❌ Failed to load notifications router:', err.message);
}

// Matching router (AI-powered freelancer-project matching)
try {
  const matchingRouter = require('./routes/matching');
  app.use('/api/matching', matchingRouter);
  console.log('✅ Matching router connected → /api/matching');
} catch (err) {
  console.error('❌ Failed to load matching router:', err.message);
}

// AI Assistant router (workspace chatbot with RAG)
try {
  const aiRouter = require('./routes/ai');
  app.use('/api/workspace', aiRouter);
  console.log('✅ AI Assistant router connected → /api/workspace/:workspaceId/ask-ai');
} catch (err) {
  console.error('❌ Failed to load AI assistant router:', err.message);
}

// Reviews router (feedback and rating system)
try {
  const reviewsRouter = require('./routes/reviews');
  app.use('/api/reviews', reviewsRouter);
  console.log('✅ Reviews router connected → /api/reviews');
} catch (err) {
  console.error('❌ Failed to load reviews router:', err.message);
}

// Badges router (freelancer badging system)
try {
  const badgesRouter = require('./routes/badges');
  app.use('/api/badges', badgesRouter);
  console.log('✅ Badges router connected → /api/badges');
} catch (err) {
  console.error('❌ Failed to load badges router:', err.message);
}

// Pricing router (AI pricing recommendations)
try {
  const pricingRouter = require('./routes/pricing');
  app.use('/api/pricing', pricingRouter);
  console.log('✅ Pricing router connected → /api/pricing');
} catch (err) {
  console.error('❌ Failed to load pricing router:', err.message);
}

/* ──────────────────────────────────────────
   Health Check Route
────────────────────────────────────────── */
app.get('/test', (req, res) => {
  const state = ['disconnected', 'connected', 'connecting', 'disconnecting'][
    mongoose.connection.readyState
  ];
  res.json({
    message: 'WebSphere server is running!',
    timestamp: new Date().toISOString(),
    server_status: 'running',
    database_status: state,
    database_name: mongoose.connection.name,
    port: PORT,
    session_available: !!req.session,
    session_store: !!req.sessionStore
  });
});

// Session debug route (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/session', (req, res) => {
    res.json({
      session: req.session,
      sessionID: req.sessionID,
      user: req.session?.user || null
    });
  });
}

/* ──────────────────────────────────────────
   Global Error Handler - BEFORE 404 handlers
────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.'
    });
  }
  
  if (err.message === 'Only images are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed.'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

/* ──────────────────────────────────────────
   Global Error Handler
────────────────────────────────────────── */
// Import multer error handler
const { handleMulterError } = require('./middlewares/upload');

// File upload error handler
app.use(handleMulterError);

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global Error Handler:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    files: req.files ? req.files.length : 'none'
  });

  // Handle specific error types
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum file size is 10MB.',
      error: 'FILE_TOO_LARGE'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      success: false,
      message: 'Too many files. Maximum 5 files allowed.',
      error: 'TOO_MANY_FILES'
    });
  }

  // Handle Cloudinary errors
  if (error.message && error.message.includes('File size too large')) {
    return res.status(413).json({
      success: false,
      message: 'File too large for upload service. Maximum file size is 10MB.',
      error: 'CLOUDINARY_FILE_TOO_LARGE'
    });
  }

  if (error.http_code === 400 && error.message) {
    return res.status(400).json({
      success: false,
      message: `Upload service error: ${error.message}`,
      error: 'CLOUDINARY_VALIDATION_ERROR'
    });
  }

  if (error.message && error.message.includes('File type not allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Please check allowed file formats.',
      error: 'INVALID_FILE_TYPE'
    });
  }

  // MongoDB errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'INVALID_ID'
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : 'INTERNAL_ERROR'
  });
});

/* ──────────────────────────────────────────
   Catch-All 404 Handlers — KEEP LAST
────────────────────────────────────────── */
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 API route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `API route ${req.originalUrl} not found`
  });
});

app.use('*', (req, res) => {
  console.log(`❌ 404 route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

/* ──────────────────────────────────────────
   Socket.IO Real-Time Features
────────────────────────────────────────── */

// Store online users and active calls
const onlineUsers = new Map();
const typingUsers = new Map();
const activeCalls = new Map(); // callId -> { caller: userId, callee: userId, workspaceId, startTime }

io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  // Handle user joining
  socket.on('user-online', (userId) => {
    if (userId) {
      console.log(`✅ User ${userId} is now online (Socket: ${socket.id})`);
      console.log(`📊 Current online users before adding: [${Array.from(onlineUsers.keys()).join(', ')}]`);
      
      // Check if user was already online with different socket
      for (const [existingUserId, userData] of onlineUsers.entries()) {
        if (existingUserId === userId && userData.socketId !== socket.id) {
          console.log(`🔄 User ${userId} was already online with different socket ${userData.socketId}, updating...`);
          onlineUsers.delete(existingUserId);
        }
      }
      
      onlineUsers.set(userId, {
        socketId: socket.id,
        userId: userId,
        lastSeen: new Date()
      });
      
      // Store userId on socket for WebRTC signaling
      socket.userId = userId;
      
      // Send updated online users list to all clients (including the newly connected user)
      const onlineUsersList = Array.from(onlineUsers.keys());
      console.log(`📊 Broadcasting online users list: [${onlineUsersList.join(', ')}]`);
      console.log(`📊 Total online users: ${onlineUsers.size}`);
      io.emit('online-users', onlineUsersList);
      
      // Also broadcast status change for compatibility
      socket.broadcast.emit('user-status-change', {
        userId: userId,
        status: 'online',
        timestamp: new Date()
      });
    } else {
      console.log('⚠️ User connected but no userId provided');
    }
  });

  // Handle user going offline
  socket.on('user-offline', (userId) => {
    console.log(`❌ User ${userId} is now offline`);
    if (onlineUsers.has(userId)) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user-status-change', {
        userId: userId,
        status: 'offline',
        timestamp: new Date()
      });
    }
  });

  // Handle chat room joining
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`👥 User ${socket.id} joined chat room: ${chatId}`);
  });

  // Handle chat room leaving  
  socket.on('leave-chat', (chatId) => {
    socket.leave(chatId);
    console.log(`🚪 User ${socket.id} left chat room: ${chatId}`);
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    const { userId, chatId } = data;
    typingUsers.set(`${chatId}-${userId}`, {
      userId,
      chatId,
      socketId: socket.id,
      timestamp: new Date()
    });
    
    // Broadcast typing indicator to users in the chat room only
    socket.to(chatId).emit('user-typing', {
      userId,
      chatId,
      isTyping: true
    });
  });

  socket.on('typing-stop', (data) => {
    const { userId, chatId } = data;
    typingUsers.delete(`${chatId}-${userId}`);
    
    // Broadcast stop typing to users in the chat room only
    socket.to(chatId).emit('user-typing', {
      userId,
      chatId,
      isTyping: false
    });
  });

  // Handle new messages
  socket.on('new-message', (messageData) => {
    console.log('📨 New message received:', messageData);
    
    // Broadcast to all users (in real implementation, you'd target specific users)
    socket.broadcast.emit('message-received', messageData);
    
    // Send push notification data
    socket.broadcast.emit('notification', {
      type: 'message',
      title: 'New Message',
      body: `New message from ${messageData.senderName}`,
      chatId: messageData.chatId,
      timestamp: new Date()
    });
  });

  // Handle project updates
  socket.on('project-update', (projectData) => {
    console.log('📋 Project update:', projectData);
    
    // Broadcast project status change
    socket.broadcast.emit('project-status-change', {
      projectId: projectData.projectId,
      status: projectData.status,
      updatedBy: projectData.updatedBy,
      timestamp: new Date()
    });
  });

  // Handle video call requests
  socket.on('video-call-request', (callData) => {
    console.log('📹 Video call request received');
    console.log('📹 From user ID:', callData.fromUser._id);
    console.log('📹 From user name:', callData.fromUser.fullName);
    console.log('📹 To user ID:', callData.toUser._id);
    console.log('📹 To user name:', callData.toUser.fullName);
    console.log('📹 Current socket user:', socket.userId);
    console.log('📹 Online users:', Array.from(onlineUsers.keys()));
    console.log('📹 Call data:', JSON.stringify(callData, null, 2));
    
    // Prevent self-calls (safety check on backend)
    if (callData.fromUser._id === callData.toUser._id) {
      console.log('🚫 Blocked self-call attempt - same user ID');
      socket.emit('call-error', { error: 'Cannot call yourself' });
      return;
    }
    
    // Find the target user's socket
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === callData.toUser._id) {
        console.log('📹 Sending call to user:', userId, 'at socket:', userData.socketId);
        // Send call request to target user
        io.to(userData.socketId).emit('incoming-video-call', {
          callId: `call_${Date.now()}`,
          fromUser: callData.fromUser,
          workspaceId: callData.workspaceId,
          projectTitle: callData.projectTitle,
          timestamp: new Date()
        });
        
        // Confirm to caller that request was sent
        socket.emit('call-request-sent', {
          toUser: callData.toUser,
          status: 'sent'
        });
        console.log('📹 Call request sent successfully');
        return;
      }
    }
    
    console.log('📹 Target user not found online');
    // Target user is offline
    socket.emit('call-request-failed', {
      toUser: callData.toUser,
      reason: 'User is offline'
    });
  });

  // Handle video call responses
  socket.on('video-call-response', (responseData) => {
    console.log('📹 Video call response:', responseData);
    
    // If call was accepted, track it
    if (responseData.accepted) {
      activeCalls.set(responseData.callId, {
        caller: responseData.callerId,
        callee: responseData.responder.id,
        workspaceId: responseData.workspaceId,
        startTime: new Date()
      });
      console.log('📹 Active call tracked:', responseData.callId);
    }
    
    // Find the caller's socket
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === responseData.callerId) {
        io.to(userData.socketId).emit('call-response-received', {
          callId: responseData.callId,
          accepted: responseData.accepted,
          responder: responseData.responder
        });
        return;
      }
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    console.log('📹 WebRTC offer for workspace:', data.workspaceId);
    
    // Forward offer to target user
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === data.toUserId) {
        io.to(userData.socketId).emit('webrtc-offer', {
          ...data,
          fromUserId: socket.userId // Add sender ID for response
        });
        return;
      }
    }
  });

  socket.on('webrtc-answer', (data) => {
    console.log('📹 WebRTC answer for workspace:', data.workspaceId);
    
    // Forward answer to caller
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === data.toUserId) {
        io.to(userData.socketId).emit('webrtc-answer', data);
        return;
      }
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    console.log('📹 WebRTC ICE candidate for workspace:', data.workspaceId);
    
    // Forward ICE candidate to target user
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === data.toUserId) {
        io.to(userData.socketId).emit('webrtc-ice-candidate', data);
        return;
      }
    }
  });

  socket.on('video-call-ended', (data) => {
    console.log('📹 Video call ended:', data.callId, 'Target user:', data.targetUserId);
    
    // Remove call from active calls
    if (activeCalls.has(data.callId)) {
      activeCalls.delete(data.callId);
      console.log('📹 Removed call from active calls:', data.callId);
    }
    
    // Notify other participant that call has ended
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userId === data.targetUserId) {
        console.log('📹 Notifying user', userId, 'that call ended');
        io.to(userData.socketId).emit('call-ended', {
          callId: data.callId,
          endedBy: data.endedBy,
          workspaceId: data.workspaceId
        });
        return;
      }
    }
    console.log('📹 Target user not found online for call end notification');
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
    console.log(`📊 Online users before disconnect: [${Array.from(onlineUsers.keys()).join(', ')}]`);
    
    // Find and remove user from online users
    let removedUserId = null;
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userId);
        removedUserId = userId;
        console.log(`❌ User ${userId} is now offline (Socket: ${socket.id})`);
        break;
      }
    }
    
    if (removedUserId) {
      // Check for active calls involving this user and end them
      for (const [callId, callData] of activeCalls.entries()) {
        if (callData.caller === removedUserId || callData.callee === removedUserId) {
          const otherUserId = callData.caller === removedUserId ? callData.callee : callData.caller;
          console.log(`📹 User ${removedUserId} disconnected during active call ${callId}, notifying user ${otherUserId}`);
          
          // Find the other user's socket and notify them
          for (const [userId, userData] of onlineUsers.entries()) {
            if (userId === otherUserId) {
              io.to(userData.socketId).emit('call-ended', {
                callId: callId,
                endedBy: 'disconnect',
                workspaceId: callData.workspaceId,
                reason: 'other_participant_disconnected'
              });
              break;
            }
          }
          
          // Remove the call from active calls
          activeCalls.delete(callId);
          console.log(`📹 Removed call ${callId} due to user disconnect`);
        }
      }
      
      // Send updated online users list to all remaining clients
      const onlineUsersList = Array.from(onlineUsers.keys());
      console.log(`📊 Broadcasting updated online users after disconnect: [${onlineUsersList.join(', ')}]`);
      console.log(`📊 Remaining online users: ${onlineUsers.size}`);
      socket.broadcast.emit('online-users', onlineUsersList);
      
      // Also send status change for compatibility
      socket.broadcast.emit('user-status-change', {
        userId: removedUserId,
        status: 'offline',
        timestamp: new Date()
      });
    }
    
    // Remove from typing users
    for (const [key, userData] of typingUsers.entries()) {
      if (userData.socketId === socket.id) {
        typingUsers.delete(key);
        socket.broadcast.emit('user-typing', {
          userId: userData.userId,
          chatId: userData.chatId,
          isTyping: false
        });
      }
    }
  });

  // Send current online users to newly connected client
  socket.emit('online-users', Array.from(onlineUsers.keys()));
});

// API endpoint to get online users (for REST API access)
app.get('/api/users/online', (req, res) => {
  res.json({
    success: true,
    onlineUsers: Array.from(onlineUsers.keys()),
    count: onlineUsers.size
  });
});

/* ──────────────────────────────────────────
   Start Server
────────────────────────────────────────── */
// Initialize matching notification jobs before server start
try {
  const MatchingNotificationJob = require('./jobs/matchingNotifications');
  MatchingNotificationJob.init();
  console.log('🎯 Matching notification jobs initialized');
} catch (err) {
  console.error('❌ Failed to initialize matching jobs:', err.message);
}

server.listen(PORT, () => {
  console.log('🚀 WebSphere Server Started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 Test URL:  http://localhost:${PORT}/test`);
  console.log(`🔑 Auth URL:  http://localhost:${PORT}/api/auth/`);
  console.log(`📂 Uploads:   http://localhost:${PORT}/uploads/`);
  console.log(`🤖 AI Matching: http://localhost:${PORT}/api/matching/health`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Log available routes
  console.log('\n📋 Available API Routes:');
  console.log('   GET  /test');
  console.log('   GET  /debug/session (dev only)');
  console.log('   POST /api/auth/register');
  console.log('   POST /api/auth/login');
  console.log('   POST /api/auth/google');
  console.log('   POST /api/auth/freelancer/auto-tag-bio');
  console.log('   GET  /api/auth/test-route');
  console.log('   GET  /api/projects/browse');
  console.log('   GET  /api/projects/my');
  console.log('   POST /api/projects');
  console.log('   GET  /uploads/profiles/* (static files)');
});

/* ──────────────────────────────────────────
   Graceful Shutdown
────────────────────────────────────────── */
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server…');
  
  try {
    await mongoose.connection.close();
    console.log('📤 Database connection closed');
  } catch (err) {
    console.error('❌ Error closing database:', err);
  }
  
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('💥 Unhandled Promise Rejection:', err);
  console.error('Shutting down server due to unhandled promise rejection');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  console.error('Shutting down server due to uncaught exception');
  process.exit(1);
});
