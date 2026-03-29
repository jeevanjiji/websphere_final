const express = require('express');
const Project = require('../models/Project');
const Application = require('../models/Application');
const { auth } = require('../middlewares/auth');
const { uploadProjectAttachments, handleMulterError } = require('../middlewares/upload');
const {
  uploadProjectAttachment,
  validateCloudinaryConfig
} = require('../utils/cloudinaryConfig');
const router = express.Router();

// GET /api/projects/public - Get open projects for guests (no auth required)
router.get('/public', async (req, res) => {
  try {
    const {
      search,
      skills,
      budgetMin,
      budgetMax,
      budgetType,
      page = 1,
      limit = 8
    } = req.query;

    let query = { status: 'open' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (skills) {
      const skillsArray = skills.split(',').map((s) => s.trim());
      query.skills = { $in: skillsArray };
    }

    if (budgetType) {
      query.budgetType = budgetType;
    }

    if (budgetMin || budgetMax) {
      query.budgetAmount = {};
      if (budgetMin) query.budgetAmount.$gte = parseFloat(budgetMin);
      if (budgetMax) query.budgetAmount.$lte = parseFloat(budgetMax);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projects = await Project.find(query)
      .populate('client', 'fullName profilePicture rating.average rating.count')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const totalProjects = await Project.countDocuments(query);
    const totalPages = Math.ceil(totalProjects / parseInt(limit));

    res.json({
      success: true,
      projects,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProjects,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching public projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/projects/browse - Get all open projects for freelancers to browse
router.get('/browse', auth(['freelancer']), async (req, res) => {
  console.log('🔥 GET BROWSE PROJECTS - User ID:', req.user.userId);
  try {
    const {
      search,
      skills,
      budgetMin,
      budgetMax,
      budgetType,
      page = 1,
      limit = 10,
      showAllProjects = false // Flag to show all projects or only skill-matched ones
    } = req.query;

    // Get freelancer's profile for filtering
    const User = require('../models/User');
    const freelancer = await User.findById(req.user.userId).select('profile.skills profile.categories');
    
    // Build query for open projects
    let query = { status: 'open' };

    // Add search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Add skills filter
    if (skills) {
      // Manual skill filter from query params
      const skillsArray = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillsArray };
    } else if (!showAllProjects && freelancer && freelancer.profile?.skills && freelancer.profile.skills.length > 0) {
      // Auto-filter by freelancer's skills if no manual filter and showAllProjects is false
      query.skills = { $in: freelancer.profile.skills };
    }
    // If freelancer has no skills or showAllProjects is true, show all projects (no skill filter)

    // Add budget filters
    if (budgetType) {
      query.budgetType = budgetType;
    }
    if (budgetMin || budgetMax) {
      query.budgetAmount = {};
      if (budgetMin) query.budgetAmount.$gte = parseFloat(budgetMin);
      if (budgetMax) query.budgetAmount.$lte = parseFloat(budgetMax);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch projects with client info
    const projects = await Project.find(query)
      .populate('client', 'fullName profilePicture rating.average rating.count')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalProjects = await Project.countDocuments(query);
    const totalPages = Math.ceil(totalProjects / parseInt(limit));

    console.log('✅ Query used:', JSON.stringify(query, null, 2));
    console.log('✅ Freelancer skills:', freelancer?.profile?.skills || 'No skills set');
    console.log('✅ Found', projects.length, 'open projects for browsing');
    
    res.json({
      success: true,
      projects,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProjects,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      debug: {
        totalOpenProjects: await Project.countDocuments({ status: 'open' }),
        freelancerSkills: freelancer?.profile?.skills || [],
        queryUsed: query
      }
    });
  } catch (error) {
    console.error('❌ Error fetching browse projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/projects/my - Get user's own projects (client's created projects or freelancer's applied projects)
router.get('/my', auth(['client', 'freelancer']), async (req, res) => {
  console.log('🔥 GET MY PROJECTS - User ID:', req.user.userId, 'Role:', req.user.role);
  try {
    let projects = [];

    if (req.user.role === 'client') {
      // For clients: get projects they created with accepted application info
      projects = await Project.find({ client: req.user.userId }).sort('-createdAt');
      
      // Add accepted application info and application count for each project
      for (let project of projects) {
        const acceptedApplication = await Application.findOne({ 
          project: project._id, 
          status: { $in: ['accepted', 'awarded'] }
        });
        
        const applicationsCount = await Application.countDocuments({
          project: project._id,
          status: { $nin: ['withdrawn'] }
        });
        
        project._doc.hasAcceptedFreelancer = !!acceptedApplication;
        project._doc.acceptedApplicationId = acceptedApplication?._id;
        project._doc.applicationsCount = applicationsCount;
      }
    } else if (req.user.role === 'freelancer') {
      // For freelancers: get projects they've been awarded
      const awardedApplications = await Application.find({
        freelancer: req.user.userId,
        status: { $in: ['accepted', 'awarded'] }
      }).select('project');
      
      const projectIds = awardedApplications.map(a => a.project);
      projects = await Project.find({ _id: { $in: projectIds } })
        .populate('client', 'fullName profilePicture rating.average')
        .sort('-createdAt');
    }

    console.log('✅ Found', projects.length, 'projects for', req.user.role);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/projects - Create new project
router.post('/', auth(['client']), uploadProjectAttachments, async (req, res) => {
  console.log('🔥 CREATE PROJECT ROUTE HIT');
  console.log('📋 Request body:', req.body);
  try {
    const { 
      title, 
      description, 
      category,
      categoryName,
      image,
      skills, 
      budgetType, 
      budgetAmount, 
      deadline 
    } = req.body;

    let attachmentUrls = [];

    // Upload attachments to Cloudinary if any
    if (req.files && req.files.length > 0) {
      if (!validateCloudinaryConfig()) {
        return res.status(500).json({
          success: false,
          message: 'File upload service not configured'
        });
      }

      try {
        const uploadPromises = req.files.map(async (file, index) => {
          const result = await uploadProjectAttachment(
            file.buffer,
            'temp_project_' + Date.now(), // Temporary project ID
            file.originalname
          );
          return result.secure_url;
        });

        attachmentUrls = await Promise.all(uploadPromises);
        console.log('✅ Uploaded', attachmentUrls.length, 'attachments to Cloudinary');
      } catch (uploadError) {
        console.error('❌ Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload attachments. Please try again.'
        });
      }
    }

    // Calculate service charges
    const serviceChargePercentage = 5; // 5% platform fee
    const fixedServiceCharge = 35; // ₹35 per milestone service charge
    const calculatedServiceCharge = Math.max(fixedServiceCharge, (budgetAmount * serviceChargePercentage) / 100);
    const totalProjectValue = budgetAmount + calculatedServiceCharge;

    const project = await Project.create({
      client: req.user.userId,
      title,
      description,
      category,
      categoryName,
      image,
      skills: JSON.parse(skills || '[]'),
      budgetType,
      budgetAmount,
      deadline,
      attachments: attachmentUrls,
      // Service charge fields
      serviceCharge: fixedServiceCharge, // Use fixed charge per milestone
      serviceChargePercentage,
      totalProjectValue
    });

    console.log('✅ Project created:', project._id);
    console.log('📂 Project category:', category, categoryName);

    // 🎯 AI MATCHING INTEGRATION: Trigger proactive matching for new project
    try {
      const MatchingService = require('../services/matchingService');
      
      // Find top matches immediately (async, don't wait)
      MatchingService.getRecommendedFreelancers(project._id, {
        limit: 10,
        minScore: 0.6
      }).then(async (matches) => {
        if (matches.matches.length > 0) {
          console.log(`🎯 Found ${matches.matches.length} matching freelancers for new project: ${project.title}`);
          
          // Send notifications to top 5 matches (you can adjust this)
          const NotificationService = require('../services/notificationService');
          const topMatches = matches.matches.slice(0, 5);
          
          for (const match of topMatches) {
            try {
              await NotificationService.createNotification(
                match.freelancer._id,
                'project_match',
                '🎯 Perfect Project Match!',
                `"${project.title}" is a ${Math.round(match.totalScore * 100)}% match for your skills`,
                {
                  projectId: project._id,
                  matchScore: match.totalScore,
                  projectTitle: project.title,
                  budget: project.budgetAmount,
                  budgetType: project.budgetType
                }
              );
            } catch (notifError) {
              console.error('❌ Notification error:', notifError.message);
            }
          }
          console.log(`📧 Sent match notifications to ${topMatches.length} freelancers`);
        }
      }).catch(err => {
        console.error('❌ AI matching error (non-blocking):', err.message);
      });
    } catch (error) {
      // Don't let matching errors break project creation
      console.error('❌ AI matching service unavailable (non-blocking):', error.message);
    }

    res.status(201).json({ success: true, project });
  } catch (err) {
    console.error('❌ Create project error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Add error handling middleware for multer errors
router.use(handleMulterError);

module.exports = router;
