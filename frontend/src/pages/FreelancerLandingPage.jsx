import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FreelancerDashboard from '../components/FreelancerDashboard';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

const FreelancerLandingPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('browse');
  const dashboardRef = useRef(null);

  useEffect(() => {
    // Wait for auth loading to complete before making redirect decisions
    if (loading) return;
    
    // Protect route - only authenticated freelancers can access
    if (!isAuthenticated || !user || user.role !== 'freelancer') {
      navigate('/login');
      return;
    }
  }, [navigate, user, isAuthenticated, loading]);

  const handleTabNavigation = (tabId) => {
    setActiveTab(tabId);
    // Smooth scroll to dashboard
    if (dashboardRef.current) {
      dashboardRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Show loading while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="freelancer-landing-page bg-bg-secondary">
      <Navbar key={`navbar-${user?.id || 'anonymous'}-${isAuthenticated}`} />
      <div ref={dashboardRef}>
        <FreelancerDashboard 
          externalActiveTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>
      <Footer />
    </div>
  );
};

export default FreelancerLandingPage;
