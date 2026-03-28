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

  const renderAIRecommendations = () => {
    // Match tier config — using website's green theme (#1DBF73 primary)
    const getTierConfig = (tier) => {
      const configs = {
        excellent: { 
          gradient: 'from-[#1DBF73] to-[#00B22D]',
          headerBg: 'bg-[#1DBF73]',
          badge: '🏆', label: 'Excellent', 
          border: 'border-[#1DBF73]',
          scoreColor: 'text-[#1DBF73]',
          tagBg: 'bg-green-50 text-[#1DBF73]'
        },
        strong: { 
          gradient: 'from-[#1DBF73] to-teal-600',
          headerBg: 'bg-teal-600',
          badge: '⭐', label: 'Strong', 
          border: 'border-teal-500',
          scoreColor: 'text-teal-600',
          tagBg: 'bg-teal-50 text-teal-700'
        },
        good: { 
          gradient: 'from-[#62646A] to-[#404145]',
          headerBg: 'bg-[#62646A]',
          badge: '👍', label: 'Good', 
          border: 'border-[#B5B6BA]',
          scoreColor: 'text-[#62646A]',
          tagBg: 'bg-gray-100 text-[#62646A]'
        },
        fair: { 
          gradient: 'from-[#B5B6BA] to-[#62646A]',
          headerBg: 'bg-[#B5B6BA]',
          badge: '🔍', label: 'Fair', 
          border: 'border-[#DADBDD]',
          scoreColor: 'text-[#B5B6BA]',
          tagBg: 'bg-gray-50 text-gray-500'
        }
      };
      return configs[tier] || configs.fair;
    };

    // Progress bar component matching green theme
    const ProgressBar = ({ label, value, color = 'bg-[#1DBF73]' }) => (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#62646A] w-20 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-[#F7F7F7] rounded-full overflow-hidden">
          <motion.div 
            className={`h-full ${color} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(value * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] font-semibold text-[#404145] w-8 text-right">{Math.round(value * 100)}%</span>
      </div>
    );

    return (
    <div className="space-y-6">
      {/* Header — Matches website's green theme */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#404145] via-[#2d2e31] to-[#404145] p-6 md:p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #1DBF73 0%, transparent 50%), radial-gradient(circle at 80% 50%, #00B22D 0%, transparent 50%)' }} />
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-[#1DBF73]/20 border border-[#1DBF73]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[#1DBF73] mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DBF73] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DBF73]"></span>
            </span>
            Hybrid AI Engine v3.0
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Hybrid Recommendation System</h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm">
            Combining <strong className="text-white">content-based matching</strong>, <strong className="text-white">collaborative filtering</strong>, and <strong className="text-white">re-ranking</strong> to find your ideal projects.
          </p>
          
          {/* Pipeline Steps */}
          <div className="flex items-center justify-center gap-0 mt-5">
            {[
              { num: '1', label: 'Content Matching', sub: 'Semantic Similarity' },
              { num: '2', label: 'Collaborative Filter', sub: 'Interaction Matrix' },
              { num: '3', label: 'Re-Ranking', sub: 'Multi-Signal Blend' }
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                {i > 0 && (
                  <div className="flex items-center px-1">
                    <div className="w-6 md:w-10 h-[2px] bg-[#1DBF73]/40" />
                    <svg className="w-3 h-3 text-[#1DBF73]/60 -ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" /></svg>
                  </div>
                )}
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center min-w-[100px] md:min-w-[120px]">
                  <div className="w-5 h-5 rounded-full bg-[#1DBF73] text-white text-[10px] font-bold flex items-center justify-center mx-auto mb-1">{step.num}</div>
                  <div className="text-[11px] font-semibold text-white">{step.label}</div>
                  <div className="text-[9px] text-gray-500">{step.sub}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-[#404145]">
            {aiRecommendations.length} <span className="text-[#B5B6BA] font-normal">Matches Found</span>
          </h3>
          <button
            onClick={fetchAIRecommendations}
            disabled={loadingRecommendations}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7F7] hover:bg-[#DADBDD] text-[#62646A] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loadingRecommendations ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loadingRecommendations ? 'Running...' : 'Refresh'}
          </button>
        </div>
        
        <label className="flex items-center gap-2 text-sm text-[#62646A] cursor-pointer select-none">
          <div className={`relative w-9 h-5 rounded-full transition-colors ${showRecommendations ? 'bg-[#1DBF73]' : 'bg-[#DADBDD]'}`}
               onClick={() => setShowRecommendations(!showRecommendations)}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showRecommendations ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          Pipeline Details
        </label>
      </div>

      {/* Loading State */}
      {loadingRecommendations && (
        <div className="flex flex-col items-center py-16 bg-[#FAFAFA] rounded-xl border border-[#DADBDD]">
          <div className="relative mb-5">
            <div className="w-14 h-14 border-4 border-gray-200 rounded-full" />
            <div className="absolute top-0 w-14 h-14 border-4 border-transparent border-t-[#1DBF73] rounded-full animate-spin" />
          </div>
          <span className="text-[#404145] font-semibold text-base">Running Hybrid Pipeline...</span>
          <div className="flex items-center gap-2 mt-3">
            {['Content', 'Collaborative', 'Re-Rank'].map((step, i) => (
              <React.Fragment key={step}>
                {i > 0 && <span className="text-[#DADBDD]">→</span>}
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#1DBF73]/10 text-[#1DBF73] animate-pulse"
                      style={{ animationDelay: `${i * 300}ms` }}>
                  {step}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loadingRecommendations && aiRecommendations.length === 0 && (
        <div className="text-center py-16 bg-[#FAFAFA] rounded-xl border border-[#DADBDD]">
          <div className="w-16 h-16 rounded-full bg-[#1DBF73]/10 flex items-center justify-center mx-auto mb-4">
            <StarIcon className="w-8 h-8 text-[#1DBF73]" />
          </div>
          <h3 className="text-lg font-bold text-[#404145] mb-2">No recommendations yet</h3>
          <p className="text-[#62646A] mb-5 max-w-md mx-auto text-sm">
            Complete your profile with skills and portfolio to get AI-powered recommendations.
          </p>
          <Button variant="primary" onClick={() => setActiveTab('browse')}>
            Browse All Projects
          </Button>
        </div>
      )}

      {/* Recommendations Grid */}
      {!loadingRecommendations && aiRecommendations.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {aiRecommendations.map((project, index) => {
            const tierConfig = getTierConfig(project.matchTier);
            const scorePercent = Math.round((project.scores?.total || 0) * 100);
            return (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              className={`group relative bg-white rounded-xl overflow-hidden border ${tierConfig.border} shadow-card hover:shadow-card-hover transition-shadow duration-300`}
            >
              {/* Score Header */}
              <div className={`bg-gradient-to-r ${tierConfig.gradient} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Rank Badge inline */}
                    {index < 3 ? (
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        #{index + 1}
                      </div>
                    ) : (
                      <span className="text-lg">{tierConfig.badge}</span>
                    )}
                    <div>
                      <div className="text-white text-xs font-semibold">{tierConfig.label} Match</div>
                      {project.matchReason && (
                        <p className="text-white/60 text-[10px] line-clamp-1 max-w-[160px]">{project.matchReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">{scorePercent}<span className="text-sm font-bold">%</span></div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <h3 className="text-sm font-bold text-[#404145] line-clamp-2 mb-1 group-hover:text-[#1DBF73] transition-colors">
                  {project.title}
                </h3>

                <p className="text-[#B5B6BA] text-xs mb-3 line-clamp-2">
                  {project.description}
                </p>

                {/* Category Badge */}
                {(project.categoryName || project.category) && (
                  <div className="mb-3">
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-[#F7F7F7] text-[#62646A] rounded capitalize">
                      {(project.categoryName || project.category || '').replace(/-/g, ' ')}
                    </span>
                  </div>
                )}

                {/* Skills */}
                {project.skills && project.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {project.skills.slice(0, 3).map((skill, idx) => (
                      <span key={`${skill}-${idx}`}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                              project.scores?.skill > 0.5 
                                ? 'bg-green-50 text-[#1DBF73] border border-green-100' 
                                : 'bg-[#F7F7F7] text-[#62646A]'
                            }`}>
                        {skill}
                      </span>
                    ))}
                    {project.skills.length > 3 && (
                      <span className="px-2 py-0.5 text-[10px] text-[#B5B6BA] bg-[#F7F7F7] rounded">
                        +{project.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Budget & Deadline */}
                <div className="flex items-center gap-3 text-xs text-[#62646A] mb-3 pb-3 border-b border-[#DADBDD]">
                  <span className="flex items-center gap-1 font-medium text-[#404145]">
                    <CurrencyDollarIcon className="h-3.5 w-3.5 text-[#1DBF73]" />
                    {project.budgetType === 'hourly' 
                      ? `Rs.${project.agreedPrice || project.finalRate || project.budgetAmount}/hr` 
                      : `Rs.${project.agreedPrice || project.finalRate || project.budgetAmount}`}
                  </span>
                  {project.deadline && (
                    <span className="flex items-center gap-1 text-[#B5B6BA]">
                      <ClockIcon className="h-3 w-3" />
                      {new Date(project.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Pipeline Breakdown */}
                {showRecommendations && project.scores && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-3 p-3 bg-[#FAFAFA] rounded-lg border border-[#DADBDD]"
                  >
                    {/* Pipeline flow */}
                    {project.pipelineStages && (
                      <div className="flex items-stretch gap-px mb-3 bg-[#DADBDD] rounded-lg overflow-hidden">
                        {[
                          { label: 'Content', value: project.pipelineStages.contentBased },
                          { label: 'Collab.', value: project.pipelineStages.collaborativeFiltering },
                          { label: 'Final', value: project.pipelineStages.reranked }
                        ].map((stage) => (
                          <div key={stage.label} className="flex-1 text-center py-1.5 bg-white">
                            <div className="text-sm font-bold text-[#404145]">{Math.round(stage.value * 100)}%</div>
                            <div className="text-[9px] text-[#B5B6BA] font-medium">{stage.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Feature bars */}
                    <div className="space-y-1.5">
                      <ProgressBar label="Skills" value={project.scores.skill} color="bg-[#1DBF73]" />
                      <ProgressBar label="Rate Fit" value={project.scores.rate} color="bg-[#00B22D]" />
                      <ProgressBar label="Portfolio" value={project.scores.portfolio} color="bg-teal-500" />
                      <ProgressBar label="Collaborative" value={project.scores.collaborative || 0} color="bg-[#62646A]" />
                    </div>
                  </motion.div>
                )}

                {/* Apply Button */}
                <button 
                  className="w-full bg-[#1DBF73] hover:bg-[#00B22D] text-white py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:opacity-90"
                  onClick={() => setApplicationModal({
                    isOpen: true,
                    project: project
                  })}
                >
                  <StarIcon className="h-4 w-4" />
                  Apply to This Match
                </button>
              </div>
            </motion.div>
          );
          })}
        </div>
      )}

      {/* CTA */}
      {!loadingRecommendations && aiRecommendations.length > 0 && (
        <div className="rounded-xl bg-[#FAFAFA] border border-[#DADBDD] p-6 text-center">
          <h4 className="text-base font-bold text-[#404145] mb-1">Want better matches?</h4>
          <p className="text-[#62646A] mb-4 text-sm">
            Keep your profile updated — our hybrid engine recalculates scores in real-time.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setActiveTab('browse')}>
              Browse All
            </Button>
            <Button variant="primary" onClick={fetchAIRecommendations}>
              Re-run Pipeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
  };

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
