import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../config/api';
import {
  PlusIcon,
  BriefcaseIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProjectApplicationsList from '../components/ProjectApplicationsList';
import ChatInterface from '../components/ChatInterface';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatModal, setChatModal] = useState({
    isOpen: false,
    chatId: null
  });

  const { user, isAuthenticated } = useAuth();

  const tabs = [
    { id: 'projects', name: 'My Projects', icon: BriefcaseIcon },
    { id: 'applications', name: 'Applications', icon: UserIcon },
    { id: 'chats', name: 'Messages', icon: ChatBubbleLeftIcon }
  ];

  const fetchMyProjects = useCallback(async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchMyProjects();
  }, [navigate, isAuthenticated, user, fetchMyProjects]);

  const handleApplicationResponse = async (applicationId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update application');
      }

      const data = await response.json();
      if (status === 'accepted' && data.chatId) {
        toast.success('Application accepted! Chat has been created.');
      }
      fetchMyProjects();
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
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
      in_progress: { variant: 'warning', text: 'In Progress' },
      completed: { variant: 'primary', text: 'Completed' },
      cancelled: { variant: 'error', text: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.open;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const renderProjects = () => {
    if (loading) {
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
            onClick={() => navigate('/post-project')}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Post Your First Project
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project._id} className="relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.title}</h3>
                <p className="text-gray-600 text-sm line-clamp-3 mb-3">{project.description}</p>
              </div>
              {getStatusBadge(project.status)}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  ${project.agreedPrice || project.budgetAmount}${project.agreedPrice ? ' 🔒' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  {project.timeframe}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {project.applicationsCount || 0} applications
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProject(project);
                    setActiveTab('applications');
                  }}
                >
                  <EyeIcon className="h-4 w-4" />
                  View Applications
                </Button>
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
              navigate('/post-project');
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
                ${selectedProject.agreedPrice || selectedProject.budgetAmount} (${selectedProject.budgetType})${selectedProject.agreedPrice ? ' 🔒 Agreed' : ''}
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
      case 'applications':
        return renderApplications();
      case 'chats':
        return renderChats();
      default:
        return renderProjects();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />
      
      {/* Main Content with proper top padding for fixed navbar */}
      <main className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Client Dashboard</h1>
                <p className="text-gray-600 mt-1">Manage your projects and find talented freelancers</p>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate('/post-project')}
                className="flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Post New Project
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm mb-8">
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

      {/* Chat Modal */}
      <ChatInterface
        chatId={chatModal.chatId}
        isOpen={chatModal.isOpen}
        onClose={() => setChatModal({ isOpen: false, chatId: null })}
        user={user}
      />
    </div>
  );
};

export default ClientDashboard;
