/**
 * Badges API Routes
 * 
 * Handles the freelancer badging system:
 * - View available badges
 * - User badge progress
 * - Badge management
 * - Badge leaderboards
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { BadgeDefinition, UserBadge, seedDefaultBadges } = require('../models/Badge');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * GET /api/badges
 * Get all available badges
 */
router.get('/', async (req, res) => {
  try {
    const { category, tier } = req.query;
    
    const query = { isActive: true };
    if (category) query.category = category;
    if (tier) query.tier = tier;
    
    const badges = await BadgeDefinition.find(query)
      .sort({ displayPriority: -1, tier: 1 })
      .lean();
    
    res.json({
      success: true,
      badges,
      count: badges.length
    });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badges'
    });
  }
});

/**
 * GET /api/badges/:badgeId
 * Get badge details by ID
 */
router.get('/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;
    
    const badge = await BadgeDefinition.findOne({ badgeId }).lean();
    
    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found'
      });
    }
    
    // Get stats about this badge
    const earnedCount = await UserBadge.countDocuments({ badge: badge._id });
    
    res.json({
      success: true,
      badge: {
        ...badge,
        earnedCount
      }
    });
  } catch (error) {
    console.error('Error fetching badge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badge'
    });
  }
});

/**
 * GET /api/badges/user/:userId
 * Get all badges for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { featured } = req.query;
    
    let badges;
    if (featured === 'true') {
      badges = await UserBadge.getFeaturedBadges(userId, 5);
    } else {
      badges = await UserBadge.getUserBadges(userId);
    }
    
    // Get user's total XP
    const user = await User.findById(userId).select('totalXP');
    
    // Calculate badge counts by tier
    const tierCounts = {};
    const earnedBadgeIds = [];
    
    badges.forEach(ub => {
      if (ub.badge) {
        const tier = ub.badge.tier;
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        earnedBadgeIds.push(ub.badge._id);
      }
    });
    
    res.json({
      success: true,
      badges,
      stats: {
        totalEarned: badges.length,
        totalXP: user?.totalXP || 0,
        tierCounts
      }
    });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user badges'
    });
  }
});

/**
 * GET /api/badges/progress/:userId
 * Get badge progress for a user
 */
router.get('/progress/:userId', auth(['client', 'freelancer', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all active badges
    const allBadges = await BadgeDefinition.find({ isActive: true }).lean();
    
    // Get earned badges
    const earnedBadges = await UserBadge.find({ user: userId })
      .populate('badge')
      .lean();
    
    const earnedBadgeIds = earnedBadges.map(ub => ub.badge._id.toString());
    
    // Calculate progress for unearned badges
    const progressList = [];
    
    for (const badge of allBadges) {
      if (earnedBadgeIds.includes(badge._id.toString())) {
        continue; // Skip already earned
      }
      
      // Check eligibility and get progress
      const badgeDoc = await BadgeDefinition.findById(badge._id);
      const eligibility = await badgeDoc.checkEligibility(userId);
      
      progressList.push({
        badge,
        progress: eligibility.progress,
        currentValue: eligibility.currentValue,
        threshold: eligibility.threshold,
        remaining: eligibility.remaining
      });
    }
    
    // Sort by progress (closest to earning first)
    progressList.sort((a, b) => b.progress - a.progress);
    
    res.json({
      success: true,
      earned: earnedBadges,
      inProgress: progressList,
      totalBadges: allBadges.length,
      earnedCount: earnedBadges.length
    });
  } catch (error) {
    console.error('Error fetching badge progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badge progress'
    });
  }
});

/**
 * PUT /api/badges/feature/:userBadgeId
 * Toggle featured status of a badge
 */
router.put('/feature/:userBadgeId', auth(['freelancer']), async (req, res) => {
  try {
    const { userBadgeId } = req.params;
    const { featured, order } = req.body;
    const userId = req.user.userId;
    
    const userBadge = await UserBadge.findById(userBadgeId);
    
    if (!userBadge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found'
      });
    }
    
    // Verify ownership
    if (userBadge.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this badge'
      });
    }
    
    // If featuring, check if already at max featured badges
    if (featured) {
      const featuredCount = await UserBadge.countDocuments({
        user: userId,
        isFeatured: true
      });
      
      if (featuredCount >= 5 && !userBadge.isFeatured) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 featured badges allowed'
        });
      }
    }
    
    userBadge.isFeatured = featured;
    if (order !== undefined) {
      userBadge.featuredOrder = order;
    }
    
    await userBadge.save();
    
    res.json({
      success: true,
      message: featured ? 'Badge featured on profile' : 'Badge removed from featured',
      userBadge
    });
  } catch (error) {
    console.error('Error updating badge feature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update badge'
    });
  }
});

/**
 * POST /api/badges/check
 * Check and award eligible badges for current user
 */
router.post('/check', auth(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const badges = await BadgeDefinition.find({ isActive: true, isAutoAwarded: true });
    const awardedBadges = [];
    
    for (const badge of badges) {
      const eligibility = await badge.checkEligibility(userId);
      
      if (eligibility.eligible) {
        const result = await UserBadge.awardBadge(userId, badge.badgeId);
        
        if (result.isNew) {
          awardedBadges.push({
            badge: badge,
            xpEarned: badge.xpReward
          });
          
          // Send notification
          await Notification.create({
            userId,
            userRole: 'freelancer',
            type: 'badge',
            title: `🏆 Badge Earned: ${badge.name}!`,
            body: badge.description,
            icon: badge.icon,
            data: {
              badgeId: badge.badgeId,
              xpReward: badge.xpReward
            }
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: awardedBadges.length > 0 
        ? `Congratulations! You earned ${awardedBadges.length} new badge(s)!`
        : 'No new badges earned at this time',
      awardedBadges,
      totalXP: awardedBadges.reduce((sum, b) => sum + b.xpEarned, 0)
    });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check badges'
    });
  }
});

/**
 * GET /api/badges/leaderboard/top-earners
 * Get leaderboard of top badge earners
 */
router.get('/leaderboard/top-earners', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const topEarners = await User.aggregate([
      {
        $match: { role: 'freelancer' }
      },
      {
        $lookup: {
          from: 'userbadges',
          localField: '_id',
          foreignField: 'user',
          as: 'badges'
        }
      },
      {
        $addFields: {
          badgeCount: { $size: '$badges' },
          totalXP: { $ifNull: ['$totalXP', 0] }
        }
      },
      {
        $sort: { totalXP: -1, badgeCount: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          profilePicture: 1,
          badgeCount: 1,
          totalXP: 1,
          rating: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      leaderboard: topEarners
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * GET /api/badges/stats/overview
 * Get badge system statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const totalBadges = await BadgeDefinition.countDocuments({ isActive: true });
    const totalEarned = await UserBadge.countDocuments();
    const totalUsers = await UserBadge.distinct('user');
    
    // Badge distribution
    const distribution = await UserBadge.aggregate([
      {
        $lookup: {
          from: 'badgedefinitions',
          localField: 'badge',
          foreignField: '_id',
          as: 'badgeInfo'
        }
      },
      {
        $unwind: '$badgeInfo'
      },
      {
        $group: {
          _id: '$badgeInfo.badgeId',
          name: { $first: '$badgeInfo.name' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Tier distribution
    const tierDistribution = await UserBadge.aggregate([
      {
        $lookup: {
          from: 'badgedefinitions',
          localField: 'badge',
          foreignField: '_id',
          as: 'badgeInfo'
        }
      },
      {
        $unwind: '$badgeInfo'
      },
      {
        $group: {
          _id: '$badgeInfo.tier',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalBadges,
        totalEarned,
        totalUsersWithBadges: totalUsers.length,
        distribution,
        tierDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching badge stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badge statistics'
    });
  }
});

/**
 * POST /api/badges/admin/seed
 * Seed default badges (admin only)
 */
router.post('/admin/seed', auth(['admin']), async (req, res) => {
  try {
    await seedDefaultBadges();
    
    res.json({
      success: true,
      message: 'Default badges seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed badges'
    });
  }
});

/**
 * POST /api/badges/admin/create
 * Create a new badge (admin only)
 */
router.post('/admin/create', auth(['admin']), async (req, res) => {
  try {
    const badgeData = req.body;
    
    // Validate required fields
    if (!badgeData.badgeId || !badgeData.name || !badgeData.description || 
        !badgeData.category || !badgeData.icon || !badgeData.criteria) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const badge = new BadgeDefinition(badgeData);
    await badge.save();
    
    res.status(201).json({
      success: true,
      message: 'Badge created successfully',
      badge
    });
  } catch (error) {
    console.error('Error creating badge:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Badge ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create badge'
    });
  }
});

/**
 * POST /api/badges/admin/award/:userId
 * Manually award a badge to a user (admin only)
 */
router.post('/admin/award/:userId', auth(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { badgeId, reason } = req.body;
    
    if (!badgeId) {
      return res.status(400).json({
        success: false,
        message: 'Badge ID is required'
      });
    }
    
    const result = await UserBadge.awardBadge(userId, badgeId, reason || 'Awarded by admin');
    
    if (result.isNew) {
      // Send notification
      const badge = await BadgeDefinition.findOne({ badgeId });
      await Notification.create({
        userId,
        userRole: 'freelancer',
        type: 'badge',
        title: `🏆 Badge Earned: ${badge.name}!`,
        body: badge.description,
        data: {
          badgeId,
          xpReward: badge.xpReward
        }
      });
    }
    
    res.json({
      success: true,
      message: result.isNew ? 'Badge awarded successfully' : 'User already has this badge',
      userBadge: result.badge,
      isNew: result.isNew
    });
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to award badge'
    });
  }
});

/**
 * DELETE /api/badges/admin/:badgeId
 * Delete a badge (admin only)
 */
router.delete('/admin/:badgeId', auth(['admin']), async (req, res) => {
  try {
    const { badgeId } = req.params;
    
    const badge = await BadgeDefinition.findOneAndDelete({ badgeId });
    
    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found'
      });
    }
    
    // Also delete all user badges
    await UserBadge.deleteMany({ badge: badge._id });
    
    res.json({
      success: true,
      message: 'Badge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting badge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete badge'
    });
  }
});

module.exports = router;