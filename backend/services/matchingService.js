// backend/services/matchingService.js
// High-level service layer for the Hybrid Recommendation System
// Handles caching, analytics, project→freelancer matching, and pipeline orchestration

const MatchingEngine = require('./matchingEngine');
const Application = require('../models/Application');
const User = require('../models/User');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

/**
 * MatchingService
 *
 * Wraps the HybridMatchingEngine with:
 *   - In-memory caching (5-minute TTL)
 *   - Analytics tracking
 *   - Project→Freelancer recommendation (client-side)
 *   - Freelancer→Project recommendation (freelancer-side)
 *   - Batch processing
 */
class MatchingService {
  constructor() {
    this.matchingEngine = MatchingEngine;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CLIENT-SIDE: Recommend freelancers for a project
  // ═══════════════════════════════════════════════════════════════════════════

  async getRecommendedFreelancers(projectId, options = {}) {
    try {
      const cacheKey = `matches:${projectId}:${JSON.stringify(options)}`;

      // Check cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return { ...cached.data, fromCache: true };
        }
      }

      // Run hybrid recommendation pipeline
      const matches = await this.matchingEngine.matchFreelancersToProject(projectId, options);

      // Post-filter: remove freelancers who already applied
      const filteredMatches = await this.filterAppliedFreelancers(matches.matches, projectId);

      const result = {
        ...matches,
        matches: filteredMatches,
        fromCache: false
      };

      // Cache result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      // Track analytics
      this.trackMatchingAnalytics(projectId, result);

      return result;

    } catch (error) {
      console.error('MatchingService Error:', error);
      throw new Error('Failed to get recommended freelancers');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FREELANCER-SIDE: Recommend projects for a freelancer
  //  Uses the same hybrid pipeline but from the freelancer's perspective
  // ═══════════════════════════════════════════════════════════════════════════

  async getRecommendedProjects(freelancerId, options = {}) {
    try {
      console.log('🎯 getRecommendedProjects called with:', { freelancerId, options });

      const { limit = 10, category = null } = options;

      // Get freelancer profile
      const freelancer = await User.findById(freelancerId).lean();
      if (!freelancer) throw new Error('Freelancer not found');
      if (freelancer.role !== 'freelancer') throw new Error('User is not a freelancer');

      console.log('✅ Freelancer found:', {
        name: freelancer.fullName,
        skills: freelancer.skills?.length || 0,
        experienceLevel: freelancer.experienceLevel
      });

      // Build project query
      const projectQuery = this.buildProjectQuery(freelancer, category);
      const projects = await Project.find(projectQuery)
        .populate('client', 'fullName profilePicture')
        .lean()
        .limit(limit * 3); // Fetch more to filter later

      console.log('📊 Found', projects.length, 'candidate projects');

      // Score & rank projects using the hybrid pipeline
      const scoredProjects = await this.scoreProjectsForFreelancer(projects, freelancer);

      // Filter out already-applied projects
      const filteredProjects = await this.filterAppliedProjects(scoredProjects, freelancerId);

      return {
        projects: filteredProjects.slice(0, limit),
        totalAvailable: projects.length,
        freelancerProfile: {
          skills: freelancer.skills,
          experienceLevel: freelancer.experienceLevel,
          hourlyRate: freelancer.hourlyRate
        },
        pipelineInfo: {
          algorithm: 'hybrid_content_cf_rerank',
          version: '2.0.0',
          candidatesScanned: projects.length,
          matchesReturned: Math.min(filteredProjects.length, limit)
        }
      };

    } catch (error) {
      console.error('MatchingService Error:', error);
      throw new Error('Failed to get recommended projects');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PROJECT SCORING (Freelancer perspective)
  //  Mirrors the hybrid pipeline but scoring projects against a freelancer
  // ═══════════════════════════════════════════════════════════════════════════

  async scoreProjectsForFreelancer(projects, freelancer) {
    // Build collaborative signals for freelancer→project matching
    const collaborativeSignals = await this.buildProjectCollaborativeSignals(projects, freelancer);

    // Create freelancer embedding once (reuse for all projects)
    const freelancerEmbedding = this.matchingEngine.createFreelancerVector(freelancer);

    return projects.map(project => {
      // Stage 2: Content-based similarity (cosine similarity on embeddings)
      const projectEmbedding = this.matchingEngine.createProjectVector(project);
      const contentScore = this.matchingEngine._cosineSimilarity(projectEmbedding, freelancerEmbedding);

      // Stage 3: Collaborative filtering score
      const collaborativeScore = collaborativeSignals.get(project._id.toString()) || 0;

      // Individual feature scores for breakdown display
      const skillOverlap = this.matchingEngine._skillOverlapFeature
        ? this.matchingEngine._skillOverlapFeature(freelancer, project)
        : this.matchingEngine.calculateSkillSimilarity(
            project.skills || [],
            freelancer.skills || []
          );

      const rateScore = this.matchingEngine.calculateRateCompatibility(
        freelancer.hourlyRate,
        project
      );

      const portfolioScore = this.matchingEngine.calculatePortfolioRelevance(
        freelancer.portfolio,
        project
      );

      const projectQualityScore = this.calculateProjectQualityScore(project);

      // Stage 4: Re-ranking blend (paper weights)
      const totalScore =
        (contentScore *       0.30) +
        (collaborativeScore * 0.20) +
        (skillOverlap *       0.15) +
        (rateScore *          0.10) +
        (portfolioScore *     0.10) +
        (projectQualityScore * 0.15);

      // Match tier
      const matchTier = totalScore >= 0.75 ? 'excellent'
                      : totalScore >= 0.55 ? 'strong'
                      : totalScore >= 0.40 ? 'good'
                      : 'fair';

      return {
        ...project,
        scores: {
          total: this._round(totalScore),
          content: this._round(contentScore),
          collaborative: this._round(collaborativeScore),
          projectQuality: this._round(projectQualityScore),
          skill: this._round(skillOverlap),
          rate: this._round(rateScore),
          portfolio: this._round(portfolioScore)
        },
        totalScore,
        matchTier,
        matchReason: this.generateProjectMatchReason(skillOverlap, rateScore, collaborativeScore, contentScore),
        pipelineStages: {
          contentBased: this._round(contentScore),
          collaborativeFiltering: this._round(collaborativeScore),
          reranked: this._round(totalScore)
        }
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  COLLABORATIVE SIGNALS (Freelancer→Project perspective)
  // ═══════════════════════════════════════════════════════════════════════════

  async buildProjectCollaborativeSignals(projects, freelancer) {
    const projectIds = projects.map(p => p._id);
    if (projectIds.length === 0) return new Map();

    const [projectApplicationStats, freelancerWins] = await Promise.all([
      Application.aggregate([
        { $match: { project: { $in: projectIds } } },
        {
          $group: {
            _id: '$project',
            totalApplications: { $sum: 1 },
            successfulApplications: {
              $sum: { $cond: [{ $in: ['$status', ['accepted', 'awarded']] }, 1, 0] }
            }
          }
        }
      ]),
      Application.aggregate([
        {
          $match: {
            freelancer: freelancer._id,
            status: { $in: ['accepted', 'awarded'] }
          }
        },
        {
          $group: {
            _id: '$client',
            successfulWithClient: { $sum: 1 }
          }
        }
      ])
    ]);

    const projectStatsMap = new Map(
      projectApplicationStats.map(r => [r._id.toString(), r])
    );
    const clientWinsMap = new Map(
      freelancerWins.map(r => [r._id.toString(), r.successfulWithClient])
    );

    const signals = new Map();
    projects.forEach(project => {
      const stats = projectStatsMap.get(project._id.toString()) || {
        totalApplications: 0,
        successfulApplications: 0
      };

      // Success rate of this project's applications
      const successRate = stats.totalApplications > 0
        ? stats.successfulApplications / stats.totalApplications
        : 0;

      // Prior success with this client
      const projectClientId = project.client?._id
        ? project.client._id.toString()
        : project.client?.toString();
      const priorClientSuccess = Math.min(1, (clientWinsMap.get(projectClientId) || 0) / 2);

      // Competition factor (fewer applicants = better chance)
      const competitionFactor = stats.totalApplications > 0
        ? Math.max(0.3, 1 - (stats.totalApplications / 20))
        : 0.8;

      const score = (successRate * 0.30) + (priorClientSuccess * 0.45) + (competitionFactor * 0.25);
      signals.set(project._id.toString(), score);
    });

    return signals;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  async getMatchingAnalytics(projectId) {
    try {
      const project = await Project.findById(projectId).lean();
      if (!project) throw new Error('Project not found');

      const totalFreelancers = await User.countDocuments({ role: 'freelancer' });
      const qualifiedFreelancers = await this.countQualifiedFreelancers(project);
      const applications = await Application.countDocuments({ project: projectId });
      const skillAnalysis = await this.analyzeSkillAvailability(project.skills || []);
      const budgetAnalysis = await this.analyzeBudgetCompetitiveness(project);

      return {
        project: {
          title: project.title,
          category: project.category,
          skills: project.skills
        },
        statistics: {
          totalFreelancers,
          qualifiedFreelancers,
          applications,
          matchRate: qualifiedFreelancers > 0 ? (applications / qualifiedFreelancers) : 0
        },
        skillAnalysis,
        budgetAnalysis,
        recommendations: this.generateImprovementRecommendations(project, {
          qualifiedFreelancers, applications, skillAnalysis, budgetAnalysis
        }),
        pipelineInfo: {
          algorithm: 'hybrid_content_cf_rerank',
          version: '2.0.0'
        }
      };

    } catch (error) {
      console.error('Analytics Error:', error);
      throw new Error('Failed to get matching analytics');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BATCH PROCESSING & NEW FREELANCER MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  async batchMatchProjects(projectIds, options = {}) {
    const results = new Map();
    for (const projectId of projectIds) {
      try {
        const matches = await this.getRecommendedFreelancers(projectId, options);
        results.set(projectId, matches);
      } catch (error) {
        console.error(`Batch matching failed for project ${projectId}:`, error);
        results.set(projectId, { error: error.message });
      }
    }
    return results;
  }

  async findProjectsForNewFreelancer(freelancerId) {
    try {
      const matches = await this.getRecommendedProjects(freelancerId, { limit: 5 });
      // High-quality threshold for notifications
      const highQualityMatches = matches.projects.filter(p => p.scores.total > 0.6);

      return {
        matches: highQualityMatches,
        shouldNotify: highQualityMatches.length > 0
      };
    } catch (error) {
      console.error('New freelancer matching error:', error);
      return { matches: [], shouldNotify: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async filterAppliedFreelancers(matches, projectId) {
    const appliedFreelancerIds = await Application.distinct('freelancer', { project: projectId });
    const appliedSet = new Set(appliedFreelancerIds.map(id => id.toString()));
    return matches.filter(m => !appliedSet.has(m.freelancer._id.toString()));
  }

  async filterAppliedProjects(projects, freelancerId) {
    const appliedProjectIds = await Application.distinct('project', { freelancer: freelancerId });
    const appliedSet = new Set(appliedProjectIds.map(id => id.toString()));
    return projects.filter(p => !appliedSet.has(p._id.toString()));
  }

  buildProjectQuery(freelancer, category = null) {
    const query = { status: 'open' };

    if (category) {
      query.category = category;
    }

    // Rate filtering (lenient)
    if (freelancer.hourlyRate && freelancer.hourlyRate > 0) {
      query.$or = [
        { budgetType: 'fixed' },
        { budgetType: { $ne: 'hourly' } },
        {
          budgetType: 'hourly',
          budgetAmount: { $gte: freelancer.hourlyRate * 0.5 }
        }
      ];
    }

    return query;
  }

  calculateProjectQualityScore(project) {
    const budgetScore = project.budgetAmount ? Math.min(1, project.budgetAmount / 2000) : 0.4;
    const descriptionLengthScore = Math.min(1, (project.description?.length || 0) / 600);
    const skillSpecificity = Math.min(1, (project.skills?.length || 0) / 8);
    const hasDeadline = project.deadline ? 1 : 0.7;

    return (
      budgetScore * 0.25 +
      descriptionLengthScore * 0.35 +
      skillSpecificity * 0.25 +
      hasDeadline * 0.15
    );
  }

  async countQualifiedFreelancers(project) {
    const query = this.matchingEngine.buildCandidateQuery(project, false);
    return await User.countDocuments(query);
  }

  async analyzeSkillAvailability(skills) {
    const analysis = {};
    for (const skill of skills) {
      const count = await User.countDocuments({
        role: 'freelancer',
        skills: { $regex: new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });
      analysis[skill] = {
        availableFreelancers: count,
        scarcity: count < 10 ? 'high' : count < 50 ? 'medium' : 'low'
      };
    }
    return analysis;
  }

  async analyzeBudgetCompetitiveness(project) {
    if (project.budgetType !== 'hourly' || !project.budgetAmount) {
      return { competitive: 'unknown', reason: 'Fixed budget or no amount specified' };
    }

    const similarProjects = await Project.find({
      category: project.category,
      budgetType: 'hourly',
      budgetAmount: { $exists: true }
    }).select('budgetAmount').lean();

    if (similarProjects.length === 0) {
      return { competitive: 'unknown', reason: 'Insufficient data' };
    }

    const rates = similarProjects.map(p => p.budgetAmount).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)];
    const percentile75 = rates[Math.floor(rates.length * 0.75)];

    let competitive = 'average';
    let reason = `Budget is around market median (Rs.${median}/hr)`;

    if (project.budgetAmount >= percentile75) {
      competitive = 'high';
      reason = `Budget is above 75th percentile (Rs.${percentile75}/hr)`;
    } else if (project.budgetAmount < median * 0.8) {
      competitive = 'low';
      reason = `Budget is below market median (Rs.${median}/hr)`;
    }

    return { competitive, reason, marketData: { median, percentile75 } };
  }

  generateImprovementRecommendations(project, analytics) {
    const recommendations = [];

    if (analytics.qualifiedFreelancers < 5) {
      recommendations.push({
        type: 'skills',
        message: 'Consider broadening skill requirements to attract more freelancers',
        priority: 'high'
      });
    }

    if (analytics.applications / Math.max(analytics.qualifiedFreelancers, 1) < 0.1) {
      recommendations.push({
        type: 'budget',
        message: 'Consider increasing budget to be more competitive',
        priority: 'medium'
      });
    }

    if (analytics.skillAnalysis) {
      const scarceSkills = Object.entries(analytics.skillAnalysis)
        .filter(([, data]) => data.scarcity === 'high')
        .map(([skill]) => skill);

      if (scarceSkills.length > 0) {
        recommendations.push({
          type: 'skills',
          message: `Skills in high demand: ${scarceSkills.join(', ')}. Consider offering premium rates.`,
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }

  generateProjectMatchReason(skillScore, rateScore, collaborativeScore, contentScore) {
    const reasons = [];

    if (contentScore > 0.7) reasons.push('Semantic match');
    if (skillScore > 0.8) reasons.push('Perfect skill match');
    else if (skillScore > 0.6) reasons.push('Good skill fit');

    if (rateScore > 0.8) reasons.push('Competitive rate');

    if (collaborativeScore > 0.6) reasons.push('Strong collaboration potential');

    return reasons.length > 0 ? reasons.join(' · ') : 'Potential match';
  }

  trackMatchingAnalytics(projectId, matchResult) {
    console.log(`📊 Matching Analytics — Project: ${projectId}, Matches: ${matchResult.matches.length}, Pipeline: ${matchResult.pipelineInfo?.algorithm || 'hybrid'}`);
  }

  // Cache management
  clearCache() {
    this.cache.clear();
  }

  clearProjectCache(projectId) {
    const keysToDelete = [];
    for (const [key] of this.cache.entries()) {
      if (key.includes(`matches:${projectId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  _round(value) {
    return Math.round(value * 100) / 100;
  }
}

module.exports = new MatchingService();