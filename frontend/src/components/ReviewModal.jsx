import React, { useState, useEffect } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * ReviewModal - For submitting reviews after milestones/projects
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: function
 * - onSubmit: function
 * - reviewType: 'milestone' | 'project'
 * - workspaceId: string
 * - milestoneId: string (optional, for milestone reviews)
 * - revieweeName: string (name of person being reviewed)
 * - isReviewingClient: boolean (true if reviewing a client)
 */
const ReviewModal = ({
  isOpen,
  onClose,
  onSubmit,
  reviewType = 'project',
  workspaceId,
  milestoneId,
  revieweeName,
  isReviewingClient = false
}) => {
  const [ratings, setRatings] = useState({
    overall: 0,
    quality: 0,
    communication: 0,
    timeliness: 0,
    expertise: 0,
    professionalism: 0,
    clarity: 0,
    responsiveness: 0,
    paymentTimeliness: 0,
    collaboration: 0
  });
  
  const [feedback, setFeedback] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [hoveredRating, setHoveredRating] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRatings({
        overall: 0,
        quality: 0,
        communication: 0,
        timeliness: 0,
        expertise: 0,
        professionalism: 0,
        clarity: 0,
        responsiveness: 0,
        paymentTimeliness: 0,
        collaboration: 0
      });
      setFeedback('');
      setPros('');
      setCons('');
      setWouldRecommend(true);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Rating categories based on who is being reviewed
  const freelancerCategories = [
    { key: 'quality', label: 'Quality of Work' },
    { key: 'communication', label: 'Communication' },
    { key: 'timeliness', label: 'Timeliness' },
    { key: 'expertise', label: 'Expertise' },
    { key: 'professionalism', label: 'Professionalism' }
  ];

  const clientCategories = [
    { key: 'clarity', label: 'Requirements Clarity' },
    { key: 'responsiveness', label: 'Responsiveness' },
    { key: 'paymentTimeliness', label: 'Payment Timeliness' },
    { key: 'collaboration', label: 'Collaboration' }
  ];

  const categories = isReviewingClient ? clientCategories : freelancerCategories;

  const handleRatingChange = (key, value) => {
    setRatings(prev => ({
      ...prev,
      [key]: value,
      // Update overall if it's the first rating or if all ratings are done
      overall: key === 'overall' ? value : prev.overall
    }));
  };

  const calculateOverallFromCategories = () => {
    const relevantRatings = categories.map(cat => ratings[cat.key]).filter(r => r > 0);
    if (relevantRatings.length === 0) return 0;
    return Math.round(relevantRatings.reduce((a, b) => a + b, 0) / relevantRatings.length);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate
    const overallRating = ratings.overall || calculateOverallFromCategories();
    if (overallRating === 0) {
      setError('Please provide at least an overall rating');
      return;
    }

    if (feedback.trim().length < 20) {
      setError('Please provide feedback with at least 20 characters');
      return;
    }

    setSubmitting(true);

    try {
      const reviewData = {
        workspaceId,
        milestoneId,
        reviewType,
        ratings: {
          overall: overallRating,
          ...Object.fromEntries(
            categories.map(cat => [cat.key, ratings[cat.key]])
          )
        },
        feedback: feedback.trim(),
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
        wouldRecommend
      };

      await onSubmit(reviewData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, label, size = 'md' }) => {
    const sizeClasses = {
      sm: 'h-5 w-5',
      md: 'h-6 w-6',
      lg: 'h-8 w-8'
    };

    return (
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-600 w-32">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoveredRating(`${label}-${star}`)}
              onMouseLeave={() => setHoveredRating(null)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              {(hoveredRating === `${label}-${star}` ? star : value) >= star ? (
                <StarIcon className={`${sizeClasses[size]} text-yellow-400`} />
              ) : (
                <StarOutlineIcon className={`${sizeClasses[size]} text-gray-300 hover:text-yellow-200`} />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {reviewType === 'milestone' ? 'Milestone Review' : 'Project Review'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Reviewing: <span className="font-medium text-gray-700">{revieweeName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Overall Rating */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Overall Rating</h3>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingChange('overall', star)}
                    className="focus:outline-none transition-transform hover:scale-125"
                  >
                    <StarIcon 
                      className={`h-10 w-10 ${
                        ratings.overall >= star 
                          ? 'text-yellow-400' 
                          : 'text-gray-200'
                      }`} 
                    />
                  </button>
                ))}
              </div>
              <p className="text-center mt-2 text-sm text-gray-600">
                {ratings.overall === 0 && 'Click to rate'}
                {ratings.overall === 1 && 'Poor - Major issues'}
                {ratings.overall === 2 && 'Fair - Some issues'}
                {ratings.overall === 3 && 'Good - Met expectations'}
                {ratings.overall === 4 && 'Very Good - Exceeded expectations'}
                {ratings.overall === 5 && 'Excellent - Outstanding work!'}
              </p>
            </div>

            {/* Category Ratings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Detailed Ratings</h3>
              <div className="space-y-3">
                {categories.map(cat => (
                  <StarRating
                    key={cat.key}
                    label={cat.label}
                    value={ratings[cat.key]}
                    onChange={(val) => handleRatingChange(cat.key, val)}
                    size="sm"
                  />
                ))}
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Feedback *
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your experience working together. What went well? What could be improved?"
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {feedback.length}/2000 characters (minimum 20)
              </p>
            </div>

            {/* Pros & Cons */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  What went well
                </label>
                <textarea
                  value={pros}
                  onChange={(e) => setPros(e.target.value)}
                  placeholder="Positive aspects..."
                  rows={2}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-1">
                  Room for improvement
                </label>
                <textarea
                  value={cons}
                  onChange={(e) => setCons(e.target.value)}
                  placeholder="Areas to improve..."
                  rows={2}
                  className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            </div>

            {/* Recommend */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(!wouldRecommend)}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  wouldRecommend 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-gray-300'
                }`}
              >
                {wouldRecommend && <CheckIcon className="h-4 w-4 text-white" />}
              </button>
              <span className="text-sm text-gray-700">
                I would recommend this {isReviewingClient ? 'client' : 'freelancer'} to others
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;