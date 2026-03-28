// Frontend component for displaying matching results
// frontend/src/components/matching/MatchingResults.jsx
// Updated for Hybrid Recommendation Pipeline (4-stage)

import React, { useState, useEffect } from 'react';
import { 
  UserIcon, 
  StarIcon, 
  ClockIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  SparklesIcon,
  CheckBadgeIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

const MatchingResults = ({ projectId, onFreelancerSelect }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [pipelineInfo, setPipelineInfo] = useState(null);
  const [filters, setFilters] = useState({
    minScore: 0.3,
    experienceLevel: 'all',
    maxRate: null
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'

  useEffect(() => {
    fetchMatches();
    fetchAnalytics();
  }, [projectId, filters]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        minScore: filters.minScore,
        limit: 20
      });

      const response = await fetch(`http://localhost:5000/api/matching/freelancers/${projectId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.data.matches || []);
        setPipelineInfo(data.data.pipelineInfo || null);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/matching/analytics/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const getTierStyles = (tier) => {
    const styles = {
      excellent: { bg: 'bg-gradient-to-r from-[#1DBF73] to-[#00B22D]', text: 'text-white', badge: '🏆', label: 'Excellent Match' },
      strong:    { bg: 'bg-gradient-to-r from-[#1DBF73] to-teal-600', text: 'text-white', badge: '⭐', label: 'Strong Match' },
      good:      { bg: 'bg-gradient-to-r from-[#62646A] to-[#404145]', text: 'text-white', badge: '👍', label: 'Good Match' },
      fair:      { bg: 'bg-gradient-to-r from-[#B5B6BA] to-[#62646A]', text: 'text-white', badge: '🔍', label: 'Fair Match' }
    };
    return styles[tier] || styles.fair;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#1DBF73]"></div>
          <SparklesIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-[#1DBF73]" />
        </div>
        <div className="mt-4 text-center">
          <p className="text-gray-700 font-medium">Running Hybrid Recommendation Pipeline</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="animate-pulse">●</span> Content Matching
            <span>→</span>
            <span className="animate-pulse delay-100">●</span> Collaborative Filtering
            <span>→</span>
            <span className="animate-pulse delay-200">●</span> Re-Ranking
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header with Pipeline Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <SparklesIcon className="h-6 w-6 text-[#1DBF73] mr-2" />
            Hybrid AI Matching Results
          </h2>
          <p className="text-gray-600 mt-1">
            Found {matches.length} matches using 4-stage hybrid recommendation pipeline
          </p>
          {pipelineInfo && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-[#1DBF73]">
                <BoltIcon className="h-3 w-3 mr-1" />
                {pipelineInfo.executionTimeMs}ms
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F7F7F7] text-[#62646A]">
                v{pipelineInfo.version}
              </span>
              {pipelineInfo.stages?.map((stage, i) => (
                <span key={stage} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                  {i > 0 && '→ '}
                  {stage.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center px-4 py-2 bg-[#1DBF73] text-white rounded-lg hover:bg-[#00B22D] transition-colors text-sm"
          >
            <ChartBarIcon className="h-4 w-4 mr-2" />
            {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Analytics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-[#1DBF73]">
                {analytics.statistics.totalFreelancers}
              </div>
              <div className="text-sm text-[#62646A]">Total Freelancers</div>
            </div>
            
            <div className="bg-[#F7F7F7] p-4 rounded-lg">
              <div className="text-2xl font-bold text-[#00B22D]">
                {analytics.statistics.qualifiedFreelancers}
              </div>
              <div className="text-sm text-[#62646A]">Passed Pre-Filter</div>
            </div>
            
            <div className="bg-[#FAFAFA] p-4 rounded-lg border border-[#DADBDD]">
              <div className="text-2xl font-bold text-[#404145]">
                {analytics.statistics.applications}
              </div>
              <div className="text-sm text-[#62646A]">Applications</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(analytics.statistics.matchRate * 100)}%
              </div>
              <div className="text-sm text-gray-600">Conversion Rate</div>
            </div>
          </div>

          {/* Recommendations */}
          {analytics.recommendations?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-800 mb-2">Optimization Recommendations</h4>
              <ul className="space-y-2">
                {analytics.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-amber-700 flex items-start">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 mt-2 ${
                      rec.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></span>
                    {rec.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Min Score:</label>
            <select 
              value={filters.minScore}
              onChange={(e) => setFilters({...filters, minScore: parseFloat(e.target.value)})}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={0.3}>30% (Fair+)</option>
              <option value={0.4}>40% (Good+)</option>
              <option value={0.55}>55% (Strong+)</option>
              <option value={0.75}>75% (Excellent)</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">Experience:</label>
            <select 
              value={filters.experienceLevel}
              onChange={(e) => setFilters({...filters, experienceLevel: e.target.value})}
              className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {matches.length === 0 ? (
        <div className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No matches found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try lowering the minimum score or adjusting your project skills.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match, index) => (
            <FreelancerMatchCard 
              key={match.freelancer._id} 
              match={match} 
              rank={index + 1}
              onSelect={onFreelancerSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FreelancerMatchCard = ({ match, rank, onSelect }) => {
  const { freelancer, scores, matchTier, matchReason, pipelineStages } = match;
  const [showBreakdown, setShowBreakdown] = useState(false);

  const tierConfig = {
    excellent: { gradient: 'from-[#1DBF73] to-[#00B22D]', badge: '🏆', border: 'border-[#1DBF73]' },
    strong:    { gradient: 'from-[#1DBF73] to-teal-600', badge: '⭐', border: 'border-teal-400' },
    good:      { gradient: 'from-[#62646A] to-[#404145]', badge: '👍', border: 'border-[#B5B6BA]' },
    fair:      { gradient: 'from-[#B5B6BA] to-[#62646A]', badge: '🔍', border: 'border-[#DADBDD]' }
  };

  const config = tierConfig[matchTier] || tierConfig.fair;

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border-2 ${config.border} hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden`}
      onClick={() => onSelect?.(freelancer)}
    >
      {/* Tier Header */}
      <div className={`bg-gradient-to-r ${config.gradient} text-white px-4 py-2.5`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium flex items-center gap-1">
            <span>{config.badge}</span>
            <span className="capitalize">{matchTier} Match</span>
          </span>
          <span className="text-xl font-bold">
            {Math.round(scores.total * 100)}%
          </span>
        </div>
        {matchReason && (
          <div className="text-xs mt-1 opacity-90">
            {matchReason}
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <img
              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100"
              src={freelancer.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(freelancer.fullName)}&background=random`}
              alt={freelancer.fullName}
            />
            {rank <= 3 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {rank}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {freelancer.fullName}
            </h3>
            {freelancer.rating?.average > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <StarIcon className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm text-gray-600">
                  {freelancer.rating.average.toFixed(1)} ({freelancer.rating.count})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {freelancer.bio && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{freelancer.bio}</p>
        )}

        {/* Skills */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {freelancer.skills?.slice(0, 4).map((skill, i) => (
              <span key={i} className="px-2 py-0.5 bg-green-50 text-[#1DBF73] text-xs rounded-md font-medium">
                {skill}
              </span>
            ))}
            {freelancer.skills?.length > 4 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                +{freelancer.skills.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Experience & Rate Row */}
        <div className="flex justify-between items-center mb-3">
          {freelancer.experienceLevel && (
            <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${
              freelancer.experienceLevel === 'expert' ? 'bg-green-100 text-[#1DBF73]' :
              freelancer.experienceLevel === 'intermediate' ? 'bg-[#F7F7F7] text-[#62646A]' :
              'bg-[#FAFAFA] text-[#B5B6BA]'
            }`}>
              {freelancer.experienceLevel.charAt(0).toUpperCase() + freelancer.experienceLevel.slice(1)}
            </span>
          )}
          {freelancer.hourlyRate && (
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <CurrencyDollarIcon className="h-3.5 w-3.5" />
              Rs.{freelancer.hourlyRate}/hr
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Scores (collapsible) */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={(e) => { e.stopPropagation(); setShowBreakdown(!showBreakdown); }}
          className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center justify-between"
        >
          <span className="font-medium">Pipeline Breakdown</span>
          <span>{showBreakdown ? '▲' : '▼'}</span>
        </button>

        {showBreakdown && (
          <div className="mt-3 space-y-2">
            {/* Pipeline visualization */}
            {pipelineStages && (
              <div className="flex items-center justify-between text-xs mb-3 p-2 bg-white rounded border border-gray-200">
                <div className="text-center">
                  <div className="font-bold text-[#1DBF73]">{Math.round(pipelineStages.contentBased * 100)}%</div>
                  <div className="text-gray-400">Content</div>
                </div>
                <span className="text-gray-300">→</span>
                <div className="text-center">
                  <div className="font-bold text-[#62646A]">{Math.round(pipelineStages.collaborativeFiltering * 100)}%</div>
                  <div className="text-gray-400">Collab.</div>
                </div>
                <span className="text-gray-300">→</span>
                <div className="text-center">
                  <div className="font-bold text-[#00B22D]">{Math.round(pipelineStages.reranked * 100)}%</div>
                  <div className="text-gray-400">Final</div>
                </div>
              </div>
            )}

            {/* Detailed scores */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { label: 'Skills', value: scores.skill, color: 'blue' },
                { label: 'Experience', value: scores.experience, color: 'purple' },
                { label: 'Rate Fit', value: scores.rate, color: 'green' },
                { label: 'Portfolio', value: scores.portfolio, color: 'amber' },
                { label: 'Collaborative', value: scores.collaborative, color: 'indigo' },
                { label: 'Quality', value: scores.quality, color: 'pink' }
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-${color}-500 rounded-full`}
                        style={{ width: `${Math.round((value || 0) * 100)}%` }}
                      />
                    </div>
                    <span className="font-medium w-8 text-right">{Math.round((value || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-5 py-3">
        <button 
          className="w-full bg-[#1DBF73] hover:bg-[#00B22D] text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(freelancer);
          }}
        >
          View Profile & Invite
        </button>
      </div>
    </div>
  );
};

export default MatchingResults;