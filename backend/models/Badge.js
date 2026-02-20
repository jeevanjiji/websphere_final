const mongoose = require('mongoose');

/**
 * Badge Definition Schema
 * Defines available badges and their criteria
 */
const badgeDefinitionSchema = new mongoose.Schema({
  // Badge identification
  badgeId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  category: {
    type: String,
    enum: [
      'skill',           // Skill-based badges
      'achievement',     // Milestone achievements
      'reputation',      // Reputation-based
      'specialization',  // Domain expertise
      'behavior',        // Positive behavior patterns
      'tenure',          // Time-based
      'exclusive'        // Special/limited badges
    ],
    required: true
  },
  
  // Badge tiers
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze'
  },
  
  // Badge icon and styling
  icon: {
    type: String,  // Emoji or icon identifier
    required: true
  },
  color: {
    primary: { type: String, default: '#6366f1' },
    secondary: { type: String, default: '#818cf8' }
  },
  
  // Earning criteria
  criteria: {
    type: {
      type: String,
      enum: [
        'projects_completed',      // Number of projects completed
        'rating_average',          // Average rating threshold
        'reviews_received',        // Number of reviews
        'on_time_delivery',        // On-time delivery percentage
        'earnings_total',          // Total earnings threshold
        'skills_verified',         // Number of verified skills
        'response_time',           // Average response time
        'repeat_clients',          // Repeat client percentage
        'milestone_streak',        // Consecutive milestone completions
        'tenure_months',           // Months on platform
        'no_disputes',             // No disputes for X months
        'specific_skill',          // Expert in specific skill
        'custom'                   // Custom criteria
      ],
      required: true
    },
    threshold: {
      type: Number,
      required: true
    },
    timeframe: {
      type: String,  // e.g., '30d', '90d', 'all-time'
      default: 'all-time'
    },
    additionalConditions: mongoose.Schema.Types.Mixed
  },
  
  // Badge rarity
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  
  // Display settings
  displayPriority: {
    type: Number,
    default: 0  // Higher = more prominent display
  },
  showOnProfile: {
    type: Boolean,
    default: true
  },
  showInSearch: {
    type: Boolean,
    default: true
  },
  
  // XP points awarded for earning
  xpReward: {
    type: Number,
    default: 0
  },
  
  // Badge status
  isActive: {
    type: Boolean,
    default: true
  },
  isAutoAwarded: {
    type: Boolean,
    default: true  // If false, manually awarded by admin
  }
}, {
  timestamps: true
});

/**
 * User Badge Schema
 * Tracks badges earned by users
 */
const userBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BadgeDefinition',
    required: true
  },
  
  // When and how earned
  earnedAt: {
    type: Date,
    default: Date.now
  },
  earnedReason: {
    type: String,
    maxlength: 500
  },
  
  // Progress tracking for tiered badges
  progress: {
    current: {
      type: Number,
      default: 0
    },
    target: {
      type: Number,
      default: 100
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  
  // Badge level (for badges with multiple levels)
  level: {
    type: Number,
    default: 1
  },
  
  // Featured badge on profile
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  featuredOrder: {
    type: Number,
    default: 0
  },
  
  // XP earned from this badge
  xpEarned: {
    type: Number,
    default: 0
  },
  
  // Notification sent
  notificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes
userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, earnedAt: -1 });
userBadgeSchema.index({ user: 1, isFeatured: 1 });

/**
 * Badge Definition Methods
 */
badgeDefinitionSchema.methods.checkEligibility = async function(userId) {
  const User = mongoose.model('User');
  const Review = mongoose.model('Review');
  const Project = mongoose.model('Project');
  const Milestone = mongoose.model('Milestone');
  
  const user = await User.findById(userId);
  if (!user || user.role !== 'freelancer') {
    return { eligible: false, progress: 0 };
  }
  
  let currentValue = 0;
  const criteriaType = this.criteria.type;
  const threshold = this.criteria.threshold;
  
  switch (criteriaType) {
    case 'projects_completed':
      currentValue = user.completedProjects || 0;
      break;
      
    case 'rating_average':
      currentValue = user.rating?.average || 0;
      break;
      
    case 'reviews_received':
      const reviewStats = await Review.countDocuments({
        reviewee: userId,
        status: 'published'
      });
      currentValue = reviewStats;
      break;
      
    case 'earnings_total':
      currentValue = user.totalEarnings || 0;
      break;
      
    case 'tenure_months':
      const monthsOnPlatform = Math.floor(
        (Date.now() - user.createdAt) / (1000 * 60 * 60 * 24 * 30)
      );
      currentValue = monthsOnPlatform;
      break;
      
    case 'on_time_delivery':
      const milestones = await Milestone.find({
        submittedBy: userId,
        status: { $in: ['approved', 'paid'] }
      });
      if (milestones.length === 0) {
        currentValue = 0;
      } else {
        const onTime = milestones.filter(m => 
          m.submissionDate && m.dueDate && 
          new Date(m.submissionDate) <= new Date(m.dueDate)
        ).length;
        currentValue = Math.round((onTime / milestones.length) * 100);
      }
      break;
      
    case 'milestone_streak':
      // Get recent completed milestones
      const recentMilestones = await Milestone.find({
        submittedBy: userId,
        status: { $in: ['approved', 'paid'] }
      }).sort({ completedDate: -1 }).limit(100);
      
      let streak = 0;
      for (const m of recentMilestones) {
        if (m.submissionDate && m.dueDate && 
            new Date(m.submissionDate) <= new Date(m.dueDate)) {
          streak++;
        } else {
          break;
        }
      }
      currentValue = streak;
      break;
      
    case 'no_disputes':
      const Escrow = mongoose.model('Escrow');
      const disputablePeriod = new Date(Date.now() - this.criteria.threshold * 24 * 60 * 60 * 1000);
      const disputes = await Escrow.countDocuments({
        freelancer: userId,
        disputeRaised: true,
        createdAt: { $gte: disputablePeriod }
      });
      currentValue = disputes === 0 ? this.criteria.threshold : 0;
      break;
      
    case 'specific_skill':
      const skillName = this.criteria.additionalConditions?.skillName;
      if (skillName && user.skills) {
        currentValue = user.skills.some(s => 
          s.toLowerCase().includes(skillName.toLowerCase())
        ) ? threshold : 0;
      }
      break;
      
    default:
      currentValue = 0;
  }
  
  const progress = Math.min(100, Math.round((currentValue / threshold) * 100));
  const eligible = currentValue >= threshold;
  
  return {
    eligible,
    currentValue,
    threshold,
    progress,
    remaining: Math.max(0, threshold - currentValue)
  };
};

/**
 * User Badge Static Methods
 */
userBadgeSchema.statics.getUserBadges = async function(userId) {
  return await this.find({ user: userId })
    .populate('badge')
    .sort({ isFeatured: -1, earnedAt: -1 });
};

userBadgeSchema.statics.getFeaturedBadges = async function(userId, limit = 5) {
  return await this.find({ user: userId, isFeatured: true })
    .populate('badge')
    .sort({ featuredOrder: 1 })
    .limit(limit);
};

userBadgeSchema.statics.awardBadge = async function(userId, badgeId, reason = '') {
  const BadgeDefinition = mongoose.model('BadgeDefinition');
  
  const badge = await BadgeDefinition.findOne({ badgeId });
  if (!badge) {
    throw new Error('Badge not found');
  }
  
  // Check if already earned
  const existing = await this.findOne({ user: userId, badge: badge._id });
  if (existing) {
    return { badge: existing, isNew: false };
  }
  
  // Award the badge
  const userBadge = await this.create({
    user: userId,
    badge: badge._id,
    earnedReason: reason,
    xpEarned: badge.xpReward,
    progress: {
      current: badge.criteria.threshold,
      target: badge.criteria.threshold,
      percentage: 100
    }
  });
  
  // Update user's total XP
  const User = mongoose.model('User');
  await User.findByIdAndUpdate(userId, {
    $inc: { totalXP: badge.xpReward }
  });
  
  return { badge: userBadge, isNew: true };
};

// Pre-defined badges
const DEFAULT_BADGES = [
  {
    badgeId: 'FIRST_PROJECT',
    name: 'First Steps',
    description: 'Completed your first project successfully',
    category: 'achievement',
    tier: 'bronze',
    icon: '🎯',
    criteria: { type: 'projects_completed', threshold: 1 },
    rarity: 'common',
    displayPriority: 10,
    xpReward: 50
  },
  {
    badgeId: 'RISING_STAR',
    name: 'Rising Star',
    description: 'Completed 10 projects with great ratings',
    category: 'achievement',
    tier: 'silver',
    icon: '⭐',
    criteria: { type: 'projects_completed', threshold: 10 },
    rarity: 'uncommon',
    displayPriority: 20,
    xpReward: 200
  },
  {
    badgeId: 'PRO_FREELANCER',
    name: 'Professional Freelancer',
    description: 'Completed 50 projects on WebSphere',
    category: 'achievement',
    tier: 'gold',
    icon: '🏆',
    criteria: { type: 'projects_completed', threshold: 50 },
    rarity: 'rare',
    displayPriority: 30,
    xpReward: 500
  },
  {
    badgeId: 'ELITE_FREELANCER',
    name: 'Elite Freelancer',
    description: 'Completed 100+ projects - A true expert',
    category: 'achievement',
    tier: 'platinum',
    icon: '💎',
    criteria: { type: 'projects_completed', threshold: 100 },
    rarity: 'epic',
    displayPriority: 40,
    xpReward: 1000
  },
  {
    badgeId: 'TOP_RATED',
    name: 'Top Rated',
    description: 'Maintained a 4.8+ average rating',
    category: 'reputation',
    tier: 'gold',
    icon: '🌟',
    criteria: { type: 'rating_average', threshold: 4.8 },
    rarity: 'rare',
    displayPriority: 35,
    xpReward: 300
  },
  {
    badgeId: 'FIVE_STAR_PERFORMER',
    name: 'Five Star Performer',
    description: 'Achieved a perfect 5.0 rating with 10+ reviews',
    category: 'reputation',
    tier: 'platinum',
    icon: '🎖️',
    criteria: { type: 'rating_average', threshold: 5.0 },
    rarity: 'epic',
    displayPriority: 45,
    xpReward: 400
  },
  {
    badgeId: 'ON_TIME_CHAMPION',
    name: 'On-Time Champion',
    description: '95%+ on-time delivery rate',
    category: 'behavior',
    tier: 'gold',
    icon: '⏰',
    criteria: { type: 'on_time_delivery', threshold: 95 },
    rarity: 'rare',
    displayPriority: 25,
    xpReward: 250
  },
  {
    badgeId: 'RELIABLE_PARTNER',
    name: 'Reliable Partner',
    description: '10 consecutive on-time milestone deliveries',
    category: 'behavior',
    tier: 'silver',
    icon: '🤝',
    criteria: { type: 'milestone_streak', threshold: 10 },
    rarity: 'uncommon',
    displayPriority: 15,
    xpReward: 150
  },
  {
    badgeId: 'EARNER_10K',
    name: '₹10K Club',
    description: 'Earned ₹10,000 on WebSphere',
    category: 'achievement',
    tier: 'bronze',
    icon: '💰',
    criteria: { type: 'earnings_total', threshold: 10000 },
    rarity: 'common',
    displayPriority: 5,
    xpReward: 100
  },
  {
    badgeId: 'EARNER_100K',
    name: '₹100K Club',
    description: 'Earned ₹100,000 on WebSphere',
    category: 'achievement',
    tier: 'gold',
    icon: '💵',
    criteria: { type: 'earnings_total', threshold: 100000 },
    rarity: 'rare',
    displayPriority: 30,
    xpReward: 500
  },
  {
    badgeId: 'TRUSTED_FREELANCER',
    name: 'Trusted Freelancer',
    description: 'No disputes for 6 months',
    category: 'reputation',
    tier: 'silver',
    icon: '✅',
    criteria: { type: 'no_disputes', threshold: 180 },
    rarity: 'uncommon',
    displayPriority: 20,
    xpReward: 200
  },
  {
    badgeId: 'VETERAN',
    name: 'WebSphere Veteran',
    description: 'Active on WebSphere for 12 months',
    category: 'tenure',
    tier: 'gold',
    icon: '🗓️',
    criteria: { type: 'tenure_months', threshold: 12 },
    rarity: 'rare',
    displayPriority: 25,
    xpReward: 300
  },
  {
    badgeId: 'CUSTOMER_FAVORITE',
    name: 'Customer Favorite',
    description: 'Received 25+ positive reviews',
    category: 'reputation',
    tier: 'gold',
    icon: '❤️',
    criteria: { type: 'reviews_received', threshold: 25 },
    rarity: 'rare',
    displayPriority: 30,
    xpReward: 350
  }
];

// Function to seed default badges
async function seedDefaultBadges() {
  const BadgeDefinition = mongoose.model('BadgeDefinition');
  
  for (const badgeData of DEFAULT_BADGES) {
    await BadgeDefinition.findOneAndUpdate(
      { badgeId: badgeData.badgeId },
      badgeData,
      { upsert: true, new: true }
    );
  }
  
  console.log(`✅ Seeded ${DEFAULT_BADGES.length} default badges`);
}

// Export models
const BadgeDefinition = mongoose.model('BadgeDefinition', badgeDefinitionSchema);
const UserBadge = mongoose.model('UserBadge', userBadgeSchema);

module.exports = {
  BadgeDefinition,
  UserBadge,
  seedDefaultBadges,
  DEFAULT_BADGES
};