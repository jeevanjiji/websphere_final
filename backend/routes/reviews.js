/**
 * Reviews API Routes
 * 
 * Handles feedback and rating system for:
 * - Milestone reviews (after each milestone completion)
 * - Project reviews (at project end)
 * - Both client and freelancer reviews
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const Review = require('../models/Review');
const Workspace = require('../models/Workspace');
const Milestone = require('../models/Milestone');
const User = require('../models/User');
const SentimentAnalyzer = require('../services/sentimentAnalyzer');
const Notification = require('../models/Notification');

/**
 * POST /api/reviews/milestone
 * Submit a review for a completed milestone
 */
router.post('/milestone', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { workspaceId, milestoneId, ratings, feedback, pros, cons, wouldRecommend } = req.body;
    const reviewerId = req.user.userId;

    // Verify milestone is completed
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    if (!['approved', 'paid'].includes(milestone.status)) {
      return res.status(400).json({
        success: false,
        message: 'Milestone must be completed before reviewing'
      });
    }

    // Check if user can review
    const canReview = await Review.canReview(workspaceId, reviewerId, 'milestone', milestoneId);
    if (!canReview.allowed) {
      return res.status(400).json({
        success: false,
        message: canReview.reason
      });
    }

    // Get workspace for project reference
    const workspace = await Workspace.findById(workspaceId).populate('project');

    // Analyze sentiment of feedback
    const sentimentResult = await SentimentAnalyzer.analyzeSentiment(feedback, { detailed: true });

    // Create the review
    const review = new Review({
      workspace: workspaceId,
      project: workspace.project._id,
      milestone: milestoneId,
      reviewType: 'milestone',
      reviewer: reviewerId,
      reviewerRole: canReview.reviewerRole,
      reviewee: canReview.reviewee,
      revieweeRole: canReview.revieweeRole,
      ratings: {
        overall: ratings.overall,
        // Freelancer ratings (by client)
        quality: ratings.quality || null,
        communication: ratings.communication || null,
        timeliness: ratings.timeliness || null,
        expertise: ratings.expertise || null,
        professionalism: ratings.professionalism || null,
        // Client ratings (by freelancer)
        clarity: ratings.clarity || null,
        responsiveness: ratings.responsiveness || null,
        paymentTimeliness: ratings.paymentTimeliness || null,
        collaboration: ratings.collaboration || null
      },
      feedback,
      pros,
      cons,
      wouldRecommend: wouldRecommend !== undefined ? wouldRecommend : true,
      sentimentAnalysis: sentimentResult.success ? {
        score: sentimentResult.score,
        label: sentimentResult.label,
        keywords: sentimentResult.keywords?.map(k => k.word) || [],
        analyzedAt: new Date()
      } : null
    });

    await review.save();

    // Send notification to reviewee
    await Notification.create({
      userId: canReview.reviewee,
      userRole: canReview.revieweeRole,
      type: 'review',
      title: '⭐ New Review Received',
      body: `You received a ${ratings.overall}-star review for milestone "${milestone.title}"`,
      data: {
        reviewId: review._id,
        workspaceId,
        milestoneId,
        rating: ratings.overall
      }
    });

    // Check for badge eligibility
    const { UserBadge } = require('../models/Badge');
    await checkAndAwardBadges(canReview.reviewee);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: await review.populate('reviewer', 'fullName profilePicture')
    });
  } catch (error) {
    console.error('Error submitting milestone review:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit review'
    });
  }
});

/**
 * POST /api/reviews/project
 * Submit a review for a completed project
 */
router.post('/project', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { workspaceId, ratings, feedback, pros, cons, wouldRecommend } = req.body;
    const reviewerId = req.user.userId;

    // Check if user can review
    const canReview = await Review.canReview(workspaceId, reviewerId, 'project');
    if (!canReview.allowed) {
      return res.status(400).json({
        success: false,
        message: canReview.reason
      });
    }

    // Get workspace
    const workspace = await Workspace.findById(workspaceId).populate('project');
    
    if (workspace.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Project must be completed before reviewing'
      });
    }

    // Analyze sentiment
    const sentimentResult = await SentimentAnalyzer.analyzeSentiment(feedback, { detailed: true });

    // Create the review
    const review = new Review({
      workspace: workspaceId,
      project: workspace.project._id,
      reviewType: 'project',
      reviewer: reviewerId,
      reviewerRole: canReview.reviewerRole,
      reviewee: canReview.reviewee,
      revieweeRole: canReview.revieweeRole,
      ratings: {
        overall: ratings.overall,
        quality: ratings.quality || null,
        communication: ratings.communication || null,
        timeliness: ratings.timeliness || null,
        expertise: ratings.expertise || null,
        professionalism: ratings.professionalism || null,
        clarity: ratings.clarity || null,
        responsiveness: ratings.responsiveness || null,
        paymentTimeliness: ratings.paymentTimeliness || null,
        collaboration: ratings.collaboration || null
      },
      feedback,
      pros,
      cons,
      wouldRecommend: wouldRecommend !== undefined ? wouldRecommend : true,
      sentimentAnalysis: sentimentResult.success ? {
        score: sentimentResult.score,
        label: sentimentResult.label,
        keywords: sentimentResult.keywords?.map(k => k.word) || [],
        analyzedAt: new Date()
      } : null
    });

    await review.save();

    // Update user rating
    const stats = await Review.calculateUserRating(canReview.reviewee);
    await User.findByIdAndUpdate(canReview.reviewee, {
      rating: {
        average: stats.averageRating,
        count: stats.totalReviews
      }
    });

    // Send notification
    await Notification.create({
      userId: canReview.reviewee,
      userRole: canReview.revieweeRole,
      type: 'review',
      title: '⭐ Project Review Received',
      body: `You received a ${ratings.overall}-star review for project "${workspace.project.title}"`,
      data: {
        reviewId: review._id,
        workspaceId,
        projectId: workspace.project._id,
        rating: ratings.overall
      }
    });

    // Check badge eligibility
    const { UserBadge } = require('../models/Badge');
    await checkAndAwardBadges(canReview.reviewee);

    res.status(201).json({
      success: true,
      message: 'Project review submitted successfully',
      review: await review.populate(['reviewer', 'project'])
    });
  } catch (error) {
    console.error('Error submitting project review:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit review'
    });
  }
});

/**
 * GET /api/reviews/user/:userId
 * Get all reviews for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, reviewType, role } = req.query;

    const query = {
      reviewee: userId,
      status: 'published'
    };

    if (reviewType) {
      query.reviewType = reviewType;
    }

    const reviews = await Review.find(query)
      .populate('reviewer', 'fullName profilePicture role')
      .populate('project', 'title category')
      .populate('milestone', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Review.countDocuments(query);

    // Get rating summary
    const stats = await Review.calculateUserRating(userId);

    res.json({
      success: true,
      reviews,
      summary: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

/**
 * GET /api/reviews/workspace/:workspaceId
 * Get reviews for a workspace
 */
router.get('/workspace/:workspaceId', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const reviews = await Review.find({ workspace: workspaceId })
      .populate('reviewer', 'fullName profilePicture role')
      .populate('milestone', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Error fetching workspace reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

/**
 * GET /api/reviews/can-review/:workspaceId
 * Check if user can submit a review
 */
router.get('/can-review/:workspaceId', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { milestoneId, reviewType = 'project' } = req.query;
    const userId = req.user.userId;

    const canReview = await Review.canReview(workspaceId, userId, reviewType, milestoneId || null);

    res.json({
      success: true,
      ...canReview
    });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check review eligibility'
    });
  }
});

/**
 * GET /api/reviews/pending
 * Get pending reviews for the current user
 */
router.get('/pending', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find workspaces where user is a participant
    const workspaces = await Workspace.find({
      $or: [
        { client: userId },
        { freelancer: userId }
      ],
      status: { $in: ['active', 'completed'] }
    })
    .populate('project', 'title category')
    .lean();

    const pendingReviews = [];

    for (const workspace of workspaces) {
      // Check for completed milestones without reviews
      if (workspace.status === 'active') {
        const milestones = await Milestone.find({
          workspace: workspace._id,
          status: { $in: ['approved', 'paid'] }
        }).lean();

        for (const milestone of milestones) {
          const existingReview = await Review.findOne({
            workspace: workspace._id,
            milestone: milestone._id,
            reviewer: userId
          });

          if (!existingReview) {
            pendingReviews.push({
              type: 'milestone',
              workspace,
              milestone,
              reviewee: workspace.client.toString() === userId 
                ? workspace.freelancer 
                : workspace.client
            });
          }
        }
      }

      // Check for completed projects without reviews
      if (workspace.status === 'completed') {
        const existingReview = await Review.findOne({
          workspace: workspace._id,
          reviewType: 'project',
          reviewer: userId
        });

        if (!existingReview) {
          pendingReviews.push({
            type: 'project',
            workspace,
            reviewee: workspace.client.toString() === userId 
              ? workspace.freelancer 
              : workspace.client
          });
        }
      }
    }

    res.json({
      success: true,
      pendingReviews,
      count: pendingReviews.length
    });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reviews'
    });
  }
});

/**
 * PUT /api/reviews/:reviewId/response
 * Add response to a review (by reviewee)
 */
router.put('/:reviewId/response', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the reviewee
    if (review.reviewee.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the reviewed user can respond'
      });
    }

    // Check if already responded
    if (review.response?.content) {
      return res.status(400).json({
        success: false,
        message: 'Response already submitted'
      });
    }

    review.response = {
      content,
      respondedAt: new Date()
    };

    await review.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      review
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response'
    });
  }
});

/**
 * POST /api/reviews/:reviewId/helpful
 * Vote on review helpfulness
 */
router.post('/:reviewId/helpful', auth(['client', 'freelancer']), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { vote } = req.body; // 'up' or 'down'
    const userId = req.user.userId;

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote. Use "up" or "down"'
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if already voted
    const existingVote = review.helpfulVotes.votedBy.find(
      v => v.user.toString() === userId
    );

    if (existingVote) {
      // Update existing vote
      if (existingVote.vote === 'up') {
        review.helpfulVotes.upvotes--;
      } else {
        review.helpfulVotes.downvotes--;
      }
      existingVote.vote = vote;
    } else {
      // Add new vote
      review.helpfulVotes.votedBy.push({ user: userId, vote });
    }

    if (vote === 'up') {
      review.helpfulVotes.upvotes++;
    } else {
      review.helpfulVotes.downvotes++;
    }

    await review.save();

    res.json({
      success: true,
      message: 'Vote recorded',
      helpfulVotes: {
        upvotes: review.helpfulVotes.upvotes,
        downvotes: review.helpfulVotes.downvotes
      }
    });
  } catch (error) {
    console.error('Error voting on review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vote'
    });
  }
});

/**
 * Helper function to check and award badges
 */
async function checkAndAwardBadges(userId) {
  try {
    const { BadgeDefinition, UserBadge } = require('../models/Badge');
    
    const badges = await BadgeDefinition.find({ isActive: true, isAutoAwarded: true });
    
    for (const badge of badges) {
      const eligibility = await badge.checkEligibility(userId);
      
      if (eligibility.eligible) {
        await UserBadge.awardBadge(userId, badge.badgeId);
      }
    }
  } catch (error) {
    console.error('Error checking badges:', error);
  }
}

module.exports = router;