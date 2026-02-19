import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../config/api';
import {
  PlusIcon,
  BriefcaseIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProjectApplicationsList from '../components/ProjectApplicationsList';
import ChatInterface from '../components/ChatInterface';
import SimplePostProjectForm from '../components/SimplePostProjectForm';
import ClientTour from '../components/ClientTour';
import FreelancerBrowser from '../components/FreelancerBrowser';
import PushNotificationDebug from '../components/PushNotificationDebug';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [chatModal, setChatModal] = useState({
    isOpen: false,
    chatId: null
  });
  const [runTour, setRunTour] = useState(false);

  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const tabs = [
    { id: 'projects', name: 'My Projects', icon: BriefcaseIcon },
    { id: 'freelancers', name: 'Browse Freelancers', icon: UserGroupIcon },
    { id: 'applications', name: 'Applications', icon: UserIcon },
    { id: 'chats', name: 'Messages', icon: ChatBubbleLeftIcon },
    { id: 'debug', name: 'Push Debug', icon: CurrencyDollarIcon }
  ];

  const fetchMyProjects = useCallback(async () => {
    try {
      setProjectsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.PROJECTS.MY), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      console.log('🎯 Fetched projects:', data);
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Don't redirect if auth is still loading
    if (authLoading) return;
    
    if (!isAuthenticated || !user || user.role !== 'client') {
      console.log('🔒 Redirecting to login:', { isAuthenticated, user: user?.role, authLoading });
      navigate('/login');
      return;
    }
    fetchMyProjects();
  }, [navigate, isAuthenticated, user, fetchMyProjects, authLoading]);

  // Handle tab from URL parameters
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['projects', 'freelancers', 'applications', 'chats', 'debug'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Tour functionality
  useEffect(() => {
    console.log('🎯 Tour useEffect triggered', { user: user?.role, hasSeenTour: localStorage.getItem('client-tour-completed') });
    
    // Check if this is the first time visiting dashboard
    const hasSeenTour = localStorage.getItem('client-tour-completed');
    
    if (!hasSeenTour && user?.role === 'client') {
      console.log('🎯 Starting tour for new client...');
      // Show tour after a short delay to let the page load
      const timer = setTimeout(() => {
        console.log('🎯 Setting runTour to true');
        setRunTour(true);
      }, 2000); // Increased delay
      
      return () => clearTimeout(timer);
    }

    // Set up global function to trigger tour from navbar
    window.startClientTour = () => {
      console.log('🎯 Manual tour trigger from navbar');
      setRunTour(true);
    };

    return () => {
      delete window.startClientTour;
    };
  }, [user]);

  const handleTourEnd = () => {
    console.log('🎯 Tour ended');
    setRunTour(false);
    localStorage.setItem('client-tour-completed', 'true');
  };

  const handleApplicationResponse = async (application, chatCreated) => {
    // The ProjectApplicationsList already handles the API call,
    // so we just need to refresh the project list to reflect status changes
    fetchMyProjects();
    
    // Update selected project status if the response was an accept/award
    if (application?.status === 'awarded' && selectedProject) {
      setSelectedProject(prev => prev ? { ...prev, status: 'awarded' } : prev);
    }
    
    if (chatCreated) {
      toast.success('Project awarded! A chat and workspace have been created.');
    }
  };

  const handleOpenChat = (chatId, freelancer) => {
    console.log('💬 Opening chat:', chatId, 'with freelancer:', freelancer?.fullName);
    setChatModal({
      isOpen: true,
      chatId: chatId
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { variant: 'success', text: 'Open' },
      awarded: { variant: 'info', text: 'Awarded' },
      in_progress: { variant: 'warning', text: 'In Progress' },
      completed: { variant: 'primary', text: 'Completed' },
      cancelled: { variant: 'error', text: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.open;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const renderProjects = () => {
    if (projectsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="text-center py-12">
          <BriefcaseIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">No Projects Yet</h3>
          <p className="text-gray-600 mb-6">
            Start by posting your first project to find talented freelancers.
          </p>
          <Button
            variant="primary"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Post Your First Project
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 project-cards">
        {projects.map((project) => (
          <Card key={project._id} className="relative h-80 flex flex-col overflow-hidden p-6">
            {/* Header Section - Fixed space */}
            <div className="flex justify-between items-start mb-4 h-20">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 project-card-title leading-tight">{project.title}</h3>
                <p className="text-gray-600 text-sm project-card-description leading-tight">{project.description}</p>
              </div>
              <div className="flex-shrink-0 ml-2">
                {getStatusBadge(project.status)}
              </div>
            </div>

            {/* Middle Section - Fixed space */}
            <div className="flex items-center justify-between text-sm text-gray-600 mb-4 h-8 flex-shrink-0">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 flex-shrink-0">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span className="truncate">Rs.{project.agreedPrice || project.budgetAmount}{project.agreedPrice ? ' 🔒' : ''}</span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <ClockIcon className="h-4 w-4" />
                  <span className="truncate">{project.timeframe}</span>
                </span>
              </div>
            </div>

            {/* Spacer to push footer to bottom */}
            <div className="flex-1"></div>

            {/* Footer Section - Always at bottom */}
            <div className="flex justify-between items-center h-10 flex-shrink-0">
              {project.status === 'open' ? (
                <span className="text-sm text-gray-500 flex-shrink-0 truncate">
                  {project.applicationsCount || 0} applications
                </span>
              ) : project.status === 'awarded' || project.status === 'in_progress' ? (
                <span className="text-sm text-green-600 flex-shrink-0 truncate font-medium">
                  Freelancer assigned
                </span>
              ) : project.status === 'completed' ? (
                <span className="text-sm text-purple-600 flex-shrink-0 truncate font-medium">
                  Project finished
                </span>
              ) : (
                <span className="text-sm text-gray-500 flex-shrink-0 truncate">
                  {project.status}
                </span>
              )}
              <div className="flex gap-2 flex-shrink-0">
                {project.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedProject(project);
                      setActiveTab('applications');
                    }}
                    className="whitespace-nowrap text-xs px-2 py-1"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Applications
                  </Button>
                )}
                {(project.status === 'awarded' || project.status === 'in_progress' || project.status === 'completed') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedProject(project);
                      setActiveTab('applications');
                    }}
                    className="whitespace-nowrap text-xs px-2 py-1"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderApplications = () => {
    if (!selectedProject) {
      return (
        <div className="text-center py-12">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Available</h3>
          <p className="text-gray-600 mb-4">
            You need to post a project first before you can view applications.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              setActiveTab('projects');
              setShowForm(true);
            }}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Post a Project
          </Button>
        </div>
      );
    }

    console.log('📱 Rendering applications for project:', selectedProject.title, selectedProject._id);

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Applications for: {selectedProject.title}
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <CurrencyDollarIcon className="h-4 w-4" />
                Rs.{selectedProject.agreedPrice || selectedProject.budgetAmount} ({selectedProject.budgetType}){selectedProject.agreedPrice ? ' 🔒 Agreed' : ''}
              </span>
              {getStatusBadge(selectedProject.status)}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedProject?._id || ''}
              onChange={(e) => {
                const projectId = e.target.value;
                const project = projects.find(p => p._id === projectId);
                setSelectedProject(project);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ProjectApplicationsList
          projectId={selectedProject._id}
          onApplicationResponse={handleApplicationResponse}
          onOpenChat={handleOpenChat}
        />
      </div>
    );
  };

  const renderChats = () => {
    return (
      <div className="text-center py-12">
        <ChatBubbleLeftIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Messages</h3>
        <p className="text-gray-600">
          Your chat conversations with freelancers will appear here.
        </p>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'freelancers':
        return <FreelancerBrowser />;
      case 'applications':
        return renderApplications();
      case 'chats':
        return renderChats();
      case 'debug':
        return <PushNotificationDebug />;
      default:
        return renderProjects();
    }
  };

  const handleProjectSuccess = (newProject) => {
    console.log('Project created successfully:', newProject);
    setShowForm(false);
    fetchMyProjects(); // Refresh the project list
    toast.success('Project posted successfully! Your project is now live and visible to freelancers.');
  };

  // Show loading screen while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />
      
      {/* Main Content with proper top padding for fixed navbar */}
      <main className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8 client-dashboard-welcome">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Client Dashboard</h1>
                <p className="text-gray-600 mt-1">Manage your projects and find talented freelancers</p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 post-project-btn"
              >
                <PlusIcon className="h-5 w-5" />
                Post New Project
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm mb-8 dashboard-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.name}</span>
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
      </main>

      {/* Simplified Post Project Form */}
      {showForm && (
        <SimplePostProjectForm 
          onSuccess={handleProjectSuccess} 
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Chat Modal */}
      <ChatInterface
        chatId={chatModal.chatId}
        isOpen={chatModal.isOpen}
        onClose={() => setChatModal({ isOpen: false, chatId: null })}
        user={user}
      />

      {/* Client Tour */}
      <ClientTour runTour={runTour} onTourEnd={handleTourEnd} />
    </div>
  );
};

export default ClientDashboard;
