// backend/routes/matching.js
const express = require('express');
const router = express.Router();
const MatchingService = require('../services/matchingService');
const { auth } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for matching endpoints
const matchingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 matching requests per windowMs
  message: 'Too many matching requests, please try again later'
});

/**
 * @swagger
 * components:
 *   schemas:
 *     MatchingResult:
 *       type: object
 *       properties:
 *         matches:
 *           type: array
 *           items:
 *             type: object
 *         totalCandidates:
 *           type: integer
 *         searchMeta:
 *           type: object
 */

/**
 * @swagger
 * /api/matching/freelancers/{projectId}:
 *   get:
 *     summary: Get recommended freelancers for a project
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           default: 0.3
 *       - in: query
 *         name: includeApplied
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of recommended freelancers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchingResult'
 */
router.get('/freelancers/:projectId', 
  auth(['client', 'admin']), 
  matchingLimiter,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { 
        limit = 20, 
        minScore = 0.3, 
        includeApplied = false,
        diversityBoost = true 
      } = req.query;

      const options = {
        limit: parseInt(limit),
        minScore: parseFloat(minScore),
        includeApplied: includeApplied === 'true',
        diversityBoost: diversityBoost === 'true'
      };

      const result = await MatchingService.getRecommendedFreelancers(projectId, options);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get recommended freelancers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get recommended freelancers'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/projects/{freelancerId}:
 *   get:
 *     summary: Get recommended projects for a freelancer
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: freelancerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of recommended projects
 */
router.get('/projects/:freelancerId', 
  auth(['freelancer', 'admin']), 
  matchingLimiter,
  async (req, res) => {
    console.log('🎯 === MATCHING ROUTE HIT ===');
    console.log('FreelancerId:', req.params.freelancerId);
    console.log('User from token:', req.user);
    console.log('Query params:', req.query);
    
    try {
      const { freelancerId } = req.params;
      const { limit = 10, category } = req.query;

      // Ensure freelancer can only access their own recommendations (unless admin)
      console.log('🔐 Access Check Debug:');
      console.log('  - User Role:', req.user.role);
      console.log('  - User ID from token:', req.user.userId);
      console.log('  - Freelancer ID from URL:', freelancerId);
      console.log('  - Types:', typeof req.user.userId, typeof freelancerId);
      
      if (req.user.role !== 'admin' && req.user.userId.toString() !== freelancerId.toString()) {
        console.log('❌ Access denied - ID mismatch');
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      console.log('✅ Access granted');

      const options = {
        limit: parseInt(limit),
        category
      };

      console.log('🎯 Calling MatchingService.getRecommendedProjects with:', { freelancerId, options });
      
      const result = await MatchingService.getRecommendedProjects(freelancerId, options);
      
      console.log('✅ MatchingService returned:', { 
        projectCount: result?.projects?.length || 0,
        totalAvailable: result?.totalAvailable || 0
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Get recommended projects error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get recommended projects'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/analytics/{projectId}:
 *   get:
 *     summary: Get matching analytics for a project
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project matching analytics
 */
router.get('/analytics/:projectId', 
  auth(['client', 'admin']), 
  matchingLimiter,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      const analytics = await MatchingService.getMatchingAnalytics(projectId);

      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get matching analytics error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get matching analytics'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/batch:
 *   post:
 *     summary: Batch match multiple projects (admin only)
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Batch matching results
 */
router.post('/batch', 
  auth(['admin']), 
  async (req, res) => {
    try {
      const { projectIds, options = {} } = req.body;

      if (!projectIds || !Array.isArray(projectIds)) {
        return res.status(400).json({
          success: false,
          message: 'Project IDs array is required'
        });
      }

      if (projectIds.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 50 projects per batch'
        });
      }

      const results = await MatchingService.batchMatchProjects(projectIds, options);
      
      // Convert Map to Object for JSON response
      const resultObj = {};
      for (const [projectId, result] of results.entries()) {
        resultObj[projectId] = result;
      }

      res.json({
        success: true,
        data: {
          results: resultObj,
          processed: projectIds.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Batch matching error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Batch matching failed'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/new-freelancer/{freelancerId}:
 *   get:
 *     summary: Find projects for newly registered freelancer
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: freelancerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Projects for new freelancer
 */
router.get('/new-freelancer/:freelancerId', 
  auth(['freelancer', 'admin']), 
  matchingLimiter,
  async (req, res) => {
    try {
      const { freelancerId } = req.params;

      // Ensure freelancer can only access their own data (unless admin)
      if (req.user.role !== 'admin' && req.user._id.toString() !== freelancerId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const result = await MatchingService.findProjectsForNewFreelancer(freelancerId);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('New freelancer matching error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to find projects for new freelancer'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/cache/clear:
 *   post:
 *     summary: Clear matching cache (admin only)
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/cache/clear', 
  auth(['admin']), 
  async (req, res) => {
    try {
      MatchingService.clearCache();

      res.json({
        success: true,
        message: 'Matching cache cleared successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache'
      });
    }
  }
);

/**
 * @swagger
 * /api/matching/cache/clear/{projectId}:
 *   post:
 *     summary: Clear cache for specific project (admin only)
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project cache cleared successfully
 */
router.post('/cache/clear/:projectId', 
  auth(['admin']), 
  async (req, res) => {
    try {
      const { projectId } = req.params;
      MatchingService.clearProjectCache(projectId);

      res.json({
        success: true,
        message: `Cache cleared for project ${projectId}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Clear project cache error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear project cache'
      });
    }
  }
);

// Health check endpoint for matching service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Hybrid Recommendation Engine',
    status: 'healthy',
    version: '2.0.0',
    pipeline: ['data_preparation', 'candidate_generation', 'collaborative_filtering', 're_ranking'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;