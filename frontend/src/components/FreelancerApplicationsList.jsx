import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BriefcaseIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CalendarIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Card from './ui/Card';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api.js';

const FreelancerApplicationsList = ({ onOpenChat }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, accepted, rejected

  useEffect(() => {
    fetchMyApplications();
  }, [filter]);

  const fetchMyApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('🔥 No token found');
        return;
      }

      console.log('🔥 Fetching freelancer applications...');
      
      const url = filter === 'all' 
        ? `${API_BASE_URL}${API_ENDPOINTS.APPLICATIONS.MY}`
        : `${API_BASE_URL}${API_ENDPOINTS.APPLICATIONS.MY}?status=${filter}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📡 Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 My applications data:', data);
      
      if (data.success) {
        setApplications(data.applications);
        console.log('✅ My applications loaded:', data.applications.length);
      } else {
        console.error('❌ API returned success: false -', data.message);
        toast.error(data.message || 'Failed to fetch applications');
      }
    } catch (error) {
      console.error('💥 Error fetching my applications:', error);
      toast.error('Failed to load applications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: 'warning', text: 'Pending Review', icon: ClockIcon },
      accepted: { variant: 'success', text: 'Accepted', icon: null },
      awarded: { variant: 'success', text: 'Awarded', icon: null },
      rejected: { variant: 'error', text: 'Rejected', icon: ExclamationTriangleIcon },
      withdrawn: { variant: 'secondary', text: 'Withdrawn', icon: null }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const IconComponent = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {IconComponent && <IconComponent className="h-3 w-3" />}
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewProject = (projectId) => {
    // Navigate to project details or open project modal
    window.open(`/project/${projectId}`, '_blank');
  };

  const handleOpenChat = async (application) => {
    if (onOpenChat) {
      // Create or get chat for this application via API
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/chats/application/${application._id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (data.success && data.chat) {
          onOpenChat(application, data.chat._id);
        } else {
          toast.error(data.message || 'Failed to open chat');
        }
      } catch (error) {
        console.error('Error opening chat:', error);
        toast.error('Failed to open chat');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredApplications = applications;

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">My Applications</h2>
          <p className="text-white/80">
            Track your project applications and their status
          </p>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All', count: applications.length },
            { key: 'pending', label: 'Pending', count: applications.filter(a => a.status === 'pending').length },
            { key: 'awarded', label: 'Awarded', count: applications.filter(a => a.status === 'awarded' || a.status === 'accepted').length },
            { key: 'rejected', label: 'Rejected', count: applications.filter(a => a.status === 'rejected').length }
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilter(filterOption.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === filterOption.key
                  ? 'bg-white text-primary'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {filterOption.label} ({filterOption.count})
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <Card className="text-center py-12 bg-white/10 backdrop-blur-md border-white/20">
          <BriefcaseIcon className="h-16 w-16 text-white/60 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'No Applications Yet' : `No ${filter} Applications`}
          </h3>
          <p className="text-white/80 mb-6">
            {filter === 'all' 
              ? 'Start applying to projects to build your portfolio and grow your business.'
              : `You don't have any ${filter} applications at the moment.`
            }
          </p>
          {filter === 'all' && (
            <Button
              variant="primary"
              onClick={() => window.location.reload()} // Simple way to go back to browse projects
              className="bg-accent hover:bg-accent/90"
            >
              Browse Projects
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <motion.div
              key={application._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">
                        {application.project?.title || 'Project Title'}
                      </h3>
                      {getStatusBadge(application.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-white/80 mb-3">
                      <span className="flex items-center gap-1">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        Budget: Rs.{application.project?.agreedPrice || application.project?.budgetAmount} ({application.project?.budgetType})
                        {application.project?.agreedPrice ? ' 🔒' : ''}
                      </span>
                      {application.project?.deadline && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          Due: {formatDate(application.project.deadline)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        Applied: {formatDate(application.createdAt)}
                      </span>
                    </div>

                    {/* Client Info */}
                    {application.project?.client && (
                      <div className="flex items-center gap-2 text-white/80">
                        <span>Client: {application.project.client.fullName}</span>
                        {application.project.client.rating?.average > 0 && (
                          <div className="flex items-center gap-1">
                            <span>★</span>
                            <span>{application.project.client.rating.average.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleViewProject(application.project._id)}
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View Project
                    </Button>
                    
                    {/* Chat button - only before project is awarded */}
                    {application.status !== 'awarded' && (
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => handleOpenChat(application)}
                        className="bg-accent hover:bg-accent/90"
                      >
                        <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                    )}
                  </div>
                </div>

                {/* Application Details */}
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-white/80 text-sm">Proposed Rate:</span>
                      <div className="text-white font-medium">Rs.{application.proposedRate}/hour</div>
                    </div>
                    <div>
                      <span className="text-white/80 text-sm">Proposed Timeline:</span>
                      <div className="text-white font-medium">{application.proposedTimeline}</div>
                    </div>
                  </div>

                  {application.coverLetter && (
                    <div>
                      <span className="text-white/80 text-sm">Cover Letter:</span>
                      <p className="text-white mt-1 text-sm leading-relaxed">
                        {application.coverLetter}
                      </p>
                    </div>
                  )}

                  {application.experience && (
                    <div>
                      <span className="text-white/80 text-sm">Relevant Experience:</span>
                      <p className="text-white mt-1 text-sm">
                        {application.experience}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FreelancerApplicationsList;
