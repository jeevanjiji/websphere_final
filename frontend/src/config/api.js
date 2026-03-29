// API Configuration
// This file centralizes all API-related configuration for the frontend

// Get the base URL from environment variables
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// WebSocket URL - replace http/https with ws/wss
export const WS_BASE_URL = API_BASE_URL.replace(/^https?/, API_BASE_URL.startsWith('https') ? 'wss' : 'ws');

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    SESSION: '/api/auth/session',
    GOOGLE: '/api/auth/google',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    VERIFY_EMAIL: '/api/auth/verify-email',
    RESEND_VERIFICATION: '/api/auth/resend-verification',
    FREELANCER_AUTO_TAG: '/api/auth/freelancer/auto-tag-bio'
  },

  // Profile endpoints
  PROFILE: {
    BASE: '/api/profile',
    BASIC_INFO: '/api/profile/basic-info',
    PICTURE: '/api/profile/picture'
  },

  // Projects endpoints
  PROJECTS: {
    BROWSE: '/api/projects/browse',
    PUBLIC_BROWSE: '/api/projects/public',
    MY: '/api/projects/my'
  },

  // Applications endpoints
  APPLICATIONS: {
    BASE: '/api/applications',
    MY: '/api/applications/my',
    PROJECT: (projectId) => `/api/applications/project/${projectId}`,
    STATUS: (applicationId) => `/api/applications/${applicationId}/status`,
    AWARD: (applicationId) => `/api/applications/${applicationId}/award`
  },

  // Workspaces endpoints
  WORKSPACES: {
    PROJECT: (projectId) => `/api/workspaces/project/${projectId}`,
    MILESTONES: (workspaceId) => `/api/workspaces/${workspaceId}/milestones`,
    MILESTONE_BY_ID: (workspaceId, milestoneId) => `/api/workspaces/${workspaceId}/milestones/${milestoneId}`,
    MILESTONES_BULK: (workspaceId) => `/api/workspaces/${workspaceId}/milestones/bulk`,
    DELIVERABLES: (workspaceId) => `/api/workspaces/${workspaceId}/deliverables`,
    FILES: (workspaceId) => `/api/workspaces/${workspaceId}/files`,
    PAYMENTS: (workspaceId) => `/api/workspaces/${workspaceId}/payments`
  },

  // Files endpoints
  FILES: {
    DOWNLOAD: (workspaceId, fileId) => `/api/files/workspaces/${workspaceId}/download/${fileId}`
  },

  // Chats endpoints
  CHATS: {
    BASE: '/api/chats',
    BY_ID: (chatId) => `/api/chats/${chatId}`,
    MESSAGES: (chatId) => `/api/chats/${chatId}/messages`,
    APPLICATION: (applicationId) => `/api/chats/application/${applicationId}`
  },

  // Notifications endpoints
  NOTIFICATIONS: {
    LIST: '/api/notifications/list',
    VAPID_KEY: '/api/notifications/vapid-public-key',
    SUBSCRIBE: '/api/notifications/subscribe',
    SEND: '/api/notifications/send',
    PREFERENCES: '/api/notifications/preferences',
    SHOULD_PROMPT: '/api/notifications/should-prompt',
    READ: (notificationId) => `/api/notifications/${notificationId}/read`,
    READ_ALL: '/api/notifications/read-all'
  },

  // Payments endpoints
  PAYMENTS: {
    ESCROW_SUBMIT: '/api/payments/escrow/submit-deliverable',
    ESCROW_CREATE: '/api/payments/escrow/create',
    ESCROW_VERIFY: '/api/payments/escrow/verify',
    MILESTONE_FAILURE: '/api/payments/milestone/failure',
    WORKSPACE_HISTORY: (workspaceId) => `/api/payments/workspace/${workspaceId}/history`
  },

  // Admin endpoints
  ADMIN: {
    DASHBOARD_STATS: '/api/admin/dashboard-stats',
    USERS: '/api/admin/users',
    USERS_DELETED: '/api/admin/users/deleted',
    USER_SOFT_DELETE: (userId) => `/api/admin/users/${userId}/soft-delete`,
    USER_HARD_DELETE: (userId) => `/api/admin/users/${userId}/hard-delete`,
    USER_DEACTIVATE: (userId) => `/api/admin/users/${userId}/deactivate`,
    USER_REACTIVATE: (userId) => `/api/admin/users/${userId}/reactivate`,
    USER_RESTORE: (userId) => `/api/admin/users/${userId}/restore`,
    USERS_DELETE_ALL_FREELANCERS: '/api/admin/users/freelancers/delete-all-for-testing',
    PROJECTS: '/api/admin/projects',
    ESCROWS: '/api/admin/escrows',
    ESCROWS_STATS: '/api/admin/escrows/stats',
    ESCROW_BY_ID: (escrowId) => `/api/admin/escrows/${escrowId}`,
    ESCROW_RELEASE: (escrowId) => `/api/admin/escrows/${escrowId}/release`,
    ESCROW_RESOLVE: (escrowId) => `/api/admin/escrows/${escrowId}/resolve-dispute`,
    ESCROW_AUTO_RELEASE: '/api/admin/escrows/auto-release'
  },

  // Matching endpoints
  MATCHING: {
    PROJECTS: (userId) => `/api/matching/projects/${userId}`
  }
};

// Helper function to build complete URL
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function for WebSocket URLs
export const buildWsUrl = (endpoint) => {
  return `${WS_BASE_URL}${endpoint}`;
};

// Default fetch options
export const defaultFetchOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    ...defaultFetchOptions.headers,
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export default {
  API_BASE_URL,
  WS_BASE_URL,
  API_ENDPOINTS,
  buildApiUrl,
  buildWsUrl,
  defaultFetchOptions,
  getAuthHeaders
};