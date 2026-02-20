const mongoose = require('mongoose');

/**
 * Review Model
 * 
 * Supports both milestone-level and project-level reviews
 * Both clients and freelancers can review each other
 */
const reviewSchema = new mongoose.Schema({
  // The workspace/project this review is for
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  
  // The project being reviewed
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  
  // Milestone reference (for milestone-specific reviews)
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    default: null // null for project-level reviews
  },
  
  // Review type
  reviewType: {
    type: String,
    enum: ['milestone', 'project'],
    required: true
  },
  
  // Who is giving the review
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerRole: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  
  // Who is being reviewed
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revieweeRole: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  
  // Rating scores (1-5 scale)
  ratings: {
    overall: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    // For freelancer reviews (by client)
    quality: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    communication: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    expertise: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    // For client reviews (by freelancer)
    clarity: {
      type: Number,
      min: 1,
      max: 5,
      default: null // Project requirements clarity
    },
    responsiveness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    paymentTimeliness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    collaboration: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  },
  
  // Written feedback
  feedback: {
    type: String,
    required: true,
    minlength: 20,
    maxlength: 2000
  },
  
  // Pros and cons (optional)
  pros: {
    type: String,
    maxlength: 500
  },
  cons: {
    type: String,
    maxlength: 500
  },
  
  // Would recommend
  wouldRecommend: {
    type: Boolean,
    default: true
  },
  
  // AI-generated sentiment score
  sentimentAnalysis: {
    score: {
      type: Number,
      min: -1,
      max: 1
    },
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative', null]
    },
    keywords: [String],
    analyzedAt: Date
  },
  
  // Visibility and moderation
  status: {
    type: String,
    enum: ['pending', 'published', 'hidden', 'removed'],
    default: 'published'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Response from reviewee
  response: {
    content: {
      type: String,
      maxlength: 1000
    },
    respondedAt: Date
  },
  
  // Helpfulness tracking
  helpfulVotes: {
    upvotes: {
      type: Number,
      default: 0
    },
    downvotes: {
      type: Number,
      default: 0
    },
    votedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      vote: {
        type: String,
        enum: ['up', 'down']
      }
    }]
  },
  
  // Flags for inappropriate content
  flags: [{
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
reviewSchema.index({ workspace: 1, milestone: 1, reviewer: 1 });
reviewSchema.index({ reviewee: 1, status: 1 });
reviewSchema.index({ project: 1, reviewType: 1 });
reviewSchema.index({ createdAt: -1 });

// Static method to calculate average rating for a user
reviewSchema.statics.calculateUserRating = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        reviewee: mongoose.Types.ObjectId(userId),
        status: 'published'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$ratings.overall' },
        totalReviews: { $sum: 1 },
        qualityAvg: { $avg: '$ratings.quality' },
        communicationAvg: { $avg: '$ratings.communication' },
        timelinessAvg: { $avg: '$ratings.timeliness' },
        expertiseAvg: { $avg: '$ratings.expertise' },
        professionalismAvg: { $avg: '$ratings.professionalism' },
        clarityAvg: { $avg: '$ratings.clarity' },
        responsivenessAvg: { $avg: '$ratings.responsiveness' },
        paymentTimelinessAvg: { $avg: '$ratings.paymentTimeliness' },
        collaborationAvg: { $avg: '$ratings.collaboration' },
        recommendPercentage: {
          $avg: { $cond: ['$wouldRecommend', 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    averageRating: 0,
    totalReviews: 0
  };
};

// Static method to check if user can review
reviewSchema.statics.canReview = async function(workspaceId, reviewerId, reviewType, milestoneId = null) {
  const Workspace = mongoose.model('Workspace');
  const Milestone = mongoose.model('Milestone');
  
  const workspace = await Workspace.findById(workspaceId)
    .populate('project')
    .lean();
  
  if (!workspace) {
    return { allowed: false, reason: 'Workspace not found' };
  }
  
  // Check if reviewer is part of the workspace
  const isClient = workspace.client.toString() === reviewerId.toString();
  const isFreelancer = workspace.freelancer.toString() === reviewerId.toString();
  
  if (!isClient && !isFreelancer) {
    return { allowed: false, reason: 'Not authorized to review this workspace' };
  }
  
  // Check for existing review
  const existingReview = await this.findOne({
    workspace: workspaceId,
    reviewer: reviewerId,
    reviewType,
    milestone: milestoneId
  });
  
  if (existingReview) {
    return { allowed: false, reason: 'Review already submitted' };
  }
  
  // Check workspace/milestone status
  if (reviewType === 'milestone' && milestoneId) {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || !['approved', 'paid'].includes(milestone.status)) {
      return { allowed: false, reason: 'Milestone must be completed before reviewing' };
    }
  } else if (reviewType === 'project') {
    if (workspace.status !== 'completed') {
      return { allowed: false, reason: 'Project must be completed before reviewing' };
    }
  }
  
  return {
    allowed: true,
    reviewee: isClient ? workspace.freelancer : workspace.client,
    reviewerRole: isClient ? 'client' : 'freelancer',
    revieweeRole: isClient ? 'freelancer' : 'client'
  };
};

// Method to update user's overall rating after save
reviewSchema.post('save', async function() {
  const User = mongoose.model('User');
  const stats = await this.constructor.calculateUserRating(this.reviewee);
  
  await User.findByIdAndUpdate(this.reviewee, {
    rating: {
      average: Math.round(stats.averageRating * 10) / 10,
      count: stats.totalReviews
    }
  });
});

module.exports = mongoose.model('Review', reviewSchema);