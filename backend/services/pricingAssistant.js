/**
 * Intelligent Pricing Assistant Service
 * 
 * AI-powered budget recommendations using Groq (Llama 3.3)
 * Analyzes similar projects, complexity, deadline, and market factors
 * to suggest optimal pricing for both clients and freelancers
 */

const Groq = require('groq-sdk');
const Project = require('../models/Project');
const User = require('../models/User');
const Milestone = require('../models/Milestone');

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

/**
 * Project complexity factors and their weights
 */
const COMPLEXITY_FACTORS = {
  skills: {
    weights: {
      'react': 1.0,
      'vue': 1.0,
      'angular': 1.1,
      'node.js': 1.1,
      'python': 1.0,
      'django': 1.1,
      'flask': 0.9,
      'mongodb': 0.9,
      'postgresql': 1.0,
      'aws': 1.2,
      'docker': 1.1,
      'kubernetes': 1.3,
      'machine learning': 1.5,
      'ai': 1.5,
      'blockchain': 1.6,
      'mobile': 1.2,
      'flutter': 1.1,
      'react native': 1.1,
      'swift': 1.2,
      'kotlin': 1.2,
      'ui/ux': 0.9,
      'figma': 0.8,
      'data science': 1.4,
      'tensorflow': 1.4,
      'pytorch': 1.4
    }
  },
  categories: {
    baseRates: {
      'ui-ux-design': { min: 500, max: 3000, hourly: 500 },
      'frontend-development': { min: 1000, max: 50000, hourly: 800 },
      'backend-development': { min: 2000, max: 100000, hourly: 1000 },
      'mobile-app-development': { min: 5000, max: 200000, hourly: 1200 },
      'full-stack-development': { min: 5000, max: 150000, hourly: 1200 },
      'data-science': { min: 10000, max: 500000, hourly: 1500 },
      'digital-marketing': { min: 2000, max: 50000, hourly: 600 },
      'graphic-design': { min: 500, max: 20000, hourly: 400 },
      'content-writing': { min: 500, max: 30000, hourly: 300 },
      'other': { min: 1000, max: 50000, hourly: 500 }
    }
  }
};

class PricingAssistant {
  
  /**
   * Get pricing recommendation for a project
   * @param {Object} projectData - Project details
   * @param {string} projectId - Optional existing project ID
   * @returns {Object} Pricing recommendation
   */
  static async getPricingRecommendation(projectData, projectId = null) {
    try {
      // Step 1: Analyze project complexity
      const complexityAnalysis = this.analyzeComplexity(projectData);
      
      // Step 2: Get market data from similar projects
      const marketData = await this.getMarketData(projectData);
      
      // Step 3: Calculate base price range
      const baseRange = this.calculateBaseRange(projectData, complexityAnalysis, marketData);
      
      // Step 4: Apply adjustments
      const adjustments = this.calculateAdjustments(projectData, complexityAnalysis);
      
      // Step 5: Generate AI-powered explanation
      const aiInsight = await this.generateAIInsight(projectData, baseRange, adjustments, marketData);
      
      // Step 6: Calculate final recommendation
      const finalRecommendation = this.applyAdjustments(baseRange, adjustments);
      
      return {
        success: true,
        recommendation: {
          suggestedBudget: finalRecommendation.recommended,
          range: {
            minimum: finalRecommendation.minimum,
            maximum: finalRecommendation.maximum,
            competitive: finalRecommendation.competitive
          },
          hourlyRate: {
            suggested: finalRecommendation.hourly,
            range: {
              min: Math.round(finalRecommendation.hourly * 0.8),
              max: Math.round(finalRecommendation.hourly * 1.3)
            }
          },
          milestoneBreakdown: await this.suggestMilestoneBreakdown(projectData, finalRecommendation),
          complexity: complexityAnalysis,
          marketData: {
            similarProjects: marketData.similarCount,
            averageBudget: marketData.averageBudget,
            medianBudget: marketData.medianBudget
          },
          adjustments: adjustments,
          aiInsight: aiInsight,
          factors: {
            skills: complexityAnalysis.skillFactors,
            deadline: adjustments.deadline,
            category: projectData.category
          }
        }
      };
    } catch (error) {
      console.error('Error generating pricing recommendation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Analyze project complexity based on multiple factors
   */
  static analyzeComplexity(projectData) {
    const { title, description, skills, category, deadline } = projectData;
    
    let complexityScore = 1.0;
    const factors = [];
    
    // Skill-based complexity
    let skillComplexity = 0;
    const skillFactors = [];
    
    if (skills && skills.length > 0) {
      skills.forEach(skill => {
        const skillLower = skill.toLowerCase();
        const weight = COMPLEXITY_FACTORS.skills.weights[skillLower] || 1.0;
        skillComplexity += weight;
        skillFactors.push({
          skill,
          complexity: weight,
          impact: weight > 1.2 ? 'high' : weight > 1 ? 'medium' : 'low'
        });
      });
      skillComplexity = skillComplexity / skills.length;
    }
    
    // Description complexity (length and technical depth)
    const descriptionComplexity = this.analyzeDescriptionComplexity(description || '');
    
    // Deadline urgency
    let deadlineFactor = 1.0;
    if (deadline) {
      const daysUntilDeadline = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 7) {
        deadlineFactor = 1.5; // Rush job
        factors.push({ factor: 'rush_deadline', impact: 1.5, description: 'Urgent deadline (less than 7 days)' });
      } else if (daysUntilDeadline < 14) {
        deadlineFactor = 1.25;
        factors.push({ factor: 'tight_deadline', impact: 1.25, description: 'Tight deadline (less than 2 weeks)' });
      } else if (daysUntilDeadline > 60) {
        deadlineFactor = 0.95; // Long-term project, slight discount
      }
    }
    
    // Category base complexity
    const categoryComplexity = this.getCategoryComplexity(category);
    
    // Calculate overall complexity
    complexityScore = (skillComplexity * 0.4) + (descriptionComplexity * 0.2) + 
                      (categoryComplexity * 0.25) + (deadlineFactor * 0.15);
    
    return {
      score: Math.round(complexityScore * 100) / 100,
      level: complexityScore > 1.3 ? 'high' : complexityScore > 1.1 ? 'medium' : 'low',
      skillComplexity: Math.round(skillComplexity * 100) / 100,
      skillFactors,
      descriptionComplexity,
      deadlineFactor,
      categoryComplexity,
      factors
    };
  }
  
  /**
   * Analyze description for complexity indicators
   */
  static analyzeDescriptionComplexity(description) {
    const complexityKeywords = {
      high: ['ai', 'machine learning', 'blockchain', 'microservices', 'real-time', 'distributed', 
             'encryption', 'authentication', 'api integration', 'cloud', 'scalable', 'enterprise'],
      medium: ['database', 'api', 'frontend', 'backend', 'integration', 'mobile', 'responsive',
               'authentication', 'payment', 'dashboard', 'analytics'],
      low: ['landing page', 'static', 'simple', 'basic', 'minor', 'update', 'fix', 'style']
    };
    
    const descLower = description.toLowerCase();
    let score = 1.0;
    
    complexityKeywords.high.forEach(kw => {
      if (descLower.includes(kw)) score += 0.15;
    });
    
    complexityKeywords.medium.forEach(kw => {
      if (descLower.includes(kw)) score += 0.08;
    });
    
    complexityKeywords.low.forEach(kw => {
      if (descLower.includes(kw)) score -= 0.1;
    });
    
    // Word count factor
    const wordCount = description.split(/\s+/).length;
    if (wordCount > 500) score += 0.1;
    if (wordCount > 1000) score += 0.15;
    
    return Math.max(0.5, Math.min(2.0, score));
  }
  
  /**
   * Get complexity factor for category
   */
  static getCategoryComplexity(category) {
    const complexities = {
      'data-science': 1.5,
      'full-stack-development': 1.35,
      'mobile-app-development': 1.3,
      'backend-development': 1.25,
      'frontend-development': 1.1,
      'ui-ux-design': 1.0,
      'digital-marketing': 0.9,
      'graphic-design': 0.85,
      'content-writing': 0.75,
      'other': 1.0
    };
    return complexities[category] || 1.0;
  }
  
  /**
   * Get market data from similar projects
   */
  static async getMarketData(projectData) {
    try {
      const { category, skills } = projectData;
      
      // Build query for similar projects
      const query = {
        status: { $in: ['completed', 'awarded'] },
        budgetAmount: { $exists: true, $gt: 0 }
      };
      
      if (category) {
        query.category = category;
      }
      
      // Get similar projects
      const similarProjects = await Project.find(query)
        .select('budgetAmount budgetType category skills title')
        .limit(50)
        .lean();
      
      if (similarProjects.length === 0) {
        return {
          similarCount: 0,
          averageBudget: 0,
          medianBudget: 0,
          budgets: []
        };
      }
      
      const budgets = similarProjects
        .map(p => p.budgetAmount)
        .filter(b => b && b > 0)
        .sort((a, b) => a - b);
      
      const averageBudget = budgets.reduce((a, b) => a + b, 0) / budgets.length;
      const medianBudget = budgets[Math.floor(budgets.length / 2)];
      
      return {
        similarCount: similarProjects.length,
        averageBudget: Math.round(averageBudget),
        medianBudget,
        budgets,
        projects: similarProjects
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      return {
        similarCount: 0,
        averageBudget: 0,
        medianBudget: 0,
        budgets: []
      };
    }
  }
  
  /**
   * Calculate base price range
   */
  static calculateBaseRange(projectData, complexity, marketData) {
    const category = projectData.category || 'other';
    const baseRates = COMPLEXITY_FACTORS.categories.baseRates[category] || 
                      COMPLEXITY_FACTORS.categories.baseRates['other'];
    
    // Start with category base rates
    let minimum = baseRates.min;
    let maximum = baseRates.max;
    let hourly = baseRates.hourly;
    
    // Adjust based on complexity
    minimum = Math.round(minimum * complexity.score);
    maximum = Math.round(maximum * complexity.score);
    hourly = Math.round(hourly * complexity.score);
    
    // Adjust based on market data
    if (marketData.similarCount > 0) {
      const marketFactor = 0.3; // Weight for market data
      minimum = Math.round(minimum * (1 - marketFactor) + marketData.medianBudget * marketFactor * 0.8);
      maximum = Math.round(maximum * (1 - marketFactor) + marketData.medianBudget * marketFactor * 1.5);
    }
    
    // Calculate competitive price (middle ground)
    const competitive = Math.round((minimum + maximum) / 2);
    
    return { minimum, maximum, competitive, hourly };
  }
  
  /**
   * Calculate price adjustments
   */
  static calculateAdjustments(projectData, complexity) {
    const adjustments = {
      deadline: { factor: 1.0, reason: '' },
      skills: { factor: 1.0, reason: '' },
      experience: { factor: 1.0, reason: '' }
    };
    
    // Deadline adjustment
    if (projectData.deadline) {
      const days = Math.ceil((new Date(projectData.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 7) {
        adjustments.deadline = {
          factor: 1.25,
          reason: 'Rush delivery premium (+25%)'
        };
      } else if (days < 14) {
        adjustments.deadline = {
          factor: 1.15,
          reason: 'Expedited delivery premium (+15%)'
        };
      } else if (days > 60) {
        adjustments.deadline = {
          factor: 0.95,
          reason: 'Long-term project discount (-5%)'
        };
      }
    }
    
    // Skills premium
    const highValueSkills = ['ai', 'machine learning', 'blockchain', 'kubernetes', 'tensorflow', 'pytorch'];
    const hasHighValueSkills = projectData.skills?.some(s => 
      highValueSkills.includes(s.toLowerCase())
    );
    
    if (hasHighValueSkills) {
      adjustments.skills = {
        factor: 1.2,
        reason: 'Premium skills demand higher rates (+20%)'
      };
    }
    
    return adjustments;
  }
  
  /**
   * Apply adjustments to base range
   */
  static applyAdjustments(baseRange, adjustments) {
    let multiplier = 1.0;
    const reasons = [];
    
    Object.values(adjustments).forEach(adj => {
      if (adj.factor !== 1.0) {
        multiplier *= adj.factor;
        if (adj.reason) reasons.push(adj.reason);
      }
    });
    
    return {
      minimum: Math.round(baseRange.minimum * multiplier),
      maximum: Math.round(baseRange.maximum * multiplier),
      recommended: Math.round(baseRange.competitive * multiplier),
      competitive: Math.round(baseRange.competitive * multiplier),
      hourly: Math.round(baseRange.hourly * multiplier),
      multiplier,
      adjustmentReasons: reasons
    };
  }
  
  /**
   * Generate AI-powered pricing insight
   */
  static async generateAIInsight(projectData, baseRange, adjustments, marketData) {
    if (!groq) {
      return this.generateFallbackInsight(projectData, baseRange, marketData);
    }
    
    try {
      const prompt = `You are an expert freelance pricing consultant. Analyze this project and provide a brief pricing insight.

Project Details:
- Title: ${projectData.title || 'Untitled'}
- Category: ${projectData.category || 'General'}
- Description: ${(projectData.description || '').substring(0, 500)}
- Skills Required: ${(projectData.skills || []).join(', ')}
- Deadline: ${projectData.deadline ? new Date(projectData.deadline).toLocaleDateString() : 'Not specified'}

Market Data:
- Similar Projects: ${marketData.similarCount}
- Average Budget: ₹${marketData.averageBudget || 'N/A'}
- Median Budget: ₹${marketData.medianBudget || 'N/A'}

Recommended Budget Range: ₹${baseRange.minimum} - ₹${baseRange.maximum}
Suggested Competitive Price: ₹${baseRange.competitive}

Provide a concise (3-4 sentences) pricing insight covering:
1. Why this price range is appropriate
2. Key factors affecting the price
3. One tip for the client or freelancer

Keep it professional and helpful. Start directly with the insight.`;

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a professional freelance pricing consultant. Provide concise, actionable insights.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return completion.choices[0]?.message?.content || this.generateFallbackInsight(projectData, baseRange, marketData);
    } catch (error) {
      console.error('Error generating AI insight:', error);
      return this.generateFallbackInsight(projectData, baseRange, marketData);
    }
  }
  
  /**
   * Generate fallback insight when AI is unavailable
   */
  static generateFallbackInsight(projectData, baseRange, marketData) {
    const category = projectData.category || 'project';
    const insights = [];
    
    insights.push(`Based on market analysis of ${marketData.similarCount} similar ${category} projects.`);
    insights.push(`The recommended budget of ₹${baseRange.competitive} reflects current market rates for the required skills.`);
    
    if (projectData.skills?.length > 5) {
      insights.push('Projects requiring multiple skills typically command higher rates due to complexity.');
    }
    
    insights.push('Consider milestone-based payments to manage risk for both parties.');
    
    return insights.join(' ');
  }
  
  /**
   * Suggest milestone breakdown for the project
   */
  static async suggestMilestoneBreakdown(projectData, pricing) {
    const { category, description, deadline } = projectData;
    const totalBudget = pricing.recommended;
    
    // Default milestone templates by category
    const templates = {
      'frontend-development': [
        { name: 'Design & Wireframes', percentage: 20 },
        { name: 'Core Development', percentage: 40 },
        { name: 'Testing & Refinement', percentage: 20 },
        { name: 'Final Delivery', percentage: 20 }
      ],
      'backend-development': [
        { name: 'Architecture & Setup', percentage: 20 },
        { name: 'Core API Development', percentage: 40 },
        { name: 'Integration & Testing', percentage: 25 },
        { name: 'Deployment & Documentation', percentage: 15 }
      ],
      'full-stack-development': [
        { name: 'Planning & Design', percentage: 15 },
        { name: 'Backend Development', percentage: 30 },
        { name: 'Frontend Development', percentage: 30 },
        { name: 'Testing & Integration', percentage: 15 },
        { name: 'Deployment & Handoff', percentage: 10 }
      ],
      'mobile-app-development': [
        { name: 'UI/UX Design', percentage: 20 },
        { name: 'Core Features', percentage: 35 },
        { name: 'Additional Features', percentage: 25 },
        { name: 'Testing & Store Submission', percentage: 20 }
      ],
      'ui-ux-design': [
        { name: 'Research & Wireframes', percentage: 30 },
        { name: 'Visual Design', percentage: 40 },
        { name: 'Prototyping & Handoff', percentage: 30 }
      ],
      'default': [
        { name: 'Initial Phase', percentage: 30 },
        { name: 'Development Phase', percentage: 40 },
        { name: 'Final Delivery', percentage: 30 }
      ]
    };
    
    const template = templates[category] || templates['default'];
    
    // Calculate dates if deadline provided
    const startDate = new Date();
    const endDate = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    return template.map((milestone, index) => {
      const amount = Math.round(totalBudget * (milestone.percentage / 100));
      const milestoneDays = Math.round(totalDays * (milestone.percentage / 100));
      
      return {
        name: milestone.name,
        percentage: milestone.percentage,
        amount: amount,
        suggestedDueDays: milestoneDays,
        order: index + 1
      };
    });
  }
  
  /**
   * Get freelancer-specific pricing suggestion
   */
  static async getFreelancerPricingSuggestion(freelancerId, projectData) {
    try {
      const freelancer = await User.findById(freelancerId);
      
      if (!freelancer || freelancer.role !== 'freelancer') {
        throw new Error('Freelancer not found');
      }
      
      // Get base recommendation
      const baseRecommendation = await this.getPricingRecommendation(projectData);
      
      if (!baseRecommendation.success) {
        return baseRecommendation;
      }
      
      // Adjust based on freelancer profile
      const adjustments = [];
      let multiplier = 1.0;
      
      // Experience level adjustment
      const experienceMultipliers = {
        'beginner': 0.8,
        'intermediate': 1.0,
        'expert': 1.3
      };
      
      const expMultiplier = experienceMultipliers[freelancer.experienceLevel] || 1.0;
      multiplier *= expMultiplier;
      
      if (expMultiplier !== 1.0) {
        adjustments.push({
          factor: expMultiplier,
          reason: `${freelancer.experienceLevel || 'Intermediate'} experience level`
        });
      }
      
      // Rating adjustment
      if (freelancer.rating?.average >= 4.8) {
        multiplier *= 1.1;
        adjustments.push({
          factor: 1.1,
          reason: 'Top-rated freelancer premium (+10%)'
        });
      }
      
      // Apply freelancer-specific adjustments
      const rec = baseRecommendation.recommendation;
      rec.suggestedBudget = Math.round(rec.suggestedBudget * multiplier);
      rec.range.minimum = Math.round(rec.range.minimum * multiplier);
      rec.range.maximum = Math.round(rec.range.maximum * multiplier);
      rec.range.competitive = Math.round(rec.range.competitive * multiplier);
      rec.hourlyRate.suggested = Math.round(rec.hourlyRate.suggested * multiplier);
      
      rec.freelancerAdjustments = adjustments;
      rec.freelancerRate = freelancer.hourlyRate;
      
      // Compare with freelancer's rate
      if (freelancer.hourlyRate) {
        rec.rateComparison = {
          freelancerRate: freelancer.hourlyRate,
          suggestedRate: rec.hourlyRate.suggested,
          difference: rec.hourlyRate.suggested - freelancer.hourlyRate,
          recommendation: freelancer.hourlyRate < rec.hourlyRate.suggested * 0.8
            ? 'Your rate is below market - consider increasing'
            : freelancer.hourlyRate > rec.hourlyRate.suggested * 1.3
            ? 'Your rate is above market - highlight your unique value'
            : 'Your rate is competitive for this project'
        };
      }
      
      return {
        success: true,
        recommendation: rec
      };
    } catch (error) {
      console.error('Error in freelancer pricing suggestion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PricingAssistant;