import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  ClockIcon,
  StarIcon,
  DocumentTextIcon,
  UserIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';
import { Button, Card, Badge } from './ui';
import ProjectApplicationModal from './ProjectApplicationModal';
import ChatInterface from './ChatInterface';
import WorkspaceInterfaceFixed from './WorkspaceInterfaceFixed';
import { formatChatListTime } from '../utils/dateUtils';

const FreelancerDashboard = ({ externalActiveTab, onTabChange }) => {
  const [internalActiveTab, setInternalActiveTab] = useState('browse');
  
  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  
  // Function to handle tab changes
  const setActiveTab = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkills, setSelectedSkills] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(true); // Show all by default
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProjects: 0
  });
  const [applicationModal, setApplicationModal] = useState({
    isOpen: false,
    project: null
  });
  const [applications, setApplications] = useState([]);
  const [workspaceAvailability, setWorkspaceAvailability] = useState({}); // Track which projects have workspaces
  const [chats, setChats] = useState([]);
  const [chatModal, setChatModal] = useState({
    isOpen: false,
    chatId: null
  });
  const [workspaceModal, setWorkspaceModal] = useState({
    isOpen: false,
    projectId: null,
    applicationId: null
  });
  
  // AI Recommendations state
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Stats state
  const [stats, setStats] = useState({
    totalEarnings: 0,
    hoursWorked: 0,
    completedProjects: 0
  });

  // Active projects state
  const [activeProjects, setActiveProjects] = useState([]);
  const [loadingActiveProjects, setLoadingActiveProjects] = useState(false);

  // Completed projects state
  const [completedProjects, setCompletedProjects] = useState([]);
  const [loadingCompletedProjects, setLoadingCompletedProjects] = useState(false);

  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const tabs = [
    { id: 'recommendations', name: '🎯 AI Matches', icon: StarIcon },
    { id: 'browse', name: 'Browse Projects', icon: MagnifyingGlassIcon },
    { id: 'proposals', name: 'My Proposals', icon: DocumentTextIcon },
    { id: 'messages', name: 'Messages', icon: UserIcon },
    { id: 'active', name: 'Active Projects', icon: BriefcaseIcon },
    { id: 'completed', name: 'Completed', icon: StarIcon },
    { id: 'earnings', name: 'Earnings', icon: CurrencyDollarIcon },
  ];

  // Fetch projects from API
  const fetchProjects = async (page = 1, search = '', skills = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view projects');
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }
      if (skills.trim()) {
        params.append('skills', skills.trim());
      }
      if (showAllProjects) {
        params.append('showAllProjects', 'true');
      }

      const response = await fetch(`http://localhost:5000/api/projects/browse?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log('🎯 Projects fetched:', data.projects?.length || 0);
        console.log('🔍 Debug info:', data.debug);
        setProjects(data.projects);
        setPagination(data.pagination);
      } else {
        console.error('❌ Failed to fetch projects:', data.message);
        toast.error(data.message || 'Failed to fetch projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI Recommendations
  const fetchAIRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view recommendations');
        return;
      }

      // Use user._id or user.userId, whichever exists
      const userId = user._id || user.userId || user.id;
      if (!userId) {
        console.error('❌ No user ID found in user object:', user);
        toast.error('User not properly authenticated');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/matching/projects/${userId}?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log('🎯 AI Recommendations fetched:', data.data.projects?.length || 0);
        setAiRecommendations(data.data.projects || []);
      } else {
        console.error('❌ Failed to fetch AI recommendations:', data.message);
        if (data.message.includes('not found')) {
          // Freelancer profile might not be complete
          setAiRecommendations([]);
        } else {
          toast.error(data.message || 'Failed to fetch recommendations');
        }
      }
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      // Don't show error toast for AI features - they're optional
      setAiRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Fetch active projects (awarded projects that are in progress)
  const fetchActiveProjects = async () => {
    setLoadingActiveProjects(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view active projects');
        return;
      }

      const response = await fetch('http://localhost:5000/api/applications/my?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Filter to show only awarded/accepted projects that are NOT completed (active projects)
        const activeApps = data.applications.filter(app => 
          (app.status === 'awarded' || app.status === 'accepted') &&
          app.project?.status !== 'completed'
        );
        
        console.log('Active projects raw:', data.applications.map(a => ({ 
          id: a._id, 
          status: a.status, 
          projectStatus: a.project?.status 
        })));
        
        // Check workspace availability for each
        const projectsWithWorkspace = [];
        for (const app of activeApps) {
          const hasWorkspace = await checkWorkspaceExists(app.project._id);
          projectsWithWorkspace.push({
            ...app,
            hasWorkspace
          });
        }
        
        setActiveProjects(projectsWithWorkspace);
      } else {
        toast.error(data.message || 'Failed to fetch active projects');
      }
    } catch (error) {
      console.error('Error fetching active projects:', error);
      toast.error('Failed to load active projects. Please try again.');
    } finally {
      setLoadingActiveProjects(false);
    }
  };

  // Fetch completed projects
  const fetchCompletedProjects = async () => {
    setLoadingCompletedProjects(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view completed projects');
        return;
      }

      const response = await fetch('http://localhost:5000/api/applications/my?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Filter to show projects where the project status is 'completed'
        const completedApps = data.applications.filter(app => 
          app.project?.status === 'completed'
        );
        console.log('Completed projects:', completedApps);
        setCompletedProjects(completedApps);
      } else {
        toast.error(data.message || 'Failed to fetch completed projects');
      }
    } catch (error) {
      console.error('Error fetching completed projects:', error);
      toast.error('Failed to load completed projects. Please try again.');
    } finally {
      setLoadingCompletedProjects(false);
    }
  };

  // Load data when component mounts or when activeTab changes
  useEffect(() => {
    if (activeTab === 'recommendations') {
      fetchAIRecommendations();
    } else if (activeTab === 'browse') {
      fetchProjects(1, searchTerm, selectedSkills);
    } else if (activeTab === 'proposals') {
      fetchMyApplications();
    } else if (activeTab === 'messages') {
      fetchChats();
    } else if (activeTab === 'active') {
      fetchActiveProjects();
    } else if (activeTab === 'completed') {
      fetchCompletedProjects();
    } else if (activeTab === 'earnings') {
      fetchFreelancerStats();
    }
  }, [activeTab]);

  // Refetch projects when showAllProjects changes
  useEffect(() => {
    if (activeTab === 'browse') {
      fetchProjects(1, searchTerm, selectedSkills);
    }
  }, [showAllProjects]);

  // Fetch freelancer stats (earnings)
  const fetchFreelancerStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:5000/api/freelancers/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setStats({
          totalEarnings: data.stats.totalEarnings || 0,
          hoursWorked: data.stats.hoursWorked || 0,
          completedProjects: data.stats.completedProjects || 0
        });
      }
    } catch (error) {
      console.error('Error fetching freelancer stats:', error);
    }
  };

  // Fetch freelancer's applications (pending proposals only)
  const fetchMyApplications = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view applications');
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      const response = await fetch(`http://localhost:5000/api/applications/my?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Filter to show only pending applications (not accepted/awarded)
        const pendingApps = data.applications.filter(app => app.status === 'pending');
        setApplications(pendingApps);
        setPagination({
          ...data.pagination,
          totalProjects: pendingApps.length
        });
        
        // Check workspace availability for accepted/awarded applications
        const acceptedApps = data.applications.filter(app => app.status === 'accepted' || app.status === 'awarded');
        const workspaceChecks = {};
        
        for (const app of acceptedApps) {
          const hasWorkspace = await checkWorkspaceExists(app.project._id);
          workspaceChecks[app.project._id] = hasWorkspace;
        }
        
        setWorkspaceAvailability(workspaceChecks);
      } else {
        toast.error(data.message || 'Failed to fetch applications');
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if workspace exists for a project
  const checkWorkspaceExists = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await fetch(`http://localhost:5000/api/workspaces/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error checking workspace:', error);
      return false;
    }
  };

  // Fetch chats
  const fetchChats = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view messages');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/chats?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setChats(data.chats || []);
      } else {
        toast.error(data.message || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening chat for an application
  const handleApplicationChat = async (application) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in');
        return;
      }
      
      // Create or get chat for this application
      const response = await fetch(`http://localhost:5000/api/chats/application/${application._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success && data.chat) {
        setChatModal({ isOpen: true, chatId: data.chat._id });
      } else {
        toast.error(data.message || 'Failed to open chat');
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      toast.error('Failed to open chat');
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchProjects(1, searchTerm, selectedSkills);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchProjects(newPage, searchTerm, selectedSkills);
  };

  // Handle show all projects toggle
  const handleShowAllToggle = () => {
    setShowAllProjects(!showAllProjects);
    // Refetch projects with new setting
    setTimeout(() => {
      fetchProjects(1, searchTerm, selectedSkills);
    }, 0);
  };



  // Helper function to format project data for display
  const formatProject = (project) => {
    const timeAgo = new Date(project.createdAt).toLocaleDateString();
    const displayAmount = project.agreedPrice || project.finalRate || project.budgetAmount;
    const lockIcon = project.agreedPrice ? ' 🔒' : '';
    const budget = project.budgetType === 'fixed'
      ? `Rs.${displayAmount} (Fixed)${lockIcon}`
      : `Rs.${displayAmount}/hr (Hourly)${lockIcon}`;

    return {
      ...project,
      budget,
      postedTime: timeAgo,
      client: project.client?.fullName || 'Anonymous Client'
    };
  };

  const renderAIRecommendations = () => (
    <div className="space-y-6">
      {/* AI Recommendations Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full text-lg font-semibold mb-4">
          <StarIcon className="h-6 w-6" />
          AI-Powered Project Recommendations
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Our AI analyzes your skills, experience, and preferences to find the perfect projects for you. 
          Projects are scored based on skill match, budget compatibility, and portfolio relevance.
        </p>
      </div>

      {/* Toggle for showing match scores */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {aiRecommendations.length} Personalized Matches
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAIRecommendations}
            disabled={loadingRecommendations}
          >
            {loadingRecommendations ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showRecommendations}
            onChange={(e) => setShowRecommendations(e.target.checked)}
            className="rounded"
          />
          Show match details
        </label>
      </div>

      {/* Loading State */}
      {loadingRecommendations && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Finding perfect matches for you...</span>
        </div>
      )}

      {/* AI Recommendations Grid */}
      {!loadingRecommendations && aiRecommendations.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <StarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
          <p className="text-gray-600 mb-4">
            Complete your profile with skills and portfolio to get AI-powered project recommendations.
          </p>
          <Button variant="primary" onClick={() => setActiveTab('browse')}>
            Browse All Projects
          </Button>
        </div>
      )}

      {!loadingRecommendations && aiRecommendations.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {aiRecommendations.map((project) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-card hover:shadow-lg transition-all duration-300 overflow-hidden border-l-4 border-blue-500"
            >
              {/* Match Score Badge */}
              {showRecommendations && project.scores && (
                <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span>Match Score</span>
                    <span className="text-lg font-bold">{Math.round(project.scores.total * 100)}%</span>
                  </div>
                  {project.matchReason && (
                    <div className="text-xs mt-1 text-green-100">
                      {project.matchReason}
                    </div>
                  )}
                </div>
              )}

              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {project.title}
                  </h3>
                  <Badge variant="primary" size="small">
                    {project.categoryName || project.category}
                  </Badge>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {project.description}
                </p>

                {/* Skills */}
                {project.skills && project.skills.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {project.skills.slice(0, 3).map((skill, index) => (
                        <Badge
                          key={`${skill}-${index}`}
                          variant={showRecommendations && project.scores?.skill > 0.7 ? 'primary' : 'secondary'}
                          size="small"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {project.skills.length > 3 && (
                        <Badge variant="secondary" size="small">
                          +{project.skills.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Project Details */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <CurrencyDollarIcon className="h-4 w-4" />
                      {project.budgetType === 'hourly' 
                        ? `Rs.${project.agreedPrice || project.finalRate || project.budgetAmount}/hr` 
                        : `Rs.${project.agreedPrice || project.finalRate || project.budgetAmount}`}
                      {project.agreedPrice ? ' 🔒' : ''}
                    </span>
                    {project.deadline && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Match Breakdown */}
                {showRecommendations && project.scores && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-700 mb-2">Match Breakdown:</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex justify-between">
                        <span>Skills:</span>
                        <span className="font-medium">{Math.round(project.scores.skill * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate:</span>
                        <span className="font-medium">{Math.round(project.scores.rate * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Portfolio:</span>
                        <span className="font-medium">{Math.round(project.scores.portfolio * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overall:</span>
                        <span className="font-bold text-blue-600">{Math.round(project.scores.total * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button 
                  variant="primary" 
                  size="medium"
                  className="w-full"
                  onClick={() => setApplicationModal({
                    isOpen: true,
                    project: project
                  })}
                >
                  <StarIcon className="h-4 w-4 mr-2" />
                  Apply to This Match
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Call to Action */}
      {!loadingRecommendations && aiRecommendations.length > 0 && (
        <div className="text-center mt-8 p-6 bg-blue-50 rounded-lg">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Want more matches?</h4>
          <p className="text-gray-600 mb-4">
            Keep your profile updated with new skills and portfolio items to get better recommendations.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => setActiveTab('browse')}>
              Browse All Projects
            </Button>
            <Button variant="primary" onClick={fetchAIRecommendations}>
              Refresh Recommendations
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderBrowseProjects = () => (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <input
            type="text"
            placeholder="Filter by skills (e.g., React, Node.js)"
            value={selectedSkills}
            onChange={(e) => setSelectedSkills(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </div>
        
        {/* Filter Options */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllProjects}
              onChange={handleShowAllToggle}
              className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <span className="text-gray-700">
              Show all projects (otherwise only projects matching your skills)
            </span>
          </label>
          <div className="text-gray-500">
            {pagination.totalProjects > 0 && (
              <span>{pagination.totalProjects} projects found</span>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-gray-600">Loading projects...</p>
        </div>
      )}

      {/* Projects List */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">No projects found. Try adjusting your search criteria.</p>
        </div>
      )}

      {/* Project Cards */}
      {!loading && projects.length > 0 && (
        <div>
          <div className="mb-4 text-sm text-gray-600">
            Showing {projects.length} of {pagination.totalProjects} projects
          </div>

          {projects.map((project) => {
            const formattedProject = formatProject(project);
            return (
              <Card
                key={project._id}
                variant="default"
                padding="default"
                hover={true}
                className="mb-6"
              >
                <div className="flex gap-4">
                  {/* Project Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={project.image || 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400&h=250&fit=crop&crop=center'}
                      alt={project.categoryName || formattedProject.title}
                      className="w-24 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400&h=250&fit=crop&crop=center';
                      }}
                    />
                  </div>
                  
                  {/* Project Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="heading-4">{formattedProject.title}</h3>
                        {project.categoryName && (
                          <span className="text-sm text-blue-600 font-medium">
                            {project.categoryName}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{formattedProject.postedTime}</span>
                    </div>

                    <p className="body-regular mb-4">{formattedProject.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {formattedProject.skills.map((skill, index) => (
                        <Badge
                          key={`${skill}-${index}`}
                          variant="primary"
                          size="small"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-4 w-4" />
                          {formattedProject.budget}
                        </span>
                        {formattedProject.deadline && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4" />
                            Due: {new Date(formattedProject.deadline).toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-4 w-4" />
                          {formattedProject.client}
                        </span>
                      </div>
                      <Button 
                        variant="primary" 
                        size="medium"
                        onClick={() => setApplicationModal({
                          isOpen: true,
                          project: project
                        })}
                      >
                        Apply Now
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && projects.length > 0 && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderMyProposals = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (applications.length === 0) {
      return (
        <Card className="text-center py-12">
          <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
          <p className="body-regular">Start applying to projects to see your proposals here.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {applications.map((application) => {
          const formattedProject = formatProject(application.project);
          
          const getStatusBadge = (status) => {
            const statusConfig = {
              pending: { variant: 'warning', text: 'Pending Review' },
              accepted: { variant: 'success', text: 'Accepted' },
              awarded: { variant: 'success', text: 'Awarded' },
              rejected: { variant: 'error', text: 'Rejected' },
              withdrawn: { variant: 'secondary', text: 'Withdrawn' }
            };
            const config = statusConfig[status] || statusConfig.pending;
            return <Badge variant={config.variant}>{config.text}</Badge>;
          };

          return (
            <Card key={application._id} className="hover:shadow-lg transition-shadow">
              <div className="flex gap-4">
                {formattedProject.image && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={formattedProject.image}
                      alt={formattedProject.categoryName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="heading-4">{formattedProject.title}</h3>
                      {application.project.categoryName && (
                        <span className="text-sm text-blue-600 font-medium">
                          {application.project.categoryName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(application.status)}
                      <span className="text-sm text-gray-500">
                        {new Date(application.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="body-regular mb-4 line-clamp-2">{formattedProject.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-600">Your Proposed Rate:</span>
                      <p className="font-semibold text-lg text-green-600">Rs.{application.proposedRate}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Project Budget:</span>
                      <p className="font-semibold">{formattedProject.budget}</p>
                    </div>
                  </div>

                  {/* Start & Due dates for awarded/accepted applications */}
                  {(application.status === 'accepted' || application.status === 'awarded') && application.project?.deadline && (
                    <div className="flex items-center gap-3 text-xs mb-3 px-1">
                      <span className="text-gray-500">
                        Started: {new Date(application.project.awardedAt || application.createdAt).toLocaleDateString()}
                      </span>
                      <span className={`font-medium ${
                        new Date(application.project.deadline) < new Date() ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        Due: {new Date(application.project.deadline).toLocaleDateString()}
                        {new Date(application.project.deadline) < new Date() && ' (overdue)'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {application.proposedTimeline}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {formattedProject.client}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Chat button - only before project is awarded (for negotiation) */}
                      {(application.status === 'pending' || application.status === 'accepted') && (
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={() => handleApplicationChat(application)}
                          className="flex items-center gap-1"
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                          Chat
                        </Button>
                      )}

                      {/* Workspace button - only for awarded apps with workspace */}
                      {application.status === 'awarded' && 
                        workspaceAvailability[application.project._id] && (
                          <Button 
                            variant="success" 
                            size="small"
                            onClick={() => {
                              setWorkspaceModal({
                                isOpen: true,
                                projectId: application.project._id,
                                applicationId: application._id
                              });
                            }}
                          >
                            Open Workspace
                          </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderActiveProjects = () => {
    if (loadingActiveProjects) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (activeProjects.length === 0) {
      return (
        <Card className="text-center py-12">
          <BriefcaseIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No active projects</h3>
          <p className="body-regular">Your active projects will appear here once you start working.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {activeProjects.map((application) => {
          const formattedProject = formatProject(application.project);
          const isOverdue = application.project?.deadline && new Date(application.project.deadline) < new Date();
          
          return (
            <Card key={application._id} className="hover:shadow-lg transition-shadow">
              <div className="flex gap-4">
                {formattedProject.image && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={formattedProject.image}
                      alt={formattedProject.categoryName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="success">In Progress</Badge>
                        {isOverdue && <Badge variant="error">Overdue</Badge>}
                      </div>
                      <h3 className="heading-4">{formattedProject.title}</h3>
                      {application.project.categoryName && (
                        <span className="text-sm text-blue-600 font-medium">
                          {application.project.categoryName}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="body-regular mb-4 line-clamp-2">{formattedProject.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-600">Agreed Rate:</span>
                      <p className="font-semibold text-lg text-green-600">Rs.{application.proposedRate}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Project Budget:</span>
                      <p className="font-semibold">{formattedProject.budget}</p>
                    </div>
                  </div>

                  {/* Deadline */}
                  {application.project?.deadline && (
                    <div className="flex items-center gap-3 text-sm mb-4">
                      <ClockIcon className="h-4 w-4 text-gray-500" />
                      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {isOverdue ? 'Was due: ' : 'Due: '}
                        {new Date(application.project.deadline).toLocaleDateString()}
                        {isOverdue && ' (overdue)'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {formattedProject.client}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Open Workspace button - chat is available inside workspace */}
                      {application.hasWorkspace && (
                        <Button 
                          variant="success" 
                          size="small"
                          onClick={() => {
                            setWorkspaceModal({
                              isOpen: true,
                              projectId: application.project._id,
                              applicationId: application._id
                            });
                          }}
                        >
                          Open Workspace
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderEarnings = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <CurrencyDollarIcon className="h-12 w-12 text-accent mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Rs.{stats.totalEarnings.toLocaleString()}</h3>
        <p className="text-gray-600">Total Earnings</p>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <ClockIcon className="h-12 w-12 text-accent mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{stats.hoursWorked}</h3>
        <p className="text-gray-600">Hours Worked</p>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <StarIcon className="h-12 w-12 text-accent mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{stats.completedProjects}</h3>
        <p className="text-gray-600">Completed Projects</p>
      </div>
    </div>
  );

  const renderMessages = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (chats.length === 0) {
      return (
        <div className="text-center py-12">
          <UserIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
          <p className="body-regular">Your conversations with clients will appear here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {chats.map((chat) => {
          const otherParticipant = chat.participants?.find(p => p.user._id !== user.id)?.user;
          const lastMessage = chat.lastMessage;
          
          return (
            <Card key={chat._id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setChatModal({ isOpen: true, chatId: chat._id })}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {otherParticipant?.profilePicture ? (
                    <img
                      src={otherParticipant.profilePicture}
                      alt={otherParticipant.fullName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900 truncate">
                      {otherParticipant?.fullName || 'Unknown User'}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {lastMessage?.createdAt ? formatChatListTime(lastMessage.createdAt) : ''}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 truncate mt-1">
                    {chat.project?.title && `Project: ${chat.project.title}`}
                  </p>
                  
                  {lastMessage && (
                    <p className="text-sm text-gray-500 truncate mt-2">
                      {lastMessage.content}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderCompletedProjects = () => {
    if (loadingCompletedProjects) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (completedProjects.length === 0) {
      return (
        <Card className="text-center py-12">
          <StarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No completed projects yet</h3>
          <p className="body-regular">Your completed projects will appear here once you finish working on them.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {completedProjects.map((application) => {
          const formattedProject = formatProject(application.project);
          
          return (
            <Card key={application._id} className="hover:shadow-lg transition-shadow">
              <div className="flex gap-4">
                {formattedProject.image && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={formattedProject.image}
                      alt={formattedProject.categoryName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="success">Completed</Badge>
                      </div>
                      <h3 className="heading-4">{formattedProject.title}</h3>
                      {application.project.categoryName && (
                        <span className="text-sm text-blue-600 font-medium">
                          {application.project.categoryName}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="body-regular mb-4 line-clamp-2">{formattedProject.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-600">Earnings:</span>
                      <p className="font-semibold text-lg text-green-600">Rs.{application.proposedRate}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Project Budget:</span>
                      <p className="font-semibold">{formattedProject.budget}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {formattedProject.client}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'recommendations':
        return renderAIRecommendations();
      case 'browse':
        return renderBrowseProjects();
      case 'proposals':
        return renderMyProposals();
      case 'messages':
        return renderMessages();
      case 'active':
        return renderActiveProjects();
      case 'completed':
        return renderCompletedProjects();
      case 'earnings':
        return renderEarnings();
      default:
        return renderAIRecommendations(); // Default to AI recommendations first
    }
  };

  return (
    <section className="py-16 bg-bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="heading-2 text-center mb-4">Welcome back, {user?.profile?.firstName || user?.username}!</h2>
        <p className="text-center text-gray-600 mb-8">Find your next project and showcase your skills to clients worldwide</p>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center mb-8 bg-white rounded-xl p-2 shadow-card">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="hidden sm:inline">{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>

      {/* Application Modal */}
      <ProjectApplicationModal
        project={applicationModal.project}
        isOpen={applicationModal.isOpen}
        onClose={() => setApplicationModal({ isOpen: false, project: null })}
        onSuccess={() => {
          // Refresh applications if on proposals tab
          if (activeTab === 'proposals') {
            fetchMyApplications();
          }
        }}
      />

      {/* Chat Modal */}
      <ChatInterface
        chatId={chatModal.chatId}
        isOpen={chatModal.isOpen}
        onClose={() => setChatModal({ isOpen: false, chatId: null })}
        user={user}
      />

      {/* Fixed Workspace Modal */}
      {workspaceModal.isOpen && (
        <WorkspaceInterfaceFixed
          projectId={workspaceModal.projectId}
          applicationId={workspaceModal.applicationId}
          onClose={() => setWorkspaceModal({ isOpen: false, projectId: null, applicationId: null })}
        />
      )}
    </section>
  );
};

export default FreelancerDashboard;
