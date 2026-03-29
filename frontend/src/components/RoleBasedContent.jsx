import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from '../config/api';
import {
  CodeBracketIcon,
  PaintBrushIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserIcon,
  StarIcon,
  UserGroupIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { Card, Badge, Button } from './ui';
import { useAuth } from '../contexts/AuthContext';
import FreelancerProfileModal from './FreelancerProfileModal';

const RoleBasedContent = ({ onCardClick }) => {
  const { user, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState([]);
  const [guestProjects, setGuestProjects] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllFreelancers, setShowAllFreelancers] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine what to show based on user role
  const showFreelancersForClient = user && user.role === 'client';
  const showProjectsForFreelancer = user && user.role === 'freelancer';
  const showMockDataForGuest = !user;

  // Fetch real projects for freelancers
  const fetchProjects = async () => {
    if (!showProjectsForFreelancer) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${buildApiUrl(API_ENDPOINTS.PROJECTS.BROWSE)}?limit=8&showAllProjects=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real freelancers for clients
  const fetchFreelancers = async (limit = 8) => {
    if (!showFreelancersForClient) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${buildApiUrl(API_ENDPOINTS.FREELANCERS.BROWSE)}?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setFreelancers(data.freelancers);
      }
    } catch (error) {
      console.error('Error fetching freelancers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real projects for guests (no auth)
  const fetchGuestProjects = async () => {
    if (!showMockDataForGuest) return;

    setLoading(true);
    try {
      const response = await fetch(`${buildApiUrl(API_ENDPOINTS.PROJECTS.PUBLIC_BROWSE)}?limit=8`);
      const data = await response.json();
      if (data.success) {
        setGuestProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching guest projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to load all freelancers
  const loadAllFreelancers = async () => {
    setShowAllFreelancers(true);
    await fetchFreelancers(50); // Fetch up to 50 freelancers
  };

  // Modal handlers
  const handleViewFreelancerProfile = (freelancerDisplay) => {
    // Pass the original freelancer data to the modal, not the formatted display data
    const freelancerData = freelancerDisplay.originalData || freelancerDisplay;
    setSelectedFreelancer(freelancerData);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFreelancer(null);
  };

  const handleHireFreelancer = (freelancer) => {
    handleCloseModal();
    // Redirect to client dashboard when hiring
    onCardClick('client-freelancers', freelancer);
  };

  useEffect(() => {
    if (showProjectsForFreelancer) {
      fetchProjects();
    } else if (showFreelancersForClient) {
      fetchFreelancers();
    } else if (showMockDataForGuest) {
      fetchGuestProjects();
    }
  }, [user, showProjectsForFreelancer, showFreelancersForClient, showMockDataForGuest]);

  // Format project data for display
  const formatProjectForDisplay = (project) => {
    // Format budget display
    let budgetDisplay = 'Budget negotiable';
    if (project.budgetAmount) {
      budgetDisplay = project.budgetType === 'hourly' 
        ? `₹${project.budgetAmount}/hr`
        : `₹${project.budgetAmount.toLocaleString()}`;
    } else if (project.budgetMin && project.budgetMax) {
      budgetDisplay = `₹${project.budgetMin.toLocaleString()} - ₹${project.budgetMax.toLocaleString()}`;
    }

    // Category-specific images for better visual representation
    const getCategoryImage = (category, projectTitle = '', skills = []) => {
      // If project already has a custom image, use it
      if (project.image && project.image !== '') {
        return project.image;
      }

      // Determine category from project data
      const title = projectTitle.toLowerCase();
      const allSkills = skills.join(' ').toLowerCase();
      
      // Enhanced category-specific images
      if (category === 'ui-ux-design' || title.includes('ui') || title.includes('ux') || title.includes('design') || allSkills.includes('figma')) {
        return 'https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=400&h=250&fit=crop&crop=center'; // UI/UX Design
      } else if (category === 'frontend-development' || title.includes('frontend') || title.includes('react') || allSkills.includes('react')) {
        return 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&h=250&fit=crop&crop=center'; // Frontend Development
      } else if (category === 'backend-development' || title.includes('backend') || title.includes('api') || allSkills.includes('node.js')) {
        return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=250&fit=crop&crop=center'; // Backend Development
      } else if (category === 'mobile-app-development' || title.includes('mobile') || title.includes('app') || allSkills.includes('react native')) {
        return 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=250&fit=crop&crop=center'; // Mobile Development
      } else if (category === 'full-stack-development' || title.includes('full-stack') || title.includes('fullstack')) {
        return 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=250&fit=crop&crop=center'; // Full Stack
      } else if (category === 'data-science' || title.includes('data') || title.includes('analytics') || allSkills.includes('python')) {
        return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=250&fit=crop&crop=center'; // Data Science
      } else if (category === 'digital-marketing' || title.includes('marketing') || title.includes('seo')) {
        return 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop&crop=center'; // Digital Marketing
      } else if (category === 'graphic-design' || title.includes('graphic') || title.includes('logo') || title.includes('brand')) {
        return 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=250&fit=crop&crop=center'; // Graphic Design
      } else if (category === 'content-writing' || title.includes('content') || title.includes('writing') || title.includes('blog')) {
        return 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=250&fit=crop&crop=center'; // Content Writing
      } else if (title.includes('ecommerce') || title.includes('e-commerce') || title.includes('store')) {
        return 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=250&fit=crop&crop=center'; // E-commerce
      } else if (title.includes('website') || title.includes('web')) {
        return 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=250&fit=crop&crop=center'; // Website Development
      } else {
        // Default tech/development image
        return 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400&h=250&fit=crop&crop=center';
      }
    };

    return {
      id: project._id,
      title: project.title,
      description: project.description,
      budget: budgetDisplay,
      timeline: project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Flexible',
      skills: project.skills || [],
      client: project.client?.fullName || 'Anonymous Client',
      image: getCategoryImage(project.category, project.title, project.skills),
      icon: CodeBracketIcon,
      color: "from-blue-500 to-purple-600"
    };
  };

  // Format freelancer data for display
  const formatFreelancerForDisplay = (freelancer) => {
    // Format rate display - only show "Rate negotiable" if no rate is set
    let rateDisplay = 'Rate negotiable';
    if (freelancer.hourlyRate && freelancer.hourlyRate > 0) {
      rateDisplay = `₹${freelancer.hourlyRate}/hr`;
    } else if (freelancer.profile?.hourlyRate && freelancer.profile.hourlyRate > 0) {
      rateDisplay = `₹${freelancer.profile.hourlyRate}/hr`;
    }

    // Get last 2 portfolio items
    const recentPortfolio = freelancer.portfolio?.slice(0, 2) || [];

    return {
      id: freelancer._id,
      title: freelancer.fullName,
      description: freelancer.bio || 'Experienced professional ready to help with your projects.',
      budget: rateDisplay,
      timeline: `${freelancer.completedProjects || 0} projects completed`,
      skills: freelancer.skills?.slice(0, 4) || [],
      portfolio: recentPortfolio,
      completedProjects: freelancer.completedProjects || 0,
      image: freelancer.profilePicture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=200&fit=crop&crop=center',
      icon: UserGroupIcon,
      color: "from-green-500 to-emerald-600",
      // Store the original freelancer data for the modal
      originalData: freelancer
    };
  };

  // Get the data to display
  let displayData = [];
  let sectionTitle = 'Popular services';
  let sectionSubtitle = 'Most popular services based on recent sales';

  if (showProjectsForFreelancer) {
    displayData = projects.map(formatProjectForDisplay);
    sectionTitle = 'Latest Project Opportunities';
    sectionSubtitle = 'Real projects from clients looking for freelancers like you';
  } else if (showFreelancersForClient) {
    displayData = freelancers.map(formatFreelancerForDisplay);
    sectionTitle = showAllFreelancers ? 'All Available Freelancers' : 'Top Freelancers Available';
    sectionSubtitle = showAllFreelancers 
      ? `Browse ${freelancers.length} skilled professionals ready to work on your projects`
      : 'Connect with skilled professionals ready to work on your projects';
  } else if (guestProjects.length > 0) {
    displayData = guestProjects.map(formatProjectForDisplay);
    sectionTitle = 'Latest Projects';
    sectionSubtitle = 'Real projects from clients hiring right now';
  } else {
    displayData = [];
    sectionTitle = 'Latest Projects';
    sectionSubtitle = 'Real projects from clients hiring right now';
  }

  return (
    <section className="py-20 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            className="heading-2 mb-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {sectionTitle}
          </motion.h2>
          <motion.p
            className="body-large max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {sectionSubtitle}
          </motion.p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-medium">
              No open projects yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 items-stretch ${
            showFreelancersForClient && showAllFreelancers 
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          }`}>
            {displayData.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card
                    variant="default"
                    padding="none"
                    hover={true}
                    clickable={true}
                    onClick={() => {
                      if (showProjectsForFreelancer) {
                        // Redirect to freelancer dashboard with projects
                        onCardClick('freelancer-projects');
                      } else if (showFreelancersForClient && !showAllFreelancers) {
                        // Redirect to client dashboard with freelancers
                        onCardClick('client-freelancers');
                      } else {
                        // Guest user - redirect to appropriate page
                        onCardClick('project');
                      }
                    }}
                    className={`overflow-hidden h-full min-h-[24rem] flex flex-col group relative ${
                      showFreelancersForClient && showAllFreelancers ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    {/* Conditional Image Layout */}
                    {showFreelancersForClient ? (
                      // For freelancers - show profile layout with hover stats
                      <>
                        {/* Main Card Content */}
                        <div className="p-6 flex-1 flex flex-col justify-between">
                          {/* Profile Header */}
                          <div className="flex flex-col items-center text-center mb-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-4 border-white shadow-lg">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <h3 className="heading-4 mb-1">{item.title}</h3>
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-sm text-gray-medium">{item.timeline}</span>
                            </div>
                          </div>

                          {/* Basic Info Always Visible */}
                          <div className="space-y-3">
                            <p className="text-sm text-gray-medium line-clamp-2">{item.description}</p>
                            
                            {/* Show recent portfolio items if available */}
                            {item.portfolio && item.portfolio.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {item.portfolio.map((portfolioItem, idx) => (
                                  <div key={idx} className="aspect-video bg-gray-100 rounded overflow-hidden">
                                    {portfolioItem.image ? (
                                      <img 
                                        src={portfolioItem.image} 
                                        alt={portfolioItem.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-dark/20 flex items-center justify-center">
                                        <BriefcaseIcon className="w-6 h-6 text-primary opacity-50" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="text-center">
                              <Button
                                variant="primary"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFreelancerProfile(item);
                                }}
                                className="w-full"
                              >
                                View Profile
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Hover Overlay with Detailed Stats */}
                        {showAllFreelancers && (
                          <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-center">
                            <div className="text-center space-y-4">
                              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 border-3 border-primary">
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <h3 className="heading-4 text-gray-dark">{item.title}</h3>
                              
                              {/* Detailed Stats */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-medium">Experience:</span>
                                  <span className="text-sm font-medium">{item.timeline}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-medium">Rate:</span>
                                  <span className="text-sm font-bold text-primary">{item.budget}</span>
                                </div>
                              </div>

                              {/* Skills */}
                              <div className="pt-2">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {item.skills.slice(0, 3).map((skill, skillIndex) => (
                                    <Badge
                                      key={skillIndex}
                                      variant="primary"
                                      size="small"
                                    >
                                      {skill}
                                    </Badge>
                                  ))}
                                  {item.skills.length > 3 && (
                                    <Badge variant="secondary" size="small">
                                      +{item.skills.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Action Button */}
                              <Button
                                variant="primary"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFreelancerProfile(item);
                                }}
                                className="w-full mt-4"
                              >
                                View Profile
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // For projects - show banner image
                      <>
                        <div className="h-40 overflow-hidden relative flex-shrink-0">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Client/Project Info */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                <UserIcon className="w-4 h-4 text-gray-600" />
                              </div>
                              <span className="text-sm font-medium text-gray-dark">{item.client}</span>
                              <div className="ml-auto flex items-center gap-1">
                                <StarIcon className="w-4 h-4 text-warning fill-current" />
                                <span className="text-xs text-gray-medium">4.9 (127)</span>
                              </div>
                            </div>
                            {/* Title */}
                            <h3 className="heading-4 mb-2 line-clamp-2">{item.title}</h3>
                            {/* Description */}
                            <p className="body-small text-gray-medium mb-3 line-clamp-2">
                              {item.description}
                            </p>
                            {/* Skills */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {item.skills.slice(0, 2).map((skill, skillIndex) => (
                                <Badge
                                  key={skillIndex}
                                  variant="secondary"
                                  size="small"
                                >
                                  {skill}
                                </Badge>
                              ))}
                              {item.skills.length > 2 && (
                                <Badge variant="secondary" size="small">
                                  +{item.skills.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1 text-gray-medium">
                              <ClockIcon className="w-4 h-4" />
                              <span className="text-xs">{item.timeline}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-medium">Budget</div>
                              <div className="text-lg font-bold text-gray-dark">{item.budget}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
          >
            <Button
              variant="outline"
              size="large"
              onClick={() => {
                if (showProjectsForFreelancer) {
                  onCardClick('freelancer-dashboard');
                } else if (showFreelancersForClient && !showAllFreelancers) {
                  loadAllFreelancers();
                } else if (showFreelancersForClient && showAllFreelancers) {
                  onCardClick('client-dashboard');
                } else {
                  onCardClick('browse');
                }
              }}
            >
              {showProjectsForFreelancer ? 'Browse All Projects' : 
               showFreelancersForClient ? (showAllFreelancers ? 'Go to Dashboard' : 'Browse All Freelancers') : 
               'Browse All Services'}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Freelancer Profile Modal */}
      <FreelancerProfileModal
        freelancer={selectedFreelancer}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onHireFreelancer={handleHireFreelancer}
      />
    </section>
  );
};

export default RoleBasedContent;