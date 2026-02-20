import React, { useState, useEffect } from 'react';
import { StarIcon, TrophyIcon, CheckBadgeIcon } from '@heroicons/react/24/solid';

/**
 * BadgeDisplay - Shows badges for a freelancer
 * 
 * Props:
 * - userId: string (optional, defaults to current user)
 * - showAll: boolean - show all badges or just featured
 * - compact: boolean - compact display mode
 * - maxDisplay: number - max badges to show
 */
const BadgeDisplay = ({ 
  userId, 
  showAll = false, 
  compact = false, 
  maxDisplay = 5 
}) => {
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState({ totalEarned: 0, totalXP: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBadges();
  }, [userId, showAll]);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = userId 
        ? `${import.meta.env.VITE_API_URL || ''}/api/badges/user/${userId}${showAll ? '' : '?featured=true'}`
        : `${import.meta.env.VITE_API_URL || ''}/api/badges/user/${localStorage.getItem('userId')}${showAll ? '' : '?featured=true'}`;
      
      const response = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Failed to fetch badges');

      const data = await response.json();
      setBadges(data.badges || []);
      setStats(data.stats || { totalEarned: 0, totalXP: 0 });
    } catch (err) {
      console.error('Error fetching badges:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tier styling
  const tierStyles = {
    bronze: {
      bg: 'bg-gradient-to-br from-amber-600 to-amber-800',
      border: 'border-amber-500',
      text: 'text-amber-100',
      glow: 'shadow-amber-500/30'
    },
    silver: {
      bg: 'bg-gradient-to-br from-gray-300 to-gray-500',
      border: 'border-gray-400',
      text: 'text-gray-800',
      glow: 'shadow-gray-400/30'
    },
    gold: {
      bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      glow: 'shadow-yellow-400/50'
    },
    platinum: {
      bg: 'bg-gradient-to-br from-slate-200 to-slate-400',
      border: 'border-slate-300',
      text: 'text-slate-800',
      glow: 'shadow-slate-300/50'
    },
    diamond: {
      bg: 'bg-gradient-to-br from-cyan-300 to-blue-500',
      border: 'border-cyan-200',
      text: 'text-cyan-900',
      glow: 'shadow-cyan-400/50'
    }
  };

  // Rarity styling
  const rarityStyles = {
    common: 'opacity-90',
    uncommon: 'opacity-95',
    rare: 'shadow-lg',
    epic: 'shadow-xl ring-2 ring-purple-400/50',
    legendary: 'shadow-2xl ring-2 ring-yellow-400/50 animate-pulse'
  };

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || badges.length === 0) {
    return null;
  }

  const displayBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  // Compact mode - just show icons
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {displayBadges.map((userBadge) => {
          const badge = userBadge.badge;
          if (!badge) return null;
          
          const tierStyle = tierStyles[badge.tier] || tierStyles.bronze;
          
          return (
            <div
              key={userBadge._id}
              className={`w-6 h-6 ${tierStyle.bg} rounded-full flex items-center justify-center text-xs shadow-md`}
              title={`${badge.name} - ${badge.description}`}
            >
              <span className="text-xs">{badge.icon}</span>
            </div>
          );
        })}
        {remainingCount > 0 && (
          <span className="text-xs text-gray-500 ml-1">+{remainingCount}</span>
        )}
      </div>
    );
  }

  // Full display
  return (
    <div className="space-y-3">
      {/* XP and Level */}
      {stats.totalXP > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            <StarIcon className="h-4 w-4" />
            <span>{stats.totalXP.toLocaleString()} XP</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
            <TrophyIcon className="h-4 w-4" />
            <span>{stats.totalEarned} Badges</span>
          </div>
        </div>
      )}

      {/* Badge Grid */}
      <div className="flex flex-wrap gap-3">
        {displayBadges.map((userBadge) => {
          const badge = userBadge.badge;
          if (!badge) return null;
          
          const tierStyle = tierStyles[badge.tier] || tierStyles.bronze;
          const rarityStyle = rarityStyles[badge.rarity] || '';
          
          return (
            <div
              key={userBadge._id}
              className={`relative group`}
            >
              <div
                className={`
                  w-14 h-14 ${tierStyle.bg} ${tierStyle.border} border-2 
                  rounded-xl flex items-center justify-center
                  shadow-lg ${tierStyle.glow} ${rarityStyle}
                  transform transition-all duration-200
                  hover:scale-110 hover:z-10 cursor-pointer
                `}
                title={badge.name}
              >
                <span className="text-2xl">{badge.icon}</span>
              </div>
              
              {/* Featured indicator */}
              {userBadge.isFeatured && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckBadgeIcon className="h-3 w-3 text-white" />
                </div>
              )}
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                              opacity-0 group-hover:opacity-100 transition-opacity
                              pointer-events-none z-20">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                  <div className="font-bold">{badge.name}</div>
                  <div className="text-gray-300 text-[10px]">{badge.description}</div>
                  <div className="flex items-center gap-1 mt-1 text-yellow-400">
                    <StarIcon className="h-3 w-3" />
                    <span>+{badge.xpReward} XP</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* More badges indicator */}
        {remainingCount > 0 && (
          <div className="w-14 h-14 bg-gray-100 border-2 border-dashed border-gray-300 
                          rounded-xl flex items-center justify-center text-gray-500 text-sm font-medium">
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * BadgeProgress - Shows progress towards earning badges
 */
export const BadgeProgress = ({ userId }) => {
  const [progress, setProgress] = useState({ earned: [], inProgress: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [userId]);

  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/badges/progress/${userId || localStorage.getItem('userId')}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch progress');

      const data = await response.json();
      setProgress(data);
    } catch (err) {
      console.error('Error fetching badge progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {progress.inProgress.slice(0, 3).map((item, index) => {
        const badge = item.badge;
        return (
          <div key={index} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-xl opacity-50">{badge.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-gray-800">{badge.name}</span>
                  <span className="text-xs text-gray-500">{item.progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {item.currentValue} / {item.threshold} {badge.criteria.type.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * BadgeNotification - Shows when a badge is earned
 */
export const BadgeNotification = ({ badge, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const tierStyle = {
    bronze: 'from-amber-600 to-amber-800',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-slate-200 to-slate-400',
    diamond: 'from-cyan-300 to-blue-500'
  }[badge.tier] || 'from-purple-500 to-indigo-600';

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`bg-gradient-to-r ${tierStyle} rounded-2xl shadow-2xl p-4 max-w-sm`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-3xl">{badge.icon}</span>
          </div>
          <div className="flex-1 text-white">
            <h3 className="font-bold text-lg">🏆 Badge Earned!</h3>
            <p className="font-medium">{badge.name}</p>
            <p className="text-sm opacity-90">{badge.description}</p>
            <div className="flex items-center gap-1 mt-2 text-yellow-200">
              <StarIcon className="h-4 w-4" />
              <span className="text-sm">+{badge.xpReward} XP</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default BadgeDisplay;