// backend/services/matchingEngine.js
// Hybrid Recommendation System for Freelancer Marketplaces v3.0
// Based on: "Designing a Hybrid Recommendation System for Freelancer Marketplaces"
// by Jeevan Jiji — Amal Jyothi College of Engineering
//
// Pipeline: Data Preparation → Candidate Generation (Content-Based)
//           → Collaborative Filtering → Re-Ranking (LightGBM-inspired)
//
// v3 fixes: Fine-grained skill vectors, category-to-skill inference,
//           improved cold-start handling, better score differentiation

const User = require('../models/User');
const Project = require('../models/Project');
const Application = require('../models/Application');
const Review = require('../models/Review');
const Workspace = require('../models/Workspace');

/**
 * Hybrid Recommendation Engine v3
 *
 * Implements the four-stage pipeline described in the seminar paper:
 *   Stage 1 – Data Preparation & Feature Engineering
 *   Stage 2 – Candidate Generation via semantic content similarity
 *   Stage 3 – Collaborative Filtering via interaction-matrix factorisation
 *   Stage 4 – Re-Ranking via gradient-boosted scoring (LightGBM-inspired)
 */
class HybridMatchingEngine {
  constructor() {
    // ─── Semantic Skill Taxonomy (Skill2Vec-inspired) ───
    this.skillTaxonomy = {
      'frontend': {
        skills: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'sass', 'less',
                 'tailwind', 'bootstrap', 'webpack', 'vite', 'next.js', 'nuxt', 'svelte', 'gatsby',
                 'jquery', 'redux', 'zustand', 'pinia', 'storybook', 'material-ui', 'chakra-ui',
                 'responsive', 'clean ui', 'web design', 'landing page'],
        semanticWeight: 1.0
      },
      'backend': {
        skills: ['node.js', 'express', 'python', 'django', 'flask', 'fastapi', 'java', 'spring',
                 'php', 'laravel', 'ruby', 'rails', 'golang', 'go', 'rust', '.net', 'c#', 'graphql',
                 'rest', 'microservices', 'nestjs', 'koa', 'hapi', 'deno', 'bun', 'api'],
        semanticWeight: 1.0
      },
      'fullstack': {
        skills: ['full stack', 'full-stack', 'fullstack', 'mern', 'mean', 'lamp', 'web development',
                 'web application', 'website', 'web app', 'ecommerce', 'e-commerce'],
        semanticWeight: 1.0
      },
      'mobile': {
        skills: ['react-native', 'flutter', 'swift', 'kotlin', 'ios', 'android', 'xamarin',
                 'ionic', 'cordova', 'expo', 'swiftui', 'jetpack-compose', 'objective-c',
                 'mobile app', 'mobile development'],
        semanticWeight: 1.0
      },
      'database': {
        skills: ['mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'firebase',
                 'dynamodb', 'cassandra', 'neo4j', 'sqlite', 'couchdb', 'supabase', 'prisma',
                 'sequelize', 'mongoose', 'typeorm', 'knex', 'sql', 'database'],
        semanticWeight: 0.85
      },
      'design': {
        skills: ['ui/ux', 'figma', 'photoshop', 'illustrator', 'sketch', 'adobe-xd', 'canva',
                 'invision', 'zeplin', 'principle', 'framer', 'webflow', 'wireframing',
                 'prototyping', 'user-research', 'interaction-design', 'design', 'graphic design',
                 'ui', 'ux', 'ui design', 'ux design', 'branding', 'logo'],
        semanticWeight: 0.90
      },
      'devops': {
        skills: ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'gitlab-ci',
                 'github-actions', 'terraform', 'ansible', 'ci/cd', 'nginx', 'linux',
                 'prometheus', 'grafana', 'datadog', 'vercel', 'netlify', 'heroku', 'deployment'],
        semanticWeight: 0.80
      },
      'data-science': {
        skills: ['machine-learning', 'deep-learning', 'tensorflow', 'pytorch', 'pandas',
                 'numpy', 'scikit-learn', 'data-analysis', 'nlp', 'computer-vision',
                 'r', 'spark', 'hadoop', 'tableau', 'power-bi', 'jupyter', 'openai', 'ai',
                 'data science', 'analytics'],
        semanticWeight: 0.90
      },
      'blockchain': {
        skills: ['solidity', 'web3', 'ethereum', 'smart-contracts', 'nft', 'defi',
                 'hardhat', 'truffle', 'metamask', 'ipfs', 'blockchain', 'crypto'],
        semanticWeight: 0.75
      },
      'content': {
        skills: ['content writing', 'copywriting', 'blogging', 'seo', 'technical writing',
                 'documentation', 'content', 'writing', 'editing', 'proofreading'],
        semanticWeight: 0.70
      },
      'marketing': {
        skills: ['digital marketing', 'social media', 'google ads', 'facebook ads', 'email marketing',
                 'marketing', 'advertising', 'ppc', 'sem', 'growth hacking'],
        semanticWeight: 0.70
      }
    };

    // Category → implied skills mapping (infer skills from project category)
    this.categorySkillMap = {
      'full-stack-development': ['javascript', 'react', 'node.js', 'mongodb', 'html', 'css', 'full stack', 'web development'],
      'frontend-development': ['javascript', 'react', 'html', 'css', 'responsive', 'web design'],
      'backend-development': ['node.js', 'python', 'api', 'database', 'sql'],
      'mobile-app-development': ['react-native', 'flutter', 'mobile app', 'ios', 'android'],
      'ui-ux-design': ['figma', 'ui/ux', 'design', 'wireframing', 'prototyping'],
      'data-science': ['python', 'machine-learning', 'data-analysis', 'pandas'],
      'digital-marketing': ['seo', 'social media', 'digital marketing', 'google ads'],
      'graphic-design': ['photoshop', 'illustrator', 'design', 'branding', 'logo'],
      'content-writing': ['content writing', 'seo', 'blogging', 'copywriting'],
      'devops': ['docker', 'aws', 'linux', 'ci/cd', 'deployment'],
      'blockchain': ['solidity', 'web3', 'ethereum', 'smart-contracts'],
      'ecommerce': ['react', 'node.js', 'ecommerce', 'web development', 'full stack']
    };

    // Alias map for normalising skill synonyms (Skill2Vec synonym resolution)
    this.skillAliases = new Map([
      ['reactjs', 'react'], ['react.js', 'react'], ['vuejs', 'vue'], ['vue.js', 'vue'],
      ['nodejs', 'node.js'], ['node', 'node.js'], ['js', 'javascript'], ['ts', 'typescript'],
      ['py', 'python'], ['postgres', 'postgresql'], ['psql', 'postgresql'],
      ['mongo', 'mongodb'], ['k8s', 'kubernetes'], ['tf', 'tensorflow'],
      ['nextjs', 'next.js'], ['nuxtjs', 'nuxt'], ['sveltejs', 'svelte'],
      ['c-sharp', 'c#'], ['dotnet', '.net'], ['ux', 'ui/ux'],
      ['aws lambda', 'aws'], ['gcloud', 'gcp'], ['google cloud', 'gcp'],
      ['ml', 'machine-learning'], ['dl', 'deep-learning'], ['cv', 'computer-vision'],
      ['natural language processing', 'nlp'], ['rn', 'react-native'],
      ['ecmascript', 'javascript'], ['es6', 'javascript'],
      ['mern stack', 'full stack'], ['mean stack', 'full stack'],
      ['full stack developer', 'full stack'], ['full-stack developer', 'full stack'],
      ['web developer', 'web development'], ['frontend developer', 'react'],
      ['backend developer', 'node.js'], ['ui designer', 'ui/ux']
    ]);

    // Pre-compute skill→category index for O(1) lookup
    this._skillCategoryIndex = new Map();
    for (const [category, { skills }] of Object.entries(this.skillTaxonomy)) {
      for (const skill of skills) {
        this._skillCategoryIndex.set(skill, category);
      }
    }

    // Build a COMPLETE skill vocabulary for fine-grained vectors
    this._allSkills = [];
    for (const { skills } of Object.values(this.skillTaxonomy)) {
      this._allSkills.push(...skills);
    }
    this._skillIndex = new Map(this._allSkills.map((s, i) => [s, i]));

    // Experience level multipliers (Section III.A – Feature Engineering)
    this.experienceMultipliers = { beginner: 0.75, intermediate: 1.0, expert: 1.25 };

    // Re-ranking weights (Section III.D – LightGBM feature importance inspired)
    this.rerankWeights = {
      contentSimilarity:    0.25,   // sim(q, fi) – Equation (1)
      collaborativeScore:   0.15,   // Matrix factorisation score – Equation (2)
      skillOverlap:         0.25,   // Direct skill matching (high weight b/c most important signal)
      priceFit:             0.10,
      rating:               0.08,
      completionHistory:    0.07,
      portfolioRelevance:   0.05,
      categorySuccess:      0.05
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT — matchFreelancersToProject
  //  Implements the complete 4-stage pipeline (Figure 1 in paper)
  // ═══════════════════════════════════════════════════════════════════════════

  async matchFreelancersToProject(projectId, options = {}) {
    const {
      limit = 20,
      minScore = 0.15,
      includeApplied = false,
      diversityBoost = true,
      topK = 50
    } = options;

    const pipelineStart = Date.now();

    try {
      const project = await Project.findById(projectId).lean();
      if (!project) throw new Error('Project not found');

      // ── Stage 1: Data Preparation ──
      // Infer skills from category if project has no explicit skills
      const enrichedProject = this._enrichProjectSkills(project);
      const projectEmbedding = this._createProjectEmbedding(enrichedProject);
      const candidateQuery = this._buildCandidateQuery(enrichedProject, includeApplied);
      const candidates = await User.find(candidateQuery).lean();

      if (candidates.length === 0) {
        return {
          matches: [],
          totalCandidates: 0,
          searchMeta: this._getSearchMeta(project),
          pipelineInfo: this._pipelineInfo(pipelineStart, 0, 'no_candidates')
        };
      }

      // ── Stage 2: Candidate Generation (Content-Based Similarity) ──
      const contentScores = candidates.map(freelancer => {
        const freelancerEmbedding = this._createFreelancerEmbedding(freelancer);
        const similarity = this._cosineSimilarity(projectEmbedding, freelancerEmbedding);
        return { freelancer, contentScore: similarity };
      });

      contentScores.sort((a, b) => b.contentScore - a.contentScore);
      const topKCandidates = contentScores.slice(0, topK);

      // ── Stage 3: Collaborative Filtering ──
      const collaborativeSignals = await this._buildCollaborativeSignals(
        enrichedProject,
        topKCandidates.map(c => c.freelancer)
      );

      // ── Stage 4: Re-Ranking ──
      let rankedMatches = topKCandidates.map(({ freelancer, contentScore }) => {
        const cfSignal = collaborativeSignals.get(freelancer._id.toString());
        return this._rerank(freelancer, enrichedProject, contentScore, cfSignal);
      });

      rankedMatches = rankedMatches
        .filter(m => m.totalScore >= minScore)
        .sort((a, b) => b.totalScore - a.totalScore);

      if (diversityBoost) {
        rankedMatches = this._applyDiversityBoost(rankedMatches);
      }

      return {
        matches: rankedMatches.slice(0, limit),
        totalCandidates: candidates.length,
        searchMeta: this._getSearchMeta(project),
        matchingStrategy: 'hybrid_content_collaborative_rerank_v3',
        pipelineInfo: this._pipelineInfo(pipelineStart, rankedMatches.length, 'complete')
      };

    } catch (error) {
      console.error('HybridMatchingEngine Error:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SKILL ENRICHMENT — Infer skills from category + description
  //  Fixes the problem where projects have empty skills arrays
  // ═══════════════════════════════════════════════════════════════════════════

  _enrichProjectSkills(project) {
    const enriched = { ...project };
    const existingSkills = [...(project.skills || [])];

    // Infer from category
    if (project.category && this.categorySkillMap[project.category]) {
      const categorySkills = this.categorySkillMap[project.category];
      categorySkills.forEach(s => {
        if (!existingSkills.some(es => es.toLowerCase() === s.toLowerCase())) {
          existingSkills.push(s);
        }
      });
    }

    // Infer from title and description
    const text = `${project.title || ''} ${project.description || ''}`.toLowerCase();
    for (const [, { skills }] of Object.entries(this.skillTaxonomy)) {
      for (const skill of skills) {
        if (text.includes(skill) && !existingSkills.some(es => es.toLowerCase() === skill)) {
          existingSkills.push(skill);
        }
      }
    }

    enriched.skills = existingSkills;
    enriched._enriched = true;
    return enriched;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STAGE 1 — DATA PREPARATION & FEATURE ENGINEERING  (Section III.A)
  //  Uses FINE-GRAINED skill vectors (individual skills, not just categories)
  // ═══════════════════════════════════════════════════════════════════════════

  _createProjectEmbedding(project) {
    const skills = this._normalizeSkills(project.skills || []);
    const vector = this._skillsToFineVector(skills);

    // Augment with text features
    const textKeywords = this._extractKeywords(`${project.title || ''} ${project.description || ''}`);
    const textVector = this._skillsToFineVector(textKeywords);

    return this._blendVectors(vector, textVector, 0.75);
  }

  _createFreelancerEmbedding(freelancer) {
    const skills = this._normalizeSkills(freelancer.skills || []);
    const vector = this._skillsToFineVector(skills);

    // Augment with portfolio technologies
    const portfolioSkills = (freelancer.portfolio || [])
      .flatMap(item => this._normalizeSkills(item.technologies || []));
    const portfolioVector = this._skillsToFineVector(portfolioSkills);

    // Augment with bio keywords
    const bioKeywords = this._extractKeywords(freelancer.bio || '');
    const bioVector = this._skillsToFineVector(bioKeywords);

    // Blend: 65% skills, 20% portfolio, 15% bio
    const blended = this._blendVectors(vector, portfolioVector, 0.75);
    return this._blendVectors(blended, bioVector, 0.85);
  }

  /**
   * FINE-GRAINED skill vector — each individual skill is its own dimension
   * (instead of collapsing everything into just 8 category dimensions).
   * This produces far more discriminative vectors.
   */
  _skillsToFineVector(skills) {
    const vector = {};

    for (const skill of skills) {
      // Exact match in vocabulary
      if (this._skillIndex.has(skill)) {
        vector[skill] = (vector[skill] || 0) + 1.0;
        // Also boost the category dimension
        const cat = this._skillCategoryIndex.get(skill);
        if (cat) {
          vector[`_cat_${cat}`] = (vector[`_cat_${cat}`] || 0) + 0.3;
        }
      } else {
        // Fuzzy match: check if skill is contained in or contains any vocab entry
        let matched = false;
        for (const vocabSkill of this._allSkills) {
          if (skill.includes(vocabSkill) || vocabSkill.includes(skill)) {
            vector[vocabSkill] = (vector[vocabSkill] || 0) + 0.7;
            matched = true;
          }
        }
        // If absolutely no match, create raw dimension
        if (!matched) {
          vector[`_raw_${skill}`] = 1.0;
        }
      }
    }

    return vector;
  }

  _blendVectors(v1, v2, alpha) {
    const result = {};
    const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    for (const key of keys) {
      result[key] = ((v1[key] || 0) * alpha) + ((v2[key] || 0) * (1 - alpha));
    }
    return result;
  }

  _buildCandidateQuery(project, includeApplied = false) {
    const query = {
      role: 'freelancer',
      profileComplete: true,
      isActive: { $ne: false },
      isDeleted: { $ne: true },
      'profile.isAvailable': { $ne: false }
    };

    if (project.skills && project.skills.length > 0) {
      const skillRegexes = project.skills.map(s =>
        new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
      // Use $or to also match by category-inferred skills — broader net
      query.$or = [
        { skills: { $in: skillRegexes } }
      ];
    }

    if (project.budgetType === 'hourly' && project.budgetAmount) {
      query.hourlyRate = { $lte: project.budgetAmount * 2 };
    }

    return query;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STAGE 2 — CANDIDATE GENERATION via Cosine Similarity (Section III.B)
  // ═══════════════════════════════════════════════════════════════════════════

  _cosineSimilarity(vectorA, vectorB) {
    const keys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of keys) {
      const a = vectorA[key] || 0;
      const b = vectorB[key] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STAGE 3 — COLLABORATIVE FILTERING (Section III.C)
  // ═══════════════════════════════════════════════════════════════════════════

  async _buildCollaborativeSignals(project, candidates) {
    const candidateIds = candidates.map(c => c._id);
    if (candidateIds.length === 0) return new Map();

    const [positiveInteractions, applicationTotals, reviewStats, workspaceStats] = await Promise.all([
      Application.aggregate([
        {
          $match: {
            freelancer: { $in: candidateIds },
            status: { $in: ['accepted', 'awarded'] }
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectDoc'
          }
        },
        { $unwind: '$projectDoc' },
        {
          $group: {
            _id: '$freelancer',
            positiveTotal: { $sum: 1 },
            sameCategoryPositive: {
              $sum: {
                $cond: [{ $eq: ['$projectDoc.category', project.category] }, 1, 0]
              }
            },
            sameClientPositive: {
              $sum: {
                $cond: [{ $eq: ['$client', project.client] }, 1, 0]
              }
            },
            avgProposedRate: { $avg: '$proposedRate' }
          }
        }
      ]),

      Application.aggregate([
        { $match: { freelancer: { $in: candidateIds } } },
        {
          $group: {
            _id: '$freelancer',
            totalApplications: { $sum: 1 },
            rejectedApplications: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            }
          }
        }
      ]),

      Review.aggregate([
        {
          $match: {
            reviewee: { $in: candidateIds },
            status: 'published'
          }
        },
        {
          $group: {
            _id: '$reviewee',
            avgOverall: { $avg: '$ratings.overall' },
            avgQuality: { $avg: '$ratings.quality' },
            avgTimeliness: { $avg: '$ratings.timeliness' },
            avgCommunication: { $avg: '$ratings.communication' },
            avgExpertise: { $avg: '$ratings.expertise' },
            reviewCount: { $sum: 1 },
            recommendRate: { $avg: { $cond: ['$wouldRecommend', 1, 0] } }
          }
        }
      ]).catch(() => []),

      Workspace.aggregate([
        {
          $match: {
            freelancer: { $in: candidateIds },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$freelancer',
            completedWorkspaces: { $sum: 1 },
            avgProgress: { $avg: '$stats.completedMilestones' }
          }
        }
      ]).catch(() => [])
    ]);

    const totalsMap = new Map(applicationTotals.map(r => [r._id.toString(), r]));
    const reviewMap = new Map(reviewStats.map(r => [r._id.toString(), r]));
    const workspaceMap = new Map(workspaceStats.map(r => [r._id.toString(), r]));

    const signals = new Map();

    positiveInteractions.forEach(row => {
      const id = row._id.toString();
      const totals = totalsMap.get(id) || { totalApplications: row.positiveTotal, rejectedApplications: 0 };
      const reviews = reviewMap.get(id) || null;
      const workspace = workspaceMap.get(id) || null;

      signals.set(id, {
        positiveTotal: row.positiveTotal,
        sameCategoryPositive: row.sameCategoryPositive,
        sameClientPositive: row.sameClientPositive,
        totalApplications: totals.totalApplications,
        rejectedApplications: totals.rejectedApplications,
        avgProposedRate: row.avgProposedRate,
        reviews,
        completedWorkspaces: workspace?.completedWorkspaces || 0
      });
    });

    candidates.forEach(c => {
      const id = c._id.toString();
      if (!signals.has(id)) {
        const totals = totalsMap.get(id) || { totalApplications: 0, rejectedApplications: 0 };
        const reviews = reviewMap.get(id) || null;

        signals.set(id, {
          positiveTotal: 0,
          sameCategoryPositive: 0,
          sameClientPositive: 0,
          totalApplications: totals.totalApplications,
          rejectedApplications: totals.rejectedApplications,
          avgProposedRate: null,
          reviews,
          completedWorkspaces: 0
        });
      }
    });

    return signals;
  }

  _computeCollaborativeScore(freelancer, project, signal) {
    if (!signal) {
      return this._coldStartFallback(freelancer);
    }

    const { positiveTotal, sameCategoryPositive, sameClientPositive,
            totalApplications, rejectedApplications, reviews, completedWorkspaces } = signal;

    if (totalApplications === 0) {
      return this._coldStartFallback(freelancer);
    }

    const clientAffinity = Math.min(1, sameClientPositive * 0.6);
    const categoryAffinity = Math.min(1, sameCategoryPositive * 0.4);
    const acceptanceRate = positiveTotal / Math.max(1, totalApplications);
    const reliability = Math.min(1, acceptanceRate * 1.3);
    const rejectionRate = rejectedApplications / Math.max(1, totalApplications);
    const rejectionPenalty = Math.max(0, 1 - (rejectionRate * 0.8));

    let reviewBoost = 0.5; // Neutral default
    if (reviews) {
      const qualityAvg = reviews.avgQuality || reviews.avgOverall || 3;
      const timelinessAvg = reviews.avgTimeliness || reviews.avgOverall || 3;
      const commAvg = reviews.avgCommunication || reviews.avgOverall || 3;
      reviewBoost = ((qualityAvg / 5) * 0.4 + (timelinessAvg / 5) * 0.3 + (commAvg / 5) * 0.2 + (reviews.recommendRate || 0.5) * 0.1);
    }

    const completionBoost = Math.min(1, completedWorkspaces * 0.25);

    const score = (
      clientAffinity * 0.20 +
      categoryAffinity * 0.20 +
      reliability * 0.20 +
      rejectionPenalty * 0.10 +
      reviewBoost * 0.20 +
      completionBoost * 0.10
    );

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Cold start fallback — for freelancers with no interaction history.
   * Returns a generous baseline score (0.35-0.85) to avoid penalizing new users.
   */
  _coldStartFallback(freelancer) {
    const ratingScore = freelancer.rating?.average > 0
      ? Math.min(1, freelancer.rating.average / 5)
      : 0.5; // Neutral, don't penalize for no rating

    const completionScore = Math.min(1, (freelancer.completedProjects || 0) / 5);
    const profileCompleteness = freelancer.profileComplete ? 0.8 : 0.4;
    const portfolioScore = (freelancer.portfolio?.length || 0) > 0
      ? Math.min(1, 0.5 + (freelancer.portfolio.length * 0.15))
      : 0.3;
    const skillRichness = Math.min(1, (freelancer.skills?.length || 0) / 6);

    const base = (
      ratingScore * 0.25 +
      completionScore * 0.15 +
      profileCompleteness * 0.20 +
      portfolioScore * 0.20 +
      skillRichness * 0.20
    );

    // Ensure cold start score is at minimum 0.3 (don't crush new freelancers)
    return Math.max(0.3, base);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  STAGE 4 — RE-RANKING (Section III.D)
  // ═══════════════════════════════════════════════════════════════════════════

  _rerank(freelancer, project, contentScore, cfSignal) {
    const collaborativeScore = this._computeCollaborativeScore(freelancer, project, cfSignal);
    const ratingFeature = this._ratingFeature(freelancer);
    const completionFeature = this._completionFeature(freelancer, cfSignal);
    const skillOverlap = this._skillOverlapFeature(freelancer, project);
    const priceFit = this._priceFitFeature(freelancer, project);
    const categorySuccess = this._categorySuccessFeature(cfSignal);
    const portfolioRelevance = this._portfolioRelevanceFeature(freelancer, project);

    const w = this.rerankWeights;
    const totalScore = (
      contentScore       * w.contentSimilarity +
      collaborativeScore * w.collaborativeScore +
      skillOverlap       * w.skillOverlap +
      priceFit           * w.priceFit +
      ratingFeature      * w.rating +
      completionFeature  * w.completionHistory +
      portfolioRelevance * w.portfolioRelevance +
      categorySuccess    * w.categorySuccess
    );

    const tier = totalScore >= 0.70 ? 'excellent'
               : totalScore >= 0.50 ? 'strong'
               : totalScore >= 0.35 ? 'good'
               : 'fair';

    const matchReason = this._generateMatchExplanation(
      contentScore, collaborativeScore, ratingFeature, skillOverlap, priceFit, portfolioRelevance
    );

    return {
      freelancer: {
        _id: freelancer._id,
        fullName: freelancer.fullName,
        email: freelancer.email,
        profilePicture: freelancer.profilePicture,
        bio: freelancer.bio,
        skills: freelancer.skills,
        hourlyRate: freelancer.hourlyRate,
        experienceLevel: freelancer.experienceLevel,
        rating: freelancer.rating || { average: 0, count: 0 },
        completedProjects: freelancer.completedProjects || 0,
        portfolio: freelancer.portfolio || [],
        location: freelancer.location
      },
      scores: {
        total: this._round(totalScore),
        content: this._round(contentScore),
        collaborative: this._round(collaborativeScore),
        quality: this._round(ratingFeature),
        skill: this._round(skillOverlap),
        experience: this._round(this._experienceFeature(freelancer, project)),
        rate: this._round(priceFit),
        portfolio: this._round(portfolioRelevance),
        availability: this._round(this._availabilityFeature(freelancer)),
        categorySuccess: this._round(categorySuccess),
        completion: this._round(completionFeature)
      },
      totalScore,
      matchTier: tier,
      matchReason,
      pipelineStages: {
        contentBased: this._round(contentScore),
        collaborativeFiltering: this._round(collaborativeScore),
        reranked: this._round(totalScore)
      }
    };
  }

  // ─── Feature extractors ───────────────────────────────────────────────

  _ratingFeature(freelancer) {
    const avg = freelancer.rating?.average || 0;
    const count = freelancer.rating?.count || 0;

    if (count === 0 && avg === 0) return 0.5; // Neutral for no ratings

    const globalMean = 3.5;
    const minReviews = 3;
    const bayesianAvg = ((minReviews * globalMean) + (count * avg)) / (minReviews + count);
    return Math.min(1, bayesianAvg / 5);
  }

  _completionFeature(freelancer, cfSignal) {
    const completed = freelancer.completedProjects || 0;
    const workspaceCompleted = cfSignal?.completedWorkspaces || 0;
    const totalCompleted = Math.max(completed, workspaceCompleted);
    if (totalCompleted === 0) return 0.3; // Don't penalize heavily
    return Math.min(1, 0.3 + (totalCompleted / 10));
  }

  _skillOverlapFeature(freelancer, project) {
    const projectSkills = this._normalizeSkills(project.skills || []);
    const freelancerSkills = this._normalizeSkills(freelancer.skills || []);

    if (projectSkills.length === 0) return 0.5;
    if (freelancerSkills.length === 0) return 0.1;

    let totalSimilarity = 0;
    let matchedCount = 0;

    for (const ps of projectSkills) {
      let bestMatch = 0;
      for (const fs of freelancerSkills) {
        const sim = this._semanticSkillSimilarity(ps, fs);
        bestMatch = Math.max(bestMatch, sim);
      }
      totalSimilarity += bestMatch;
      if (bestMatch > 0.3) matchedCount++;
    }

    const coverage = matchedCount / projectSkills.length;
    const avgQuality = totalSimilarity / projectSkills.length;

    // Coverage is king — matching more required skills matters most
    return Math.min(1.0, (coverage * 0.5) + (avgQuality * 0.5));
  }

  _priceFitFeature(freelancer, project) {
    if (!freelancer.hourlyRate && !project.budgetAmount) return 0.6;
    if (!freelancer.hourlyRate || !project.budgetAmount) return 0.5;

    let targetRate = project.budgetAmount;
    if (project.budgetType === 'fixed') {
      const estimatedHours = this._estimateProjectHours(project);
      targetRate = project.budgetAmount / estimatedHours;
    }

    if (targetRate <= 0) return 0.5;

    const ratio = freelancer.hourlyRate / targetRate;
    // Smooth bell curve centred at 1.0
    if (ratio >= 0.6 && ratio <= 1.0) return 1.0;  // Under budget = great
    if (ratio >= 1.0 && ratio <= 1.3) return 0.85;  // Slightly over = fine
    if (ratio >= 0.4 && ratio <= 1.5) return 0.6;
    if (ratio >= 0.2 && ratio <= 2.0) return 0.4;
    return 0.2;
  }

  _categorySuccessFeature(cfSignal) {
    if (!cfSignal) return 0.3;
    const count = cfSignal.sameCategoryPositive || 0;
    if (count === 0) return 0.3;
    return Math.min(1, 0.4 + (count * 0.2));
  }

  _portfolioRelevanceFeature(freelancer, project) {
    const portfolio = freelancer.portfolio || [];
    if (portfolio.length === 0) return 0.25;

    const projectKeywords = this._extractKeywords(`${project.title} ${project.description}`);
    const projectSkills = this._normalizeSkills(project.skills || []);

    let maxRelevance = 0.25;
    for (const item of portfolio) {
      let relevance = 0;
      const itemKeywords = this._extractKeywords(`${item.title} ${item.description}`);
      const itemTech = this._normalizeSkills(item.technologies || []);

      // Keyword overlap
      const commonKeywords = projectKeywords.filter(kw =>
        itemKeywords.some(ik => ik.includes(kw) || kw.includes(ik))
      );
      if (projectKeywords.length > 0) {
        relevance = Math.min(1, 0.3 + (commonKeywords.length / projectKeywords.length));
      }

      // Technology overlap
      if (itemTech.length > 0 && projectSkills.length > 0) {
        let techMatches = 0;
        for (const t of itemTech) {
          for (const ps of projectSkills) {
            if (this._semanticSkillSimilarity(t, ps) > 0.5) { techMatches++; break; }
          }
        }
        const techScore = Math.min(1, techMatches / Math.min(itemTech.length, projectSkills.length));
        relevance = Math.max(relevance, 0.3 + techScore * 0.7);
      }

      maxRelevance = Math.max(maxRelevance, relevance);
    }

    return maxRelevance;
  }

  _experienceFeature(freelancer, project) {
    if (!freelancer.experienceLevel) return 0.5;
    const multiplier = this.experienceMultipliers[freelancer.experienceLevel] || 1.0;
    return Math.min(1.0, multiplier / 1.25);
  }

  _availabilityFeature(freelancer) {
    const availability = freelancer.profile?.availability || 'available';
    const scores = { 'available': 1.0, 'partially-available': 0.7, 'busy': 0.3, 'unavailable': 0.0 };
    return scores[availability] || 0.8;
  }

  // ─── Semantic Skill Similarity ────────────────────────────────────────

  _semanticSkillSimilarity(skill1, skill2) {
    const s1 = this.skillAliases.get(skill1) || skill1;
    const s2 = this.skillAliases.get(skill2) || skill2;

    if (s1 === s2) return 1.0;

    // Substring containment (e.g. "react" in "react-native")
    if (s1.includes(s2) || s2.includes(s1)) return 0.75;

    // Same-category match with weighted similarity
    const cat1 = this._skillCategoryIndex.get(s1);
    const cat2 = this._skillCategoryIndex.get(s2);
    if (cat1 && cat2 && cat1 === cat2) {
      return 0.6 * (this.skillTaxonomy[cat1]?.semanticWeight || 1.0);
    }

    // Cross-reference: related categories
    const relatedCategories = {
      'frontend': ['fullstack', 'design'],
      'backend': ['fullstack', 'database', 'devops'],
      'fullstack': ['frontend', 'backend', 'database'],
      'mobile': ['frontend'],
      'database': ['backend', 'fullstack'],
      'design': ['frontend'],
      'devops': ['backend']
    };

    if (cat1 && cat2 && relatedCategories[cat1]?.includes(cat2)) {
      return 0.35;
    }

    return 0.0;
  }

  // ─── Match Explanation ────────────────────────────────────────────────

  _generateMatchExplanation(content, collaborative, rating, skill, price, portfolio) {
    const reasons = [];

    if (skill > 0.8) reasons.push('Excellent skill match');
    else if (skill > 0.6) reasons.push('Strong skill alignment');
    else if (skill > 0.4) reasons.push('Good skill coverage');

    if (content > 0.7) reasons.push('High semantic similarity');
    else if (content > 0.4) reasons.push('Relevant profile');

    if (collaborative > 0.7) reasons.push('Proven track record');
    else if (collaborative > 0.5) reasons.push('Solid platform history');

    if (rating > 0.8) reasons.push('Highly rated');

    if (price > 0.8) reasons.push('Competitive pricing');

    if (portfolio > 0.6) reasons.push('Relevant portfolio');

    return reasons.length > 0 ? reasons.join(' · ') : 'Potential match';
  }

  // ─── Diversity Boost ──────────────────────────────────────────────────

  _applyDiversityBoost(rankedCandidates) {
    const seen = new Map();

    return rankedCandidates.map(candidate => {
      const primarySkill = candidate.freelancer.skills?.[0] || 'general';
      const rateRange = candidate.freelancer.hourlyRate
        ? Math.floor(candidate.freelancer.hourlyRate / 500) * 500
        : 0;
      const signature = `${primarySkill}-${candidate.freelancer.experienceLevel}-${rateRange}`;

      const count = seen.get(signature) || 0;
      seen.set(signature, count + 1);

      if (count > 0) {
        const penalty = Math.pow(0.95, count);
        candidate.totalScore *= penalty;
        candidate.scores.total = this._round(candidate.totalScore);
      }

      return candidate;
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  _normalizeSkills(skills) {
    return skills
      .map(s => s.toLowerCase().trim())
      .filter(Boolean)
      .map(s => this.skillAliases.get(s) || s);
  }

  _extractKeywords(text) {
    if (!text) return [];
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their', 'i', 'my',
      'me', 'he', 'she', 'him', 'her', 'not', 'no', 'so', 'if', 'as', 'up',
      'out', 'about', 'what', 'which', 'who', 'when', 'where', 'how', 'all',
      'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any', 'need',
      'looking', 'want', 'like', 'also', 'well', 'just', 'than', 'very',
      'able', 'work', 'working', 'using', 'used', 'project', 'must', 'please',
      'build', 'create', 'make', 'new', 'good'
    ]);

    return text
      .toLowerCase()
      .split(/[\W_]+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 20);
  }

  _estimateProjectHours(project) {
    const baseHours = {
      'ui-ux-design': 40, 'frontend-development': 80, 'backend-development': 120,
      'full-stack-development': 200, 'mobile-app-development': 160, 'data-science': 100,
      'digital-marketing': 60, 'graphic-design': 50, 'content-writing': 30
    };
    const base = baseHours[project.category] || 80;
    return Math.round(base * (0.5 + this._estimateComplexity(project)));
  }

  _estimateComplexity(project) {
    let complexity = 0.5;
    if ((project.description || '').length > 1000) complexity += 0.2;
    if (project.skills && project.skills.length > 5) complexity += 0.2;
    if (project.budgetAmount > 5000) complexity += 0.2;
    return Math.min(1.0, complexity);
  }

  _round(value) {
    return Math.round(value * 100) / 100;
  }

  _getSearchMeta(project) {
    return {
      projectId: project._id,
      category: project.category,
      skillsRequired: project.skills?.length || 0,
      budgetType: project.budgetType,
      timestamp: new Date().toISOString()
    };
  }

  _pipelineInfo(startTime, matchCount, status) {
    return {
      executionTimeMs: Date.now() - startTime,
      matchCount,
      status,
      stages: ['data_preparation', 'candidate_generation', 'collaborative_filtering', 're_ranking'],
      algorithm: 'hybrid_content_cf_rerank',
      version: '3.0.0'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BACKWARD-COMPATIBLE API
  // ═══════════════════════════════════════════════════════════════════════════

  buildCandidateQuery(project, includeApplied = false) {
    return this._buildCandidateQuery(this._enrichProjectSkills(project), includeApplied);
  }

  createProjectVector(project) {
    return this._createProjectEmbedding(this._enrichProjectSkills(project));
  }

  createFreelancerVector(freelancer) {
    return this._createFreelancerEmbedding(freelancer);
  }

  enrichProjectSkills(project) {
    return this._enrichProjectSkills(project);
  }

  calculateSkillSimilarity(projectSkills, freelancerSkills) {
    const normalizedProject = Array.isArray(projectSkills) ? projectSkills : [];
    const normalizedFreelancer = Array.isArray(freelancerSkills) ? freelancerSkills : [];
    if (normalizedProject.length === 0 || normalizedFreelancer.length === 0) return 0.5;

    const pVec = this._skillsToFineVector(this._normalizeSkills(normalizedProject));
    const fVec = this._skillsToFineVector(this._normalizeSkills(normalizedFreelancer));
    return this._cosineSimilarity(pVec, fVec);
  }

  calculateRateCompatibility(freelancerRate, project) {
    return this._priceFitFeature({ hourlyRate: freelancerRate }, project);
  }

  calculatePortfolioRelevance(portfolio, project) {
    return this._portfolioRelevanceFeature({ portfolio: portfolio || [] }, project);
  }

  calculateExperienceScore(freelancerLevel, projectCategory) {
    return this._experienceFeature(
      { experienceLevel: freelancerLevel },
      { category: projectCategory }
    );
  }
}

module.exports = new HybridMatchingEngine();