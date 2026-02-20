// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'client', 'freelancer'],
      message: 'Role must be either admin, client, or freelancer'
    },
    required: [true, 'Role is required']
  },
  
  // Google OAuth fields
  googleId: {
    type: String,
    sparse: true // Allows multiple null values but requires unique non-null values
  },
  profilePicture: {
    type: String,
    default: null
  },

  // Freelancer-specific profile fields
  bio: {
    type: String,
    default: '',
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: function(skills) {
        return skills.length <= 50; // Max 50 skills
      },
      message: 'Cannot have more than 50 skills'
    }
  },
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
    default: null
  },
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'expert'],
    default: null
  },
  portfolio: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    url: String,
    image: String,
    technologies: [String]
  }],
  
  // Profile completion tracking
  profileComplete: {
    type: Boolean,
    default: function() {
      // Auto-complete for non-freelancers
      return this.role !== 'freelancer';
    }
  },

  // Track if user has been shown profile setup popup
  hasSeenProfileSetup: {
    type: Boolean,
    default: false
  },
  
  // Track if user has been shown the push notification enable prompt (one-time)
  hasSeenPushPrompt: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Push Notification fields
  pushSubscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: true },
    deliverableReminders: { type: Boolean, default: true },
    dueDateAlerts: { type: Boolean, default: true },
    overdueAlerts: { type: Boolean, default: true }
  },
  
  // Additional profile fields
  location: {
    type: String,
    default: ''
  },
  languages: [{
    language: { type: String, required: true },
    proficiency: { 
      type: String, 
      enum: ['basic', 'conversational', 'fluent', 'native'],
      required: true 
    }
  }],
  
  // Account status and verification
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationToken: {
    type: String,
    default: null
  },
  verificationTokenExpires: {
    type: Date,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },

  // Soft deletion fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deletionReason: {
    type: String,
    default: null
  },

  // Account deactivation fields (for freelancers)
  deactivatedAt: {
    type: Date,
    default: null
  },
  deactivationReason: {
    type: String,
    default: null
  },
  reactivatedAt: {
    type: Date,
    default: null
  },

  // Password reset fields
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  
  // Freelancer ratings and stats
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  completedProjects: {
    type: Number,
    default: 0
  },
  
  // Badge and XP system
  totalXP: {
    type: Number,
    default: 0,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  featuredBadges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserBadge'
  }],
  
  // Social links
  socialLinks: {
    linkedin: String,
    github: String,
    website: String,
    twitter: String
  },

  // Account Settings
  phoneNumber: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        // Allow empty string or valid phone number format
        return !v || /^\+?[\d\s\-\(\)]{10,20}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Invalid phone number format'
    }
  },

  // Notification Preferences
  notificationSettings: {
    email: {
      projectUpdates: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      proposals: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      weeklyDigest: { type: Boolean, default: true }
    },
    push: {
      projectUpdates: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      proposals: { type: Boolean, default: true }
    },
    sms: {
      enabled: { type: Boolean, default: false },
      urgentOnly: { type: Boolean, default: true }
    }
  },

  // Privacy Settings
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'freelancers-only', 'clients-only'],
      default: 'public'
    },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showLocation: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    allowDirectMessages: { type: Boolean, default: true },
    showInSearchResults: { type: Boolean, default: true }
  },

  // Account Security
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  lastPasswordChange: { type: Date, default: Date.now },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },

  // Session and Login History
  lastLoginAt: { type: Date, default: null },
  lastLoginIP: { type: String, default: null },
  loginHistory: [{
    ip: String,
    userAgent: String,
    location: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // Account Preferences
  preferences: {
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    dateFormat: { type: String, enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], default: 'MM/DD/YYYY' },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();
    
    console.log('Hashing password for user:', this.email);
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    console.log('Password hashed successfully');
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    throw new Error('Password comparison failed');
  }
};

// Method to check if freelancer profile is complete
userSchema.methods.isFreelancerProfileComplete = function() {
  if (this.role !== 'freelancer') return true;

  return !!(
    this.bio &&
    this.bio.trim().length >= 50 && // At least 50 characters in bio
    this.skills &&
    this.skills.length >= 3 // At least 3 skills
  );
};

// Method to update profile completion status
userSchema.methods.updateProfileCompletion = function() {
  this.profileComplete = this.isFreelancerProfileComplete();
  return this.profileComplete;
};

// Pre-save hook to auto-update profile completion and initialize defaults
userSchema.pre('save', function(next) {
  // Initialize default notification settings for new users
  if (this.isNew) {
    if (!this.notificationSettings) {
      this.notificationSettings = {
        email: {
          projectUpdates: true,
          messages: true,
          proposals: true,
          marketing: false,
          weeklyDigest: true
        },
        push: {
          projectUpdates: true,
          messages: true,
          proposals: true
        },
        sms: {
          enabled: false,
          urgentOnly: true
        }
      };
    }

    if (!this.privacySettings) {
      this.privacySettings = {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        showLocation: true,
        showOnlineStatus: true,
        allowDirectMessages: true,
        showInSearchResults: true
      };
    }

    if (!this.preferences) {
      this.preferences = {
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        theme: 'light'
      };
    }
  }

  // Update profile completion for freelancers
  if (this.role === 'freelancer') {
    this.profileComplete = this.isFreelancerProfileComplete();
  }

  next();
});

// Method to add skills (with auto-deduplication)
userSchema.methods.addSkills = function(newSkills) {
  const currentSkills = this.skills || [];
  const skillsToAdd = Array.isArray(newSkills) ? newSkills : [newSkills];
  
  // Normalize and deduplicate
  const normalizedNew = skillsToAdd
    .map(skill => skill.toLowerCase().trim())
    .filter(skill => skill.length > 0);
    
  const normalizedCurrent = currentSkills.map(skill => skill.toLowerCase());
  
  const uniqueNewSkills = normalizedNew.filter(skill => 
    !normalizedCurrent.includes(skill)
  );
  
  // Add original case versions
  const skillsWithOriginalCase = uniqueNewSkills.map(skill => {
    const originalIndex = skillsToAdd.findIndex(s => 
      s.toLowerCase().trim() === skill
    );
    return skillsToAdd[originalIndex] || skill;
  });
  
  this.skills = [...currentSkills, ...skillsWithOriginalCase];
  return this.skills;
};

// Method to update notification settings
userSchema.methods.updateNotificationSettings = function(settings) {
  if (settings.email) {
    this.notificationSettings.email = { ...this.notificationSettings.email, ...settings.email };
  }
  if (settings.push) {
    this.notificationSettings.push = { ...this.notificationSettings.push, ...settings.push };
  }
  if (settings.sms) {
    this.notificationSettings.sms = { ...this.notificationSettings.sms, ...settings.sms };
  }
  return this.notificationSettings;
};

// Method to update privacy settings
userSchema.methods.updatePrivacySettings = function(settings) {
  this.privacySettings = { ...this.privacySettings, ...settings };
  return this.privacySettings;
};

// Method to update account preferences
userSchema.methods.updatePreferences = function(preferences) {
  this.preferences = { ...this.preferences, ...preferences };
  return this.preferences;
};

// Method to record login
userSchema.methods.recordLogin = function(ip, userAgent, location) {
  this.lastLoginAt = new Date();
  this.lastLoginIP = ip;

  // Add to login history (keep last 10 entries)
  this.loginHistory.unshift({
    ip,
    userAgent,
    location,
    timestamp: new Date()
  });

  // Keep only last 10 login records
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(0, 10);
  }

  // Reset login attempts on successful login
  this.loginAttempts = 0;
  this.lockUntil = null;
};

// Method to handle failed login attempts
userSchema.methods.handleFailedLogin = function() {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts for 30 minutes
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function() {
  return this.lockUntil && this.lockUntil > new Date();
};

// Method to get public profile (safe for API responses)
userSchema.methods.getPublicProfile = function() {
  const baseProfile = {
    id: this._id,
    fullName: this.fullName,
    role: this.role,
    profilePicture: this.profilePicture,
    bio: this.bio,
    skills: this.skills,
    hourlyRate: this.hourlyRate,
    experienceLevel: this.experienceLevel,
    rating: this.rating,
    completedProjects: this.completedProjects,
    profileComplete: this.profileComplete,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    languages: this.languages,
    socialLinks: this.socialLinks
  };

  // Add fields based on privacy settings
  if (this.privacySettings?.showEmail) {
    baseProfile.email = this.email;
  }

  if (this.privacySettings?.showPhone && this.phoneNumber) {
    baseProfile.phoneNumber = this.phoneNumber;
  }

  if (this.privacySettings?.showLocation) {
    baseProfile.location = this.location;
  }

  return baseProfile;
};

// Method to get account settings (for profile management)
userSchema.methods.getAccountSettings = function() {
  return {
    phoneNumber: this.phoneNumber,
    notificationSettings: this.notificationSettings,
    privacySettings: this.privacySettings,
    preferences: this.preferences,
    twoFactorEnabled: this.twoFactorEnabled,
    lastPasswordChange: this.lastPasswordChange,
    lastLoginAt: this.lastLoginAt
  };
};

// Add indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ 'rating.average': -1 });
userSchema.index({ completedProjects: -1 });
userSchema.index({ location: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ lastLoginAt: -1 });
userSchema.index({ 'privacySettings.profileVisibility': 1 });
userSchema.index({ 'preferences.language': 1 });

// Text index for search functionality
userSchema.index({
  fullName: 'text',
  bio: 'text',
  skills: 'text'
});

module.exports = mongoose.model('User', userSchema);
