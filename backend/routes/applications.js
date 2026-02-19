const express = require('express');
const Application = require('../models/Application');
const Project = require('../models/Project');
const User = require('../models/User');
const { Chat, Message } = require('../models/Chat');
const Notification = require('../models/Notification');
const Workspace = require('../models/Workspace');
const { auth } = require('../middlewares/auth');
const router = express.Router();

// POST /api/applications - Submit application to a project
router.post('/', auth(['freelancer']), async (req, res) => {
  console.log('🔥 SUBMIT APPLICATION - User ID:', req.user.userId);
  try {
    const {
      projectId,
      coverLetter,
      proposedRate,
      proposedTimeline,
      experience,
      questions,
      attachments = []
    } = req.body;

    // Check if freelancer profile is complete
    const freelancer = await User.findById(req.user.userId);
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!freelancer.isFreelancerProfileComplete()) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile before applying to projects. Your profile must include a bio (minimum 50 characters) and at least 3 skills.',
        requiresProfileCompletion: true
      });
    }

    // Validate required fields
    if (!projectId || !coverLetter || !proposedRate || !proposedTimeline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: projectId, coverLetter, proposedRate, proposedTimeline'
      });
    }

    // Check if project exists and is open
    const project = await Project.findById(projectId).populate('client');
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This project is no longer accepting applications'
      });
    }

    // Validate proposed rate is not too high (max 120% of project budget)
    const maxAllowedRate = project.budgetAmount * 1.20;
    if (parseFloat(proposedRate) > maxAllowedRate) {
      return res.status(400).json({
        success: false,
        message: `Proposed rate cannot exceed ₹${Math.round(maxAllowedRate).toLocaleString()} (120% of project budget ₹${project.budgetAmount.toLocaleString()})`
      });
    }

    // Validate proposed timeline doesn't exceed project deadline
    if (project.deadline && proposedTimeline) {
      const proposedDate = new Date(proposedTimeline);
      const deadlineDate = new Date(project.deadline);
      if (!isNaN(proposedDate.getTime()) && proposedDate > deadlineDate) {
        return res.status(400).json({
          success: false,
          message: `Proposed completion date cannot exceed project deadline (${deadlineDate.toLocaleDateString()})`
        });
      }
    }

    // Check if freelancer already applied
    const existingApplication = await Application.findOne({
      project: projectId,
      freelancer: req.user.userId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this project'
      });
    }

    // Check if freelancer has 5 or more ongoing projects
    const ongoingProjectsCount = await Application.countDocuments({
      freelancer: req.user.userId,
      status: { $in: ['accepted', 'awarded'] }
    });

    if (ongoingProjectsCount >= 5) {
      return res.status(400).json({
        success: false,
        message: 'You cannot apply to more than 5 projects at once. Please complete some of your current projects before applying to new ones.',
        ongoingProjectsCount: ongoingProjectsCount
      });
    }

    // Create application
    const application = new Application({
      project: projectId,
      freelancer: req.user.userId,
      client: project.client._id,
      coverLetter,
      proposedRate: parseFloat(proposedRate),
      proposedTimeline,
      experience,
      questions,
      attachments
    });

    await application.save();

    // Populate application with user details
    await application.populate([
      { path: 'freelancer', select: 'fullName profilePicture rating.average email' },
      { path: 'project', select: 'title' }
    ]);

    // Create notification for client about new application
    try {
      await Notification.create({
        userId: project.client._id,
        userRole: 'client',
        type: 'project',
        title: 'New Project Application',
        body: `${application.freelancer.fullName} has applied to your project "${application.project.title}"`,
        data: {
          projectId: project._id,
          applicationId: application._id,
          extraData: {
            freelancerName: application.freelancer.fullName,
            proposedRate: application.proposedRate,
            action: 'view_applications'
          }
        }
      });
      console.log('✅ Notification sent to client about new application');
    } catch (notificationError) {
      console.error('⚠️ Failed to create notification:', notificationError);
      // Don't fail the application submission if notification fails
    }

    console.log('✅ Application submitted successfully');
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('❌ Error submitting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// GET /api/applications/my - Get freelancer's applications
router.get('/my', auth(['freelancer']), async (req, res) => {
  console.log('🔥 GET MY APPLICATIONS - User ID:', req.user.userId);
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { freelancer: req.user.userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const applications = await Application.find(query)
      .populate({
        path: 'project',
        select: 'title description budgetAmount budgetType deadline status category categoryName agreedPrice finalRate image awardedAt',
        populate: {
          path: 'client',
          select: 'fullName profilePicture rating.average'
        }
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await Application.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / parseInt(limit));

    console.log('✅ Found', applications.length, 'applications');
    res.json({
      success: true,
      applications,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalApplications,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// GET /api/applications/project/:projectId - Get applications for a project (client only)
router.get('/project/:projectId', auth(['client']), async (req, res) => {
  console.log('🔥 GET PROJECT APPLICATIONS - Project ID:', req.params.projectId);
  try {
    const { projectId } = req.params;

    // Verify project belongs to the client
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.client.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view applications for your own projects.'
      });
    }

    const applications = await Application.find({ project: projectId })
      .populate({
        path: 'freelancer',
        select: 'fullName profilePicture rating.average email profile.skills profile.hourlyRate profile.completedProjects profile.bio'
      })
      .sort('-createdAt');

    // Mark applications as viewed by client
    await Application.updateMany(
      { project: projectId, viewedByClient: false },
      { 
        viewedByClient: true, 
        viewedAt: new Date() 
      }
    );

    console.log('✅ Found', applications.length, 'applications for project');
    res.json({
      success: true,
      applications,
      count: applications.length
    });
  } catch (error) {
    console.error('❌ Error fetching project applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// PUT /api/applications/:applicationId/respond - Accept/reject application (client only)
router.put('/:applicationId/respond', auth(['client']), async (req, res) => {
  console.log('🔥 RESPOND TO APPLICATION - Application ID:', req.params.applicationId);
  try {
    const { applicationId } = req.params;
    const { action, message } = req.body; // action: 'accept' or 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "accept" or "reject"'
      });
    }

    const application = await Application.findById(applicationId)
      .populate('project')
      .populate('freelancer');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify project belongs to the client
    if (application.project.client.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only respond to applications for your own projects.'
      });
    }

    if (!['pending', 'accepted'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'This application has already been responded to'
      });
    }

    // Update application status
    application.status = action === 'accept' ? 'awarded' : 'rejected';
    application.respondedAt = new Date();

    // If accepted, directly award the project
    if (action === 'accept') {
      // Update project status and award it
      const project = await Project.findById(application.project._id);
      project.status = 'awarded';
      project.awardedTo = application.freelancer._id;
      project.awardedApplication = application._id;
      // Use agreedPrice from negotiation if available, otherwise use application proposed rate
      project.finalRate = project.agreedPrice || application.proposedRate;
      project.finalTimeline = application.proposedTimeline;
      project.awardedAt = new Date();
      // If there's an agreed price, ensure budget stays consistent
      if (project.agreedPrice) {
        project.budgetAmount = project.agreedPrice;
      }
      await project.save();

      // Reject all other applications for this project
      await Application.updateMany(
        { 
          project: application.project._id,
          _id: { $ne: req.params.applicationId },
          status: { $in: ['pending', 'accepted'] }
        },
        { status: 'rejected' }
      );

      // Create a chat if one doesn't already exist for this application
      let chat = await Chat.findOne({ application: application._id });
      if (!chat) {
        chat = new Chat({
          project: application.project._id,
          application: application._id,
          participants: [
            { user: application.client, role: 'client' },
            { user: application.freelancer._id, role: 'freelancer' }
          ]
        });
        await chat.save();
      }

      // Create system message about project award
      const finalAmount = project.agreedPrice || application.proposedRate;
      const systemMessage = new Message({
        chat: chat._id,
        sender: req.user.userId,
        content: `🎉 Congratulations! Project "${application.project.title}" has been awarded to ${application.freelancer.fullName}. Final rate: Rs.${finalAmount}. Timeline: ${application.proposedTimeline}`,
        messageType: 'system'
      });
      await systemMessage.save();

      chat.lastMessage = systemMessage._id;
      chat.lastActivity = new Date();
      await chat.save();
    }

    await application.save();

    // Create notification for freelancer about application status change
    try {
      const notificationData = {
        userId: application.freelancer._id,
        userRole: 'freelancer',
        type: 'project',
        data: {
          projectId: application.project._id,
          applicationId: application._id,
          extraData: {
            projectTitle: application.project.title,
            action: action === 'accept' ? 'project_awarded' : 'application_rejected'
          }
        }
      };

      if (action === 'accept') {
        notificationData.title = 'Project Awarded! 🎉';
        notificationData.body = `Congratulations! Your application for "${application.project.title}" has been accepted and the project has been awarded to you.`;
      } else {
        notificationData.title = 'Application Update';
        notificationData.body = `Your application for "${application.project.title}" was not selected this time. Keep applying to find the perfect project!`;
      }

      await Notification.create(notificationData);
      console.log(`✅ Notification sent to freelancer about application ${action}`);
    } catch (notificationError) {
      console.error('⚠️ Failed to create application status notification:', notificationError);
    }

    console.log('✅ Application', action === 'accept' ? 'selected and project awarded' : 'rejected', 'successfully');
    res.json({
      success: true,
      message: action === 'accept' ? 'Project awarded successfully' : 'Application rejected successfully',
      application,
      chatCreated: action === 'accept'
    });
  } catch (error) {
    console.error('❌ Error responding to application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to application',
      error: error.message
    });
  }
});

// PUT /api/applications/:applicationId/status - Accept/reject application (client only)
router.put('/:applicationId/status', auth(['client']), async (req, res) => {
  console.log('🔥 UPDATE APPLICATION STATUS - Application ID:', req.params.applicationId);
  console.log('🔥 Request body:', req.body);
  console.log('🔥 User:', req.user);
  try {
    const { applicationId } = req.params;
    const { status } = req.body; // status: 'accepted' or 'rejected'

    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "accepted" or "rejected"'
      });
    }

    const application = await Application.findById(applicationId)
      .populate('project')
      .populate('freelancer');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify project belongs to the client
    if (application.project.client.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only respond to applications for your own projects.'
      });
    }

    if (!['pending', 'accepted'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'This application has already been responded to'
      });
    }

    // Update application status
    application.status = status === 'accepted' ? 'awarded' : 'rejected';
    application.respondedAt = new Date();

    let chatId = null;
    let workspaceId = null;

    // If accepted, directly award the project
    if (status === 'accepted') {
      // Update project status and award it
      const project = await Project.findById(application.project._id);
      project.status = 'awarded';
      project.awardedTo = application.freelancer._id;
      project.awardedApplication = application._id;
      // Use agreedPrice from negotiation if available, otherwise use application proposed rate
      project.finalRate = project.agreedPrice || application.proposedRate;
      project.finalTimeline = application.proposedTimeline;
      project.awardedAt = new Date();
      // If there's an agreed price, ensure budget stays consistent
      if (project.agreedPrice) {
        project.budgetAmount = project.agreedPrice;
      }
      await project.save();

      // Reject all other applications for this project
      await Application.updateMany(
        { 
          project: application.project._id,
          _id: { $ne: req.params.applicationId },
          status: { $in: ['pending', 'accepted'] }
        },
        { status: 'rejected' }
      );
      const { Chat, Message } = require('../models/Chat');
      const Workspace = require('../models/Workspace');
      
      // Create a chat if one doesn't already exist for this application
      let chat = await Chat.findOne({ application: application._id });
      if (!chat) {
        chat = new Chat({
          project: application.project._id,
          application: application._id,
          participants: [
            { user: application.project.client, role: 'client' },
            { user: application.freelancer._id, role: 'freelancer' }
          ]
        });
        await chat.save();
      }
      chatId = chat._id;

      // Create system message about project award
      const finalAmount = project.agreedPrice || application.proposedRate;
      const systemMessage = new Message({
        chat: chat._id,
        sender: req.user.userId,
        content: `🎉 Congratulations! Project "${application.project.title}" has been awarded to ${application.freelancer.fullName}. Final rate: Rs.${finalAmount}. Timeline: ${application.proposedTimeline}`,
        messageType: 'system'
      });
      await systemMessage.save();

      chat.lastMessage = systemMessage._id;
      chat.lastActivity = new Date();
      await chat.save();

      // Create workspace for the project
      try {
        const existingWorkspace = await Workspace.findOne({ project: application.project._id });
        
        if (!existingWorkspace) {
          const workspace = new Workspace({
            project: application.project._id,
            client: application.project.client,
            freelancer: application.freelancer._id,
            application: application._id,
            expectedEndDate: application.project.timeline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
          });
          await workspace.save();
          workspaceId = workspace._id;
          console.log('✅ Workspace created automatically:', workspaceId);
        } else {
          workspaceId = existingWorkspace._id;
          console.log('✅ Using existing workspace:', workspaceId);
        }
      } catch (workspaceError) {
        console.error('❌ Error creating workspace:', workspaceError);
        // Don't fail the entire operation if workspace creation fails
      }

    }

    await application.save();

    // Create notification for freelancer about application status change
    try {
      const notificationData = {
        userId: application.freelancer._id,
        userRole: 'freelancer',
        type: 'project',
        data: {
          projectId: application.project._id,
          applicationId: application._id,
          extraData: {
            projectTitle: application.project.title,
            action: status === 'accepted' ? 'project_awarded' : 'application_rejected'
          }
        }
      };

      if (status === 'accepted') {
        notificationData.title = 'Project Awarded! 🎉';
        notificationData.body = `Congratulations! Your application for "${application.project.title}" has been accepted and the project has been awarded to you.`;
      } else {
        notificationData.title = 'Application Update';
        notificationData.body = `Your application for "${application.project.title}" was not selected this time. Keep applying to find the perfect project!`;
      }

      await Notification.create(notificationData);
      console.log(`✅ Notification sent to freelancer about application ${status}`);
    } catch (notificationError) {
      console.error('⚠️ Failed to create application status notification:', notificationError);
    }

    console.log('✅ Application', status === 'accepted' ? 'selected and project awarded' : 'rejected', 'successfully');
    res.json({
      success: true,
      message: status === 'accepted' ? 'Project awarded successfully' : 'Application rejected successfully',
      application,
      chatId: chatId,
      workspaceId: workspaceId,
      chatCreated: status === 'accepted',
      workspaceCreated: status === 'accepted' && workspaceId
    });
  } catch (error) {
    console.error('❌ Error updating application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message
    });
  }
});

// GET /api/applications/:applicationId - Get specific application details
router.get('/:applicationId', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 GET APPLICATION DETAILS - Application ID:', req.params.applicationId);
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate({
        path: 'project',
        select: 'title description budgetAmount budgetType deadline status category client',
        populate: {
          path: 'client',
          select: 'fullName profilePicture rating.average'
        }
      })
      .populate({
        path: 'freelancer',
        select: 'fullName profilePicture rating.average email profile.skills profile.hourlyRate profile.completedProjects profile.bio'
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check authorization
    const isClient = req.user.userId === application.project.client._id.toString();
    const isFreelancer = req.user.userId === application.freelancer._id.toString();

    if (!isClient && !isFreelancer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own applications.'
      });
    }

    console.log('✅ Application details retrieved');
    res.json({
      success: true,
      application
    });
  } catch (error) {
    console.error('❌ Error fetching application details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application details',
      error: error.message
    });
  }
});

// DELETE /api/applications/:applicationId - Withdraw application (freelancer only)
router.delete('/:applicationId', auth(['freelancer']), async (req, res) => {
  console.log('🔥 WITHDRAW APPLICATION - Application ID:', req.params.applicationId);
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if application belongs to the freelancer
    if (application.freelancer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only withdraw your own applications.'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw application that has already been responded to'
      });
    }

    // Update status to withdrawn instead of deleting
    application.status = 'withdrawn';
    await application.save();

    console.log('✅ Application withdrawn successfully');
    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    console.error('❌ Error withdrawing application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: error.message
    });
  }
});

// PUT /api/applications/:applicationId/award - Award project to freelancer (client only)
router.put('/:applicationId/award', auth(['client']), async (req, res) => {
  console.log('🔥 AWARD PROJECT TO FREELANCER - Application ID:', req.params.applicationId);
  try {
    const { applicationId } = req.params;

    // Find the application
    const application = await Application.findById(applicationId)
      .populate('project')
      .populate('freelancer', 'fullName email')
      .populate('client', 'fullName email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify client owns this project
    if (application.client._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the project client can award the project.'
      });
    }

    // Check if application is in a valid state for awarding
    if (!['accepted', 'pending'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Application must be pending or accepted before awarding the project'
      });
    }

    // Check if project is already awarded
    if (application.project.status === 'awarded' || application.project.status === 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Project has already been awarded'
      });
    }

    // Update application status to awarded
    application.status = 'awarded';
    await application.save();

    // Update project status and award it
    const project = await Project.findById(application.project._id);
    project.status = 'awarded';
    project.awardedTo = application.freelancer._id;
    project.awardedApplication = application._id;
    // Use agreedPrice from negotiation if available, otherwise use application proposed rate
    project.finalRate = project.agreedPrice || application.proposedRate;
    project.finalTimeline = application.proposedTimeline;
    project.awardedAt = new Date();
    // If there's an agreed price, ensure budget stays consistent
    if (project.agreedPrice) {
      project.budgetAmount = project.agreedPrice;
    }
    await project.save();

    // Reject all other applications for this project
    await Application.updateMany(
      { 
        project: application.project._id,
        _id: { $ne: applicationId },
        status: { $in: ['pending', 'accepted'] }
      },
      { status: 'rejected' }
    );

    // Create or find chat for this application
    const { Chat, Message } = require('../models/Chat');
    let chat = await Chat.findOne({ application: applicationId });
    
    if (!chat) {
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
    }

    // Send system message about project award
    const finalAmount = project.agreedPrice || application.proposedRate;
    const awardMessage = new Message({
      chat: chat._id,
      sender: req.user.userId,
      messageType: 'system',
      content: `🎉 Congratulations! Project "${application.project.title}" has been awarded to ${application.freelancer.fullName}. Final rate: Rs.${finalAmount}. Timeline: ${application.proposedTimeline}`,
      readBy: [
        {
          user: req.user.userId,
          readAt: new Date()
        }
      ]
    });

    await awardMessage.save();
    chat.lastMessage = awardMessage._id;
    chat.lastActivity = new Date();
    await chat.save();

    console.log('✅ Project awarded successfully to freelancer');
    res.json({
      success: true,
      message: 'Project awarded successfully',
      application: application,
      project: project,
      chatId: chat._id
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

module.exports = router;
