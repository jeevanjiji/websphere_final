/**
 * Sentiment Analysis Service
 * 
 * AI-powered sentiment analysis for chat messages and reviews
 * Uses Groq (Llama 3.3) for intelligent text analysis
 * 
 * Features:
 * - Real-time sentiment scoring
 * - Tone detection
 * - Keyword extraction
 * - Improvement suggestions
 * - Communication health tracking
 * - Profanity redaction
 */

const Groq = require('groq-sdk');
const mongoose = require('mongoose');

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Profanity redaction map - maps vulgar words to their redacted versions
const PROFANITY_REDACTION_MAP = {
  'fuck': 'f**k',
  'fucking': 'f****ng',
  'fucked': 'f**ked',
  'fucker': 'f****er',
  'fck': 'f**k',
  'fuk': 'f**k',
  'shit': 's**t',
  'shitty': 's**tty',
  'shitting': 's**tting',
  'bitch': 'b*tch',
  'bitchy': 'b*tchy',
  'bitches': 'b*tches',
  'ass': 'a*s',
  'asshole': 'a*sh*le',
  'assholes': 'a*sh*les',
  'dumbass': 'd*mass',
  'bastard': 'b*stard',
  'bastards': 'b*stards',
  'crap': 'c**p',
  'crappy': 'c**ppy',
  'piss': 'p*ss',
  'pissed': 'p*ssed',
  'pissing': 'p*ssing',
  'dick': 'd*ck',
  'dickhead': 'd*ckhead',
  'cunt': 'c*nt',
  'cocksucker': 'c*cksucker',
  'cocksuckers': 'c*cksuckers'
};

// Words that require redaction (used for both detection and replacement)
const PROFANE_WORDS = Object.keys(PROFANITY_REDACTION_MAP);

/**
 * Sentiment categories and their score ranges
 */
const SENTIMENT_RANGES = {
  very_positive: { min: 0.6, max: 1.0 },
  positive: { min: 0.2, max: 0.6 },
  neutral: { min: -0.2, max: 0.2 },
  negative: { min: -0.6, max: -0.2 },
  very_negative: { min: -1.0, max: -0.6 }
};

/**
 * Tone categories for communication analysis
 */
const TONE_INDICATORS = {
  professional: ['please', 'thank you', 'regards', 'appreciate', 'kindly', 'would like', 'let me know'],
  urgent: ['asap', 'urgent', 'immediately', 'emergency', 'critical', 'right away', 'deadline'],
  friendly: ['great', 'awesome', 'excited', 'happy', 'love', 'wonderful', 'fantastic'],
  frustrated: ['disappointed', 'frustrated', 'unacceptable', 'again', 'still waiting', 'multiple times'],
  aggressive: ['must', 'demand', 'unacceptable', 'ridiculous', 'waste', 'horrible', 'terrible', 'fuck', 'shit', 'ass', 'bitch', 'damn', 'stupid', 'idiot', 'go away', 'get out', 'screw you', 'drop dead'],
  confused: ['not sure', 'confused', "don't understand", 'clarify', 'explain', 'help me understand']
};

/**
 * Communication health thresholds
 */
const HEALTH_THRESHOLDS = {
  excellent: { minScore: 0.8, maxNegative: 0.1 },
  good: { minScore: 0.6, maxNegative: 0.2 },
  fair: { minScore: 0.4, maxNegative: 0.3 },
  poor: { minScore: 0.0, maxNegative: 0.5 },
  critical: { minScore: -0.5, maxNegative: 1.0 }
};

class SentimentAnalyzer {
  
  /**
   * Check if text contains profanity
   * @param {string} text - Text to check
   * @returns {boolean} True if profanity detected
   */
  static containsProfanity(text) {
    if (!text || typeof text !== 'string') return false;
    const textLower = text.toLowerCase();
    return PROFANE_WORDS.some(word => textLower.includes(word));
  }
  
  /**
   * Redact profanity from text, replacing vulgar words with asterisks
   * @param {string} text - Text to redact
   * @returns {Object} Object with redacted text and original for comparison
   */
  static redactProfanity(text) {
    if (!text || typeof text !== 'string') {
      return { original: text, redacted: text, wasRedacted: false };
    }
    
    const textLower = text.toLowerCase();
    let redacted = text;
    const foundProfanity = [];
    
    // Sort by length descending to match longer phrases first
    const sortedProfaneWords = [...PROFANE_WORDS].sort((a, b) => b.length - a.length);
    
    for (const word of sortedProfaneWords) {
      // Create regex to match the word (case insensitive, whole word)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(textLower)) {
        foundProfanity.push(word);
        redacted = redacted.replace(regex, PROFANITY_REDACTION_MAP[word]);
      }
    }
    
    return {
      original: text,
      redacted: redacted,
      wasRedacted: foundProfanity.length > 0,
      foundProfanity: foundProfanity
    };
  }
  
  /**
   * Analyze sentiment of a text
   * @param {string} text - Text to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Sentiment analysis result
   */
  static async analyzeSentiment(text, options = {}) {
    const { detailed = true, context = null, redact = true } = options;
    
    try {
      if (!text || typeof text !== 'string') {
        return { success: false, error: 'Invalid text input' };
      }
      
      // Check for profanity and get redaction if needed
      const redactionResult = redact ? this.redactProfanity(text) : null;
      
      // Quick local analysis first (fallback)
      const localAnalysis = this.localSentimentAnalysis(text);
      
      // Check for profanity
      const hasProfanity = this.containsProfanity(text);
      
      // ALWAYS try AI analysis first - it's smarter and we've now instructed it to detect profanity
      if (groq) {
        try {
          const aiAnalysis = await this.aiSentimentAnalysis(text, context);
          if (aiAnalysis.success) {
            // Validate AI result - if it says neutral but we detected profanity, override
            let finalScore = aiAnalysis.score;
            let finalLabel = aiAnalysis.label;
            
            // If profanity detected but AI says neutral/positive, override with negative
            if (hasProfanity && finalScore >= -0.2) {
              finalScore = -0.9;
              finalLabel = 'very_negative';
            }
            
            return {
              success: true,
              sentiment: {
                score: finalScore,
                magnitude: Math.abs(finalScore),
                label: finalLabel,
                confidence: 0.9,
                primaryEmotion: aiAnalysis.primaryEmotion,
                tones: aiAnalysis.tone ? [aiAnalysis.tone] : localAnalysis.tones?.map(t => t.tone) || [],
                keywords: aiAnalysis.keywords || localAnalysis.keywords?.map(k => k.word) || []
              },
              analysisType: 'ai',
              redacted: redactionResult?.wasRedacted ? redactionResult.redacted : null,
              profanityDetected: hasProfanity
            };
          }
        } catch (aiError) {
          console.warn('AI analysis failed, falling back to local:', aiError.message);
        }
      }
      
      // Return local analysis (fallback)
      return {
        success: true,
        sentiment: {
          score: localAnalysis.score,
          magnitude: Math.abs(localAnalysis.score),
          label: this.getSentimentLabel(localAnalysis.score),
          confidence: localAnalysis.confidence === 'high' ? 0.8 : localAnalysis.confidence === 'medium' ? 0.5 : 0.3,
          tones: localAnalysis.tones?.map(t => t.tone) || [],
          keywords: localAnalysis.keywords?.map(k => k.word) || []
        },
        suggestion: this.generateSuggestion(localAnalysis.score, localAnalysis.tones),
        analysisType: 'local',
        redacted: redactionResult?.wasRedacted ? redactionResult.redacted : null,
        profanityDetected: hasProfanity
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Local sentiment analysis using lexicon-based approach
   */
  static localSentimentAnalysis(text) {
    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/);
    
    // Profanity words that get higher negative weight
    const profanityWords = [
      'fuck', 'fucking', 'fucked', 'fucker', 'fck', 'fuk',
      'shit', 'shitty', 'shitting',
      'bitch', 'bitchy', 'bitches',
      'asshole', 'assholes', 'dumbass',
      'bastard', 'bastards',
      'cunt', 'cocksucker', 'cocksuckers',
      'dickhead'
    ];
    
    // Sentiment lexicon (simplified)
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'perfect', 'outstanding', 'brilliant', 'love', 'happy', 'pleased', 'satisfied',
      'thank', 'thanks', 'appreciate', 'helpful', 'professional', 'quality', 'best',
      'recommend', 'impressed', 'exceeded', 'smooth', 'easy', 'efficient', 'reliable'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'horrible', 'awful', 'poor', 'disappointed', 'frustrated',
      'angry', 'annoyed', 'unhappy', 'dissatisfied', 'waste', 'problem', 'issue',
      'delay', 'slow', 'unprofessional', 'unreliable', 'failed', 'mistake', 'error',
      'wrong', 'broken', 'unacceptable', 'regret', 'worst', 'avoid', 'complaint',
      // Profanity and vulgar language
      'fuck', 'fucking', 'fucked', 'fucker', 'fck', 'fuk',
      'shit', 'shitty', 'shitting', 'shut up',
      'damn', 'damned', 'dammit',
      'bitch', 'bitchy', 'bitches',
      'ass', 'asshole', 'assholes', 'dumbass',
      'bastard', 'bastards',
      'crap', 'crappy',
      'piss', 'pissed', 'pissing',
      'dick', 'dickhead',
      'cunt', 'cocksucker', 'cocksuckers',
      // Strong negative words
      'stupid', 'idiot', 'moron', 'dumb', 'pathetic',
      'useless', 'worthless', 'garbage', 'trash',
      'hate', 'despise', 'loathe'
    ];
    
    // Strong negative phrases that should be detected as a unit
    const negativePhrases = [
      'fuck off', 'fuck you', 'go to hell', 'drop dead',
      'screw you', 'screw off', 'shut up', 'get lost', 'get out',
      'hate you', 'hate this', 'hate it', 'waste of time', 'piece of shit',
      'not interested', 'go away', 'leave me alone', 'get lost'
    ];
    
    const intensifiers = ['very', 'really', 'extremely', 'absolutely', 'totally', 'completely', 'so'];
    const negators = ['not', "n't", 'never', 'no', 'none', "don't", "didn't", "doesn't", "won't", "cant", "can't"];
    
    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    const foundKeywords = [];
    
    // First, check for negative phrases (multi-word expressions)
    for (const phrase of negativePhrases) {
      if (textLower.includes(phrase)) {
        score -= 1.5; // Strong negative for phrases
        negativeCount++;
        foundKeywords.push({ word: phrase, sentiment: 'negative', isPhrase: true });
      }
    }
    
    // Analyze individual words
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z]/g, '');
      if (!word) continue;
      
      let wordScore = 0;
      
      if (positiveWords.includes(word)) {
        wordScore = 1;
        positiveCount++;
        foundKeywords.push({ word, sentiment: 'positive' });
      } else if (negativeWords.includes(word)) {
        // Give higher weight to profanity
        if (profanityWords.includes(word)) {
          wordScore = -1.5; // Stronger negative for profanity
        } else {
          wordScore = -1;
        }
        negativeCount++;
        foundKeywords.push({ word, sentiment: 'negative', isProfanity: profanityWords.includes(word) });
      }
      
      // Check for intensifiers
      if (i > 0 && intensifiers.includes(words[i - 1].replace(/[^a-z]/g, ''))) {
        wordScore *= 1.5;
      }
      
      // Check for negators
      if (i > 0 && negators.some(neg => words[i - 1].includes(neg))) {
        wordScore *= -0.5; // Negation flips and reduces intensity
      }
      
      score += wordScore;
    }
    
    // Detect tones to help identify aggressive/rude messages even without explicit negative words
    const tones = this.detectTones(textLower);
    
    // If aggressive tone detected but score is neutral/positive, apply penalty
    const hasAggressiveTone = tones.some(t => t.tone === 'aggressive');
    if (hasAggressiveTone && score >= 0) {
      score -= 0.5;
      negativeCount++;
    }
    
    // Normalize score
    const totalSentimentWords = positiveCount + negativeCount;
    let normalizedScore = totalSentimentWords > 0 
      ? score / (totalSentimentWords * 1.5) 
      : (score !== 0 ? score / 1.5 : 0); // Handle case where only phrases contributed
    
    // Clamp between -1 and 1
    normalizedScore = Math.max(-1, Math.min(1, normalizedScore));
    
    // Calculate confidence
    const confidence = totalSentimentWords >= 3 ? 'high' : totalSentimentWords >= 1 ? 'medium' : (hasAggressiveTone ? 'medium' : 'low');
    
    return {
      score: Math.round(normalizedScore * 100) / 100,
      positiveCount,
      negativeCount,
      keywords: foundKeywords.slice(0, 10),
      tones,
      confidence,
      wordCount: words.length
    };
  }
  
  /**
   * Detect tones in text
   */
  static detectTones(textLower) {
    const detectedTones = [];
    
    for (const [tone, indicators] of Object.entries(TONE_INDICATORS)) {
      const matches = indicators.filter(indicator => textLower.includes(indicator));
      if (matches.length > 0) {
        detectedTones.push({
          tone,
          confidence: matches.length / indicators.length,
          matchedWords: matches
        });
      }
    }
    
    return detectedTones.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * AI-powered sentiment analysis using Groq
   */
  static async aiSentimentAnalysis(text, context = null) {
    if (!groq) {
      return { success: false, error: 'AI not available' };
    }
    
    try {
      const systemPrompt = `You are an expert sentiment analyst for a professional freelancing platform. Analyze the sentiment of messages between clients and freelancers.

IMPORTANT: You must detect ALL forms of profanity, vulgar language, and offensive content as VERY NEGATIVE sentiment. This is critical for maintaining professional communication.

Profanity and vulgar words (fuck, shit, bitch, ass, damn, hell, etc.) should ALWAYS be scored between -0.8 and -1.0 (very_negative). There is NO exception for profanity - it is always inappropriate for professional communication.

Rules:
1. Profanity/vulgar language = very_negative (score: -0.8 to -1.0)
2. Aggressive/hostile tone = negative to very_negative
3. Friendly/professional tone = positive to very_positive
4. Neutral questions = neutral

Provide your analysis as a JSON object with these fields:
{
  "score": <number from -1 to 1>,
  "label": "<very_positive|positive|neutral|negative|very_negative>",
  "primaryEmotion": "<emotion detected>",
  "secondaryEmotions": ["array of other emotions"],
  "keywords": ["key emotional words"],
  "tone": "<professional|friendly|frustrated|urgent|aggressive|confused>",
  "intensity": "<low|medium|high>",
  "suggestion": "<brief suggestion if sentiment is negative, null otherwise>"
}`;

      const userPrompt = context 
        ? `Context: ${context}\n\nMessage to analyze: "${text}"`
        : `Analyze the sentiment of this message. Remember: profanity = very_negative always: "${text}"`;

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const response = completion.choices[0]?.message?.content;
      
      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          ...analysis,
          analysisType: 'ai'
        };
      }
      
      return { success: false, error: 'Failed to parse AI response' };
    } catch (error) {
      console.error('AI sentiment analysis error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get sentiment label from score
   */
  static getSentimentLabel(score) {
    for (const [label, range] of Object.entries(SENTIMENT_RANGES)) {
      if (score >= range.min && score < range.max) {
        return label;
      }
    }
    return 'neutral';
  }
  
  /**
   * Generate improvement suggestion for negative sentiment
   */
  static generateSuggestion(score, tones) {
    if (score >= 0) return null;
    
    const toneNames = tones.map(t => t.tone);
    
    if (toneNames.includes('frustrated')) {
      return 'Consider rephrasing to sound more constructive. Focus on specific issues rather than general complaints.';
    }
    
    if (toneNames.includes('aggressive')) {
      return 'This message may come across as aggressive. Try using softer language and "I" statements.';
    }
    
    if (toneNames.includes('urgent')) {
      return 'While urgency is understandable, consider acknowledging the other party\'s perspective.';
    }
    
    return 'Consider a more positive tone to maintain good professional relationships.';
  }
  
  /**
   * Analyze message and flag if problematic
   */
  static async flagProblematicMessage(text) {
    const analysis = await this.analyzeSentiment(text, { detailed: true });
    
    if (!analysis.success) {
      return { flagged: false, analysis };
    }
    
    const flags = [];
    
    // Check for very negative sentiment
    if (analysis.score < -0.5) {
      flags.push({
        type: 'negative_sentiment',
        severity: 'high',
        message: 'This message has a very negative tone that may harm professional relationships.'
      });
    }
    
    // Check for aggressive tone
    const aggressiveTone = analysis.tones?.find(t => t.tone === 'aggressive');
    if (aggressiveTone && aggressiveTone.confidence > 0.3) {
      flags.push({
        type: 'aggressive_tone',
        severity: 'medium',
        message: 'This message may be perceived as aggressive.'
      });
    }
    
    // Check for professional concern
    const frustratedTone = analysis.tones?.find(t => t.tone === 'frustrated');
    if (frustratedTone && frustratedTone.confidence > 0.4) {
      flags.push({
        type: 'frustration_detected',
        severity: 'low',
        message: 'Frustration detected. Consider addressing underlying issues constructively.'
      });
    }
    
    return {
      flagged: flags.length > 0,
      flags,
      analysis,
      recommendation: flags.length > 0 
        ? 'Consider revising this message before sending.'
        : null
    };
  }
  
  /**
   * Track communication health between two users
   */
  static async trackCommunicationHealth(workspaceId, userId1, userId2) {
    try {
      const Message = mongoose.model('Message');
      const Chat = mongoose.model('Chat');
      
      // Get recent messages in this workspace
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const chats = await Chat.find({
        project: workspaceId,
        participants: { $all: [userId1, userId2] }
      }).lean();
      
      if (chats.length === 0) {
        return {
          healthScore: 1.0,
          status: 'no_data',
          message: 'No communication history found'
        };
      }
      
      const chatIds = chats.map(c => c._id);
      const messages = await Message.find({
        chat: { $in: chatIds },
        createdAt: { $gte: thirtyDaysAgo }
      })
        .populate('sender', 'fullName role')
        .sort({ createdAt: 1 })
        .lean();
      
      if (messages.length === 0) {
        return {
          healthScore: 1.0,
          status: 'no_recent_data',
          message: 'No recent messages'
        };
      }
      
      // Analyze each message
      let totalSentiment = 0;
      let negativeCount = 0;
      let messageCount = 0;
      const sentimentTrend = [];
      
      for (const msg of messages) {
        if (msg.content && typeof msg.content === 'string') {
          const analysis = this.localSentimentAnalysis(msg.content);
          totalSentiment += analysis.score;
          if (analysis.score < -0.2) negativeCount++;
          messageCount++;
          sentimentTrend.push({
            date: msg.createdAt,
            score: analysis.score,
            sender: msg.sender?._id
          });
        }
      }
      
      // Calculate health score
      const avgSentiment = messageCount > 0 ? totalSentiment / messageCount : 0;
      const negativeRatio = messageCount > 0 ? negativeCount / messageCount : 0;
      
      let healthScore = (avgSentiment + 1) / 2; // Convert to 0-1 scale
      healthScore = healthScore * (1 - negativeRatio * 0.5); // Penalize for negative messages
      
      // Determine status
      let status = 'excellent';
      if (healthScore < 0.8) status = 'good';
      if (healthScore < 0.6) status = 'fair';
      if (healthScore < 0.4) status = 'poor';
      if (healthScore < 0.2) status = 'critical';
      
      // Calculate trend (last 7 days vs previous)
      const last7Days = sentimentTrend.filter(s => 
        new Date(s.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      const previousDays = sentimentTrend.filter(s => 
        new Date(s.date) <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      
      const recentAvg = last7Days.length > 0 
        ? last7Days.reduce((a, b) => a + b.score, 0) / last7Days.length 
        : 0;
      const previousAvg = previousDays.length > 0 
        ? previousDays.reduce((a, b) => a + b.score, 0) / previousDays.length 
        : recentAvg;
      
      const trend = recentAvg > previousAvg + 0.1 ? 'improving' 
                  : recentAvg < previousAvg - 0.1 ? 'declining' 
                  : 'stable';
      
      return {
        healthScore: Math.round(healthScore * 100) / 100,
        status,
        metrics: {
          averageSentiment: Math.round(avgSentiment * 100) / 100,
          negativeMessageRatio: Math.round(negativeRatio * 100),
          totalMessages: messageCount
        },
        trend,
        trendDetails: {
          recentAverage: Math.round(recentAvg * 100) / 100,
          previousAverage: Math.round(previousAvg * 100) / 100
        },
        recommendations: this.getHealthRecommendations(healthScore, negativeRatio, trend)
      };
    } catch (error) {
      console.error('Error tracking communication health:', error);
      return {
        healthScore: 0,
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Get recommendations based on communication health
   */
  static getHealthRecommendations(healthScore, negativeRatio, trend) {
    const recommendations = [];
    
    if (healthScore < 0.5) {
      recommendations.push({
        priority: 'high',
        message: 'Communication health is concerning. Consider a video call to address any issues directly.',
        action: 'schedule_call'
      });
    }
    
    if (negativeRatio > 0.3) {
      recommendations.push({
        priority: 'medium',
        message: 'High proportion of negative messages detected. Try to focus on constructive feedback.',
        action: 'improve_tone'
      });
    }
    
    if (trend === 'declining') {
      recommendations.push({
        priority: 'medium',
        message: 'Communication quality is declining. Address any unresolved issues.',
        action: 'address_concerns'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Real-time message analysis middleware
   * Returns analysis that can be attached to messages
   */
  static async analyzeMessageForStorage(text, senderId, recipientId) {
    try {
      const analysis = await this.analyzeSentiment(text, { detailed: false });
      
      if (!analysis.success) {
        return null;
      }
      
      // Only store if sentiment is notably positive or negative
      if (Math.abs(analysis.score) > 0.3) {
        return {
          sentimentScore: analysis.score,
          sentimentLabel: analysis.label,
          detectedTones: analysis.tones?.slice(0, 2).map(t => t.tone) || [],
          flagged: analysis.score < -0.5,
          analyzedAt: new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Message analysis error:', error);
      return null;
    }
  }
  
  /**
   * Batch analyze messages for a workspace
   */
  static async batchAnalyzeWorkspaceMessages(workspaceId, options = {}) {
    const { limit = 100, includeNeutral = false } = options;
    
    try {
      const Message = mongoose.model('Message');
      const Chat = mongoose.model('Chat');
      
      const chats = await Chat.find({ project: workspaceId }).lean();
      const chatIds = chats.map(c => c._id);
      
      const messages = await Message.find({
        chat: { $in: chatIds }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      const results = [];
      
      for (const msg of messages) {
        if (msg.content && typeof msg.content === 'string') {
          const analysis = await this.analyzeSentiment(msg.content);
          
          if (analysis.success && (includeNeutral || Math.abs(analysis.score) > 0.2)) {
            results.push({
              messageId: msg._id,
              sender: msg.sender,
              sentiment: analysis.score,
              label: analysis.label,
              createdAt: msg.createdAt
            });
          }
        }
      }
      
      return {
        success: true,
        analyzed: results.length,
        messages: results,
        summary: {
          averageSentiment: results.length > 0
            ? Math.round(results.reduce((a, b) => a + b.sentiment, 0) / results.length * 100) / 100
            : 0,
          positiveCount: results.filter(r => r.sentiment > 0.2).length,
          negativeCount: results.filter(r => r.sentiment < -0.2).length
        }
      };
    } catch (error) {
      console.error('Batch analysis error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SentimentAnalyzer;