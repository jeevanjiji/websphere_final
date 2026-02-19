import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserIcon, 
  StarIcon, 
  ClockIcon, 
  CurrencyDollarIcon,
  ChatBubbleLeftIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api.js';

const ProjectApplicationsList = ({ projectId, onApplicationResponse, onOpenChat, onOpenWorkspace }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [awardingProject, setAwardingProject] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchApplications();
    }
  }, [projectId]);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        return;
      }

      const url = `${API_BASE_URL}${API_ENDPOINTS.APPLICATIONS.PROJECT(projectId)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setApplications(data.applications);
      } else {
        toast.error(data.message || 'Failed to fetch applications');
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplicationResponse = async (applicationId, action) => {
    setRespondingTo(applicationId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.APPLICATIONS.STATUS(applicationId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: action === 'accept' ? 'accepted' : 'rejected' 
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message || `Application ${action}ed successfully`);
        
        // Update application status locally - accepting now awards the project
        setApplications(prev => prev.map(app => 
          app._id === applicationId 
            ? { ...app, status: action === 'accept' ? 'awarded' : 'rejected' }
            : app
        ));

        // If accepting, also reject other applications for this project
        if (action === 'accept') {
          setApplications(prev => prev.map(app => 
            app._id !== applicationId && (app.status === 'pending' || app.status === 'accepted')
              ? { ...app, status: 'rejected' }
              : app
          ));
        }

        // Notify parent component
        onApplicationResponse && onApplicationResponse(data.application, data.chatCreated);
      } else {
        toast.error(data.message || `Failed to ${action} application`);
      }
    } catch (error) {
      console.error('Error responding to application:', error);
      toast.error(`Failed to ${action} application`);
    } finally {
      setRespondingTo(null);
    }
  };

  const handleStartChat = async (application) => {
    try {
      const token = localStorage.getItem('token');
      
      // Check if chat already exists or create one
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHATS.APPLICATION(application._id)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        // Open chat with the created/existing chat ID
        if (onOpenChat) {
          onOpenChat(data.chat._id, application.freelancer);
        }
        toast.success('Chat opened successfully');
      } else {
        toast.error(data.message || 'Failed to start chat');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
    }
  };

  const handleAwardProject = async (applicationId) => {
    if (!window.confirm('Are you sure you want to award this project to this freelancer? This action cannot be undone.')) {
      return;
    }

    setAwardingProject(applicationId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.APPLICATIONS.AWARD(applicationId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Project awarded successfully!');
        
        // Update application status locally
        setApplications(prev => prev.map(app => 
          app._id === applicationId 
            ? { ...app, status: 'awarded' }
            : app
        ));

        // Notify parent component
        onApplicationResponse && onApplicationResponse(data.application, true);
      } else {
        toast.error(data.message || 'Failed to award project');
      }
    } catch (error) {
      console.error('Error awarding project:', error);
      toast.error('Failed to award project');
    } finally {
      setAwardingProject(null);
    }
  };

  // Check if any freelancer has been awarded for this project
  const isProjectAwarded = applications.some(app => app.status === 'awarded');

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: 'warning', text: 'Pending Review' },
      accepted: { variant: 'info', text: 'Offer Agreed - Select for Job' },
      rejected: { variant: 'error', text: 'Rejected' },
      withdrawn: { variant: 'secondary', text: 'Withdrawn' },
      awarded: { variant: 'primary', text: 'Project Awarded' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Yet</h3>
        <p className="text-gray-600">
          Your project is live and waiting for freelancers to apply.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">
          Applications ({applications.length})
        </h3>
      </div>

      <div className="space-y-4">
        {applications.map((application) => (
          <motion.div
            key={application._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            {/* Freelancer Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {application.freelancer.profilePicture ? (
                    <img
                      src={application.freelancer.profilePicture}
                      alt={application.freelancer.fullName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {application.freelancer.fullName?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {application.freelancer.fullName}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <StarIcon className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">
                        {application.freelancer.rating?.average || 5.0}
                      </span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-600">
                      {application.freelancer.profile?.completedProjects || 0} projects completed
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(application.status)}
                <span className="text-sm text-gray-500">
                  {formatDate(application.createdAt)}
                </span>
              </div>
            </div>

            {/* Application Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Proposed Terms</h5>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Rs.{application.proposedRate}</span>
                    <span className="text-gray-600">proposed rate</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{application.proposedTimeline}</span>
                  </div>
                </div>
              </div>

              {application.freelancer.profile?.skills && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Skills</h5>
                  <div className="flex flex-wrap gap-2">
                    {application.freelancer.profile.skills.slice(0, 5).map((skill, index) => (
                      <Badge key={index} variant="secondary" size="small">
                        {skill}
                      </Badge>
                    ))}
                    {application.freelancer.profile.skills.length > 5 && (
                      <span className="text-xs text-gray-500">
                        +{application.freelancer.profile.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cover Letter */}
            <div className="mb-4">
              <h5 className="font-medium text-gray-900 mb-2">Cover Letter</h5>
              <p className="text-gray-600 text-sm leading-relaxed">
                {application.coverLetter}
              </p>
            </div>

            {/* Experience & Questions */}
            {(application.experience || application.questions) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {application.experience && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Experience</h5>
                    <p className="text-gray-600 text-sm">
                      {application.experience}
                    </p>
                  </div>
                )}
                
                {application.questions && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Questions</h5>
                    <p className="text-gray-600 text-sm">
                      {application.questions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {(application.status === 'pending' || application.status === 'accepted') && !isProjectAwarded && (
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="success"
                  size="small"
                  onClick={() => handleApplicationResponse(application._id, 'accept')}
                  disabled={respondingTo === application._id}
                  className="flex items-center gap-2"
                >
                  <CheckIcon className="h-4 w-4" />
                  {respondingTo === application._id ? 'Selecting...' : 'Select for Job'}
                </Button>

                {/* Show agreed amount if negotiated */}
                {application.status === 'accepted' && application.negotiatedAt && (
                  <div className="flex items-center gap-1 text-green-700 bg-green-50 px-3 py-1 rounded-lg text-sm font-medium">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    Agreed: Rs.{application.proposedRate}
                  </div>
                )}
                
                {application.status === 'pending' && (
                  <Button
                    variant="error"
                    size="small"
                    onClick={() => handleApplicationResponse(application._id, 'reject')}
                    disabled={respondingTo === application._id}
                    className="flex items-center gap-2"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Reject
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleStartChat(application)}
                  className="flex items-center gap-2 ml-auto"
                >
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                  {application.status === 'accepted' ? 'Open Chat' : 'Start Chat'}
                </Button>
              </div>
            )}

            {application.status === 'awarded' && (
              <div className="flex gap-3 justify-end items-center pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-green-600 font-medium mr-auto">
                  <CheckIcon className="h-5 w-5" />
                  Project Awarded
                </div>

                <Button
                  variant="info"
                  size="small"
                  onClick={() => onOpenWorkspace && onOpenWorkspace(projectId, application._id)}
                  className="flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  Workspace
                </Button>
              </div>
            )}

            {application.status === 'rejected' && isProjectAwarded && (
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  Project has been awarded to another freelancer
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProjectApplicationsList;
