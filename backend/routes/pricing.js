/**
 * Pricing API Routes
 * 
 * AI-powered pricing recommendations for:
 * - Project budget suggestions
 * - Freelancer rate recommendations
 * - Milestone breakdown suggestions
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const PricingAssistant = require('../services/pricingAssistant');
const Project = require('../models/Project');
const User = require('../models/User');

/**
 * POST /api/pricing/recommendation
 * Get pricing recommendation for project data
 */
router.post('/recommendation', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { title, description, category, skills, deadline, budgetType } = req.body;
    
    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }
    
    const projectData = {
      title,
      description,
      category: category || 'other',
      skills: skills || [],
      deadline,
      budgetType: budgetType || 'fixed'
    };
    
    const result = await PricingAssistant.getPricingRecommendation(projectData);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      recommendation: result.recommendation
    });
  } catch (error) {
    console.error('Error getting pricing recommendation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate pricing recommendation'
    });
  }
});

/**
 * GET /api/pricing/project/:projectId
 * Get pricing recommendation for an existing project
 */
router.get('/project/:projectId', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId).lean();
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    const result = await PricingAssistant.getPricingRecommendation(project, projectId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      project,
      recommendation: result.recommendation
    });
  } catch (error) {
    console.error('Error getting project pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate pricing recommendation'
    });
  }
});

/**
 * POST /api/pricing/freelancer/:freelancerId
 * Get pricing suggestion tailored for a specific freelancer
 */
router.post('/freelancer/:freelancerId', auth(['freelancer']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { title, description, category, skills, deadline } = req.body;
    
    // Only allow freelancers to get their own pricing
    if (req.user.userId !== freelancerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const projectData = {
      title,
      description,
      category: category || 'other',
      skills: skills || [],
      deadline
    };
    
    const result = await PricingAssistant.getFreelancerPricingSuggestion(freelancerId, projectData);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json({
      success: true,
      recommendation: result.recommendation
    });
  } catch (error) {
    console.error('Error getting freelancer pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate freelancer pricing suggestion'
    });
  }
});

/**
 * GET /api/pricing/market-data/:category
 * Get market data for a specific category
 */
router.get('/market-data/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const projectData = { category };
    const marketData = await PricingAssistant.getMarketData(projectData);
    
    res.json({
      success: true,
      category,
      marketData: {
        similarProjects: marketData.similarCount,
        averageBudget: marketData.averageBudget,
        medianBudget: marketData.medianBudget,
        budgetRange: marketData.budgets.length > 0 
          ? {
              min: marketData.budgets[0],
              max: marketData.budgets[marketData.budgets.length - 1]
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error getting market data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market data'
    });
  }
});

/**
 * POST /api/pricing/compare
 * Compare proposed budget with market rates
 */
router.post('/compare', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { budget, title, description, category, skills, deadline } = req.body;
    
    if (!budget || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Budget, title, and description are required'
      });
    }
    
    const projectData = {
      title,
      description,
      category: category || 'other',
      skills: skills || [],
      deadline
    };
    
    // Get market data
    const marketData = await PricingAssistant.getMarketData(projectData);
    
    // Get recommendation
    const result = await PricingAssistant.getPricingRecommendation(projectData);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    const rec = result.recommendation;
    
    // Calculate comparison
    const percentageDiff = ((budget - rec.suggestedBudget) / rec.suggestedBudget) * 100;
    
    let competitiveness = 'competitive';
    if (percentageDiff < -30) competitiveness = 'very_low';
    else if (percentageDiff < -15) competitiveness = 'below_market';
    else if (percentageDiff > 30) competitiveness = 'very_high';
    else if (percentageDiff > 15) competitiveness = 'above_market';
    
    res.json({
      success: true,
      comparison: {
        proposedBudget: budget,
        suggestedBudget: rec.suggestedBudget,
        marketAverage: marketData.averageBudget,
        marketMedian: marketData.medianBudget,
        percentageDifference: Math.round(percentageDiff),
        competitiveness,
        range: rec.range,
        analysis: {
          isWithinRange: budget >= rec.range.minimum && budget <= rec.range.maximum,
          isCompetitive: budget >= rec.range.minimum * 0.9 && budget <= rec.range.competitive * 1.1,
          recommendation: competitiveness === 'very_low'
            ? 'This budget may attract fewer quality freelancers'
            : competitiveness === 'very_high'
            ? 'This budget is generous - you may find great talent at a lower rate'
            : competitiveness === 'below_market'
            ? 'Budget is slightly below market - consider increasing'
            : competitiveness === 'above_market'
            ? 'Budget is above market - expect high-quality proposals'
            : 'Budget is competitive with market rates'
        }
      }
    });
  } catch (error) {
    console.error('Error comparing pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare pricing'
    });
  }
});

/**
 * POST /api/pricing/milestones
 * Get milestone breakdown suggestion
 */
router.post('/milestones', auth(['client']), async (req, res) => {
  try {
    const { totalBudget, category, deadline, description } = req.body;
    
    if (!totalBudget) {
      return res.status(400).json({
        success: false,
        message: 'Total budget is required'
      });
    }
    
    const projectData = {
      category: category || 'other',
      deadline,
      description
    };
    
    // Create a mock pricing object
    const pricing = {
      recommended: totalBudget
    };
    
    const milestones = await PricingAssistant.suggestMilestoneBreakdown(projectData, pricing);
    
    res.json({
      success: true,
      totalBudget,
      milestones,
      suggestion: {
        message: 'Milestones should be structured to balance risk between client and freelancer',
        tips: [
          'First milestone should be smaller to test the working relationship',
          'Final milestone should include delivery and project wrap-up',
          'Consider adding buffer time between milestones for revisions'
        ]
      }
    });
  } catch (error) {
    console.error('Error generating milestones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate milestone breakdown'
    });
  }
});

/**
 * GET /api/pricing/skill-premium/:skill
 * Get premium rate information for a specific skill
 */
router.get('/skill-premium/:skill', async (req, res) => {
  try {
    const { skill } = req.params;
    
    // Get projects with this skill
    const projects = await Project.find({
      skills: { $regex: new RegExp(skill, 'i') },
      status: { $in: ['completed', 'awarded'] },
      budgetAmount: { $exists: true, $gt: 0 }
    })
    .select('budgetAmount budgetType category')
    .lean();
    
    if (projects.length === 0) {
      return res.json({
        success: true,
        skill,
        premium: {
          available: false,
          message: 'Insufficient data for this skill'
        }
      });
    }
    
    const budgets = projects.map(p => p.budgetAmount).sort((a, b) => a - b);
    const average = budgets.reduce((a, b) => a + b, 0) / budgets.length;
    const median = budgets[Math.floor(budgets.length / 2)];
    
    // Compare with overall market
    const allProjects = await Project.find({
      status: { $in: ['completed', 'awarded'] },
      budgetAmount: { $exists: true, $gt: 0 }
    })
    .select('budgetAmount')
    .lean();
    
    const allBudgets = allProjects.map(p => p.budgetAmount);
    const overallAverage = allBudgets.reduce((a, b) => a + b, 0) / allBudgets.length;
    
    const premiumPercentage = ((average - overallAverage) / overallAverage) * 100;
    
    res.json({
      success: true,
      skill,
      premium: {
        available: true,
        averageBudget: Math.round(average),
        medianBudget: median,
        projectCount: projects.length,
        premiumPercentage: Math.round(premiumPercentage),
        isPremium: premiumPercentage > 10,
        comparison: {
          marketAverage: Math.round(overallAverage),
          difference: Math.round(average - overallAverage)
        }
      }
    });
  } catch (error) {
    console.error('Error getting skill premium:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get skill premium information'
    });
  }
});

/**
 * GET /api/pricing/categories
 * Get pricing information for all categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      'ui-ux-design',
      'frontend-development',
      'backend-development',
      'mobile-app-development',
      'full-stack-development',
      'data-science',
      'digital-marketing',
      'graphic-design',
      'content-writing',
      'other'
    ];
    
    const categoryPricing = [];
    
    for (const category of categories) {
      const projects = await Project.find({
        category,
        status: { $in: ['completed', 'awarded'] },
        budgetAmount: { $exists: true, $gt: 0 }
      })
      .select('budgetAmount')
      .lean();
      
      if (projects.length > 0) {
        const budgets = projects.map(p => p.budgetAmount);
        const average = budgets.reduce((a, b) => a + b, 0) / budgets.length;
        
        categoryPricing.push({
          category,
          projectCount: projects.length,
          averageBudget: Math.round(average),
          minBudget: Math.min(...budgets),
          maxBudget: Math.max(...budgets)
        });
      } else {
        categoryPricing.push({
          category,
          projectCount: 0,
          averageBudget: 0,
          minBudget: 0,
          maxBudget: 0
        });
      }
    }
    
    res.json({
      success: true,
      categories: categoryPricing
    });
  } catch (error) {
    console.error('Error getting category pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category pricing'
    });
  }
});

module.exports = router;