# WebSphere - Freelancer Marketplace Platform

A comprehensive freelancer marketplace platform built with React.js frontend and Node.js backend, featuring role-based authentication, project management, and administrative controls.

## 📚 Documentation

- Complete end-to-end system doc: [COMPLETE_SYSTEM_DOCUMENTATION.md](COMPLETE_SYSTEM_DOCUMENTATION.md)
- Frontend guide: [frontend/README.md](frontend/README.md)
- Dev scripts & utilities: [DEV_SCRIPTS.md](DEV_SCRIPTS.md)
- Push notifications: [PUSH_NOTIFICATIONS_GUIDE.md](PUSH_NOTIFICATIONS_GUIDE.md)
- Timeline/audit trail: [TIMELINE_FEATURE.md](TIMELINE_FEATURE.md)
- Frontend API migration notes: [FRONTEND_API_MIGRATION.md](FRONTEND_API_MIGRATION.md)

## 🚀 Tech Stack

### Frontend Technologies
- **React.js 18**: Modern UI library with hooks and functional components
- **Vite**: Lightning-fast build tool and development server
- **React Router DOM**: Client-side routing and navigation
- **React Hot Toast**: Elegant toast notifications with custom close buttons
- **Framer Motion**: Smooth animations and micro-interactions
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Google OAuth**: Secure authentication with Google accounts
- **Axios**: HTTP client for API communication
- **React Hook Form**: Performant form handling with validation

### Backend Technologies
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Minimal web framework for building APIs
- **MongoDB**: NoSQL database for flexible data storage
- **Mongoose**: Object Document Mapper (ODM) for MongoDB
- **JWT (JSON Web Tokens)**: Stateless authentication mechanism
- **bcryptjs**: Password hashing and security
- **Multer**: File upload middleware
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security middleware for Express apps

### Third-Party Services & APIs

#### 🌥️ Cloudinary API
**Purpose**: Media management and file storage
**Why It's Important**:
- **Scalable Storage**: Handles unlimited file uploads without server storage limits
- **Image Optimization**: Automatic image compression and format conversion
- **CDN Delivery**: Global content delivery for fast file access
- **Transformation**: On-the-fly image resizing and effects
- **Security**: Secure file uploads with access controls

**Implementation**:
```javascript
// Cloudinary configuration for file uploads
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

#### 📧 Brevo SMTP API (formerly Sendinblue)
**Purpose**: Professional email service for transactional emails
**Why It's Important**:
- **Deliverability**: High email delivery rates to avoid spam folders
- **Template System**: Rich HTML email templates with responsive design
- **Analytics**: Email open rates, click tracking, and delivery statistics
- **Scalability**: Handles bulk email sending for user notifications
- **Professional Appearance**: Branded emails that build trust

**Features Used**:
- User deactivation notifications with detailed statistics
- Email verification for new accounts
- Password reset emails with secure tokens
- Welcome emails for new users
- Administrative notifications

#### 🔐 Google OAuth 2.0 API
**Purpose**: Secure authentication and user management
**Why It's Important**:
- **User Experience**: One-click login without password management
- **Security**: OAuth 2.0 standard with Google's security infrastructure
- **Trust**: Users trust Google authentication over custom systems
- **Reduced Friction**: Eliminates registration barriers
- **Profile Integration**: Access to Google profile information

**Implementation Flow**:
1. User clicks "Sign in with Google"
2. Redirects to Google OAuth consent screen
3. Google returns authorization code
4. Backend exchanges code for access token
5. Retrieves user profile information
6. Creates/updates user in database
7. Issues JWT token for session management

#### 🗄️ MongoDB Atlas
**Purpose**: Cloud-hosted NoSQL database
**Why It's Important**:
- **Scalability**: Auto-scaling based on application needs
- **Reliability**: Built-in replication and backup systems
- **Global Distribution**: Multi-region data centers for low latency
- **Security**: Enterprise-grade security with encryption
- **Analytics**: Built-in performance monitoring and insights

**Data Models**:
```javascript
// User schema with role-based access
const userSchema = {
  email: String,
  role: ['client', 'freelancer', 'admin'],
  profile: {
    skills: [String],
    bio: String,
    rating: Number,
    completedProjects: Number
  },
  isActive: Boolean,
  createdAt: Date
};
```

## 🏗️ System Architecture

### Microservices Approach
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React)       │◄──►│   (Express)     │◄──►│   (MongoDB)     │
│   Port: 5174    │    │   Port: 5000    │    │   Atlas Cloud   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Assets │    │   File Storage  │    │   Email Service │
│   (Vercel/CDN)  │    │   (Cloudinary)  │    │   (Brevo SMTP)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### API Architecture
**RESTful API Design** with consistent endpoints:
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - User authentication
- `GET /api/projects` - List projects with filtering
- `POST /api/projects` - Create new project
- `PUT /api/admin/users/:id/deactivate` - Admin actions

### Security Architecture
```
┌─────────────────┐
│   JWT Tokens    │ ─── Stateless authentication
├─────────────────┤
│   CORS Policy   │ ─── Cross-origin protection
├─────────────────┤
│   Rate Limiting │ ─── API abuse prevention
├─────────────────┤
│   Input Validation │ ─── XSS/injection protection
├─────────────────┤
│   Password Hashing │ ─── bcrypt encryption
└─────────────────┘
```

## 🌟 Features Overview

### 🔐 Authentication System
- **Multi-role Authentication**: Client, Freelancer, and Admin roles
- **Google OAuth Integration**: Sign in with Google support
- **JWT Token Authentication**: Secure API access
- **Session Management**: Persistent login states
- **Email Verification**: Account verification via email
- **Password Recovery**: Forgot password with email reset

### 👤 User Management
- **Role-based Access Control**: Different dashboards for each user type
- **Profile Management**: Complete profile setup for freelancers
- **Skill Extraction**: Auto-tagging of skills from bio text
- **Account Deactivation**: Admin can deactivate/reactivate users
- **Rating System**: User rating tracking and display

### 📋 Project Management
- **Project Categories**: 8 preset categories with visual images
- **Rich Project Creation**: Title, description, budget, deadline, skills
- **File Attachments**: Cloudinary integration for file uploads
- **Project Browsing**: Search and filter projects by skills, budget
- **Visual Project Cards**: Category-based preset images

### 🛠️ Admin Dashboard
- **User Management**: View, deactivate, reactivate users
- **Email Notifications**: Professional email templates for user communications
- **Rating-based Actions**: Deactivate users based on rating thresholds
- **Testing Tools**: Create test freelancer accounts
- **Analytics**: User statistics and system overview

### 📧 Email System
- **Brevo SMTP Integration**: Professional email service
- **Template System**: Reusable HTML email templates
- **Deactivation Notifications**: Detailed emails with user statistics
- **Responsive Design**: Mobile-friendly email templates

### 🎨 UI/UX Features
- **Toast Notifications**: Custom toast system with close buttons
- **Responsive Design**: Mobile-first responsive layout
- **Framer Motion**: Smooth animations and transitions
- **Category Selection**: Visual project category picker
- **Image Integration**: Preset images for different project types

## 🏗️ Project Structure

### Frontend (React.js)
```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── AuthForm.jsx     # Login/Register form
│   │   ├── Navbar.jsx       # Navigation with auth state
│   │   ├── PostProjectForm.jsx # Project creation with categories
│   │   ├── UserManagement.jsx # Admin user management
│   │   └── ui/              # Base UI components
│   ├── pages/               # Route pages
│   │   ├── AdminDashboard.jsx
│   │   ├── ClientLandingPage.jsx
│   │   ├── FreelancerLandingPage.jsx
│   │   └── FreelancerDashboard.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx  # Global authentication state
│   ├── styles/
│   │   └── toast.css        # Custom toast styling
│   └── utils/
│       └── validation.js    # Form validation utilities
```

### Backend (Node.js + Express)
```
backend/
├── models/
│   ├── User.js              # User schema with roles and profiles
│   ├── Project.js           # Project schema with categories
│   └── PendingUser.js       # Email verification queue
├── routes/
│   ├── auth.js              # Authentication endpoints
│   ├── admin.js             # Admin-only operations
│   ├── profile.js           # User profile management
│   └── project.js           # Project CRUD operations
├── middlewares/
│   ├── auth.js              # JWT authentication middleware
│   └── upload.js            # File upload handling
├── utils/
│   ├── brevoEmailService.js # Email service integration
│   ├── emailTemplates.js    # HTML email templates
│   ├── cloudinaryConfig.js  # File storage configuration
│   └── skillExtractor.js    # Auto skill extraction
└── scripts/
    └── createAdmin.js       # Admin user creation script
```

### User Collection
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed with bcrypt),
  role: String (enum: ['client', 'freelancer', 'admin']),
  isActive: Boolean (default: true),
  googleId: String (for OAuth users),
  profile: {
    firstName: String,
    lastName: String,
    bio: String,
    skills: [String],
    hourlyRate: Number,
    location: String,
    profilePicture: String (Cloudinary URL),
    portfolio: [String] (Cloudinary URLs),
    rating: Number (default: 5.0),
    completedProjects: Number (default: 0),
    totalEarnings: Number (default: 0)
  },
  emailVerified: Boolean (default: false),
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Project Collection
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String (required),
  category: String (enum: [
    'UI/UX Design',
    'Frontend Development', 
    'Backend Development',
    'Mobile App Development',
    'Full Stack Development',
    'Data Science & Analytics',
    'Digital Marketing',
    'Graphic Design'
  ]),
  budget: {
    min: Number,
    max: Number,
    type: String (enum: ['fixed', 'hourly'])
  },
  deadline: Date,
  skills: [String],
  attachments: [String] (Cloudinary URLs),
  client: ObjectId (ref: 'User'),
  status: String (enum: ['open', 'in-progress', 'completed', 'cancelled']),
  applications: [{
    freelancer: ObjectId (ref: 'User'),
    coverLetter: String,
    proposedRate: Number,
    appliedAt: Date,
    status: String (enum: ['pending', 'accepted', 'rejected'])
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### PendingUser Collection (Email Verification)
```javascript
{
  _id: ObjectId,
  email: String,
  hashedPassword: String,
  role: String,
  verificationToken: String,
  createdAt: Date,
  expiresAt: Date (TTL index for auto-deletion)
}
```

## 🔧 API Endpoints Documentation

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/google` | Google OAuth login | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/verify-email` | Verify email address | No |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password | No |
| POST | `/api/auth/logout` | User logout | Yes |

### User Profile Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/profile/me` | Get user profile | Yes |
| PUT | `/api/profile/update` | Update profile | Yes |
| POST | `/api/profile/upload-avatar` | Upload profile picture | Yes |
| POST | `/api/profile/upload-portfolio` | Upload portfolio files | Yes |

### Project Management Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/projects` | List projects with filters | No |
| POST | `/api/projects` | Create new project | Yes (Client) |
| GET | `/api/projects/:id` | Get project details | No |
| PUT | `/api/projects/:id` | Update project | Yes (Owner) |
| DELETE | `/api/projects/:id` | Delete project | Yes (Owner) |
| POST | `/api/projects/:id/apply` | Apply to project | Yes (Freelancer) |
| GET | `/api/projects/my-projects` | Get user's projects | Yes |

### Admin Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/users` | List all users | Yes (Admin) |
| PUT | `/api/admin/users/:id/deactivate` | Deactivate user | Yes (Admin) |
| PUT | `/api/admin/users/:id/activate` | Activate user | Yes (Admin) |
| GET | `/api/admin/stats` | System statistics | Yes (Admin) |
| POST | `/api/admin/test-freelancers` | Create test data | Yes (Admin) |

## 🛠️ Development Workflow

### Environment Setup
```bash
# Development environments
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5174

# Production environments  
NODE_ENV=production
PORT=process.env.PORT
FRONTEND_URL=https://websphere-app.vercel.app
```

### Code Quality Tools
- **ESLint**: JavaScript linting and code quality
- **Prettier**: Code formatting and consistency
- **Husky**: Git hooks for pre-commit validation
- **PostCSS**: CSS processing and optimization
- **Tailwind CSS**: Utility-first styling approach

### Build Process
```bash
# Frontend build (Vite)
npm run build          # Production build
npm run dev           # Development server
npm run preview       # Preview production build

# Backend (Node.js)
npm start             # Production server
npm run dev           # Development with nodemon
```

## 🔐 Security Implementation

### Authentication Security
- **JWT Tokens**: 24-hour expiration with secure httpOnly cookies
- **Password Hashing**: bcrypt with salt rounds (12)
- **OAuth Integration**: Google OAuth 2.0 with secure token exchange
- **Session Management**: Stateless authentication with token refresh

### Data Protection
- **Input Validation**: Joi schema validation for all endpoints
- **SQL Injection Protection**: MongoDB parameterized queries
- **XSS Prevention**: Content sanitization and CSP headers
- **CORS Configuration**: Restricted cross-origin access
- **Rate Limiting**: API endpoint protection against abuse

### File Upload Security
- **File Type Validation**: Whitelist of allowed file extensions
- **Size Limits**: Maximum file size restrictions
- **Virus Scanning**: Cloudinary automatic malware detection
- **Access Controls**: Signed URLs for private file access

## 📈 Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Dynamic imports for route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Cloudinary automatic optimization
- **Caching Strategy**: Browser caching for static assets
- **Bundle Analysis**: Webpack bundle analyzer for optimization

### Backend Optimizations
- **Database Indexing**: MongoDB compound indexes for queries
- **Connection Pooling**: MongoDB connection reuse
- **Compression**: Gzip compression for API responses
- **Caching**: Redis caching for frequently accessed data
- **Query Optimization**: Aggregation pipelines for complex queries

### CDN Integration
- **Cloudinary CDN**: Global image and file delivery
- **Static Assets**: CDN hosting for JavaScript/CSS bundles
- **Geographic Distribution**: Multi-region content delivery

## 🧪 Testing Strategy

### Unit Testing
```bash
# Frontend testing (React Testing Library)
npm run test          # Run test suite
npm run test:coverage # Generate coverage report

# Backend testing (Jest + Supertest)
npm run test:unit     # Unit tests
npm run test:integration # API integration tests
```

### Testing Tools
- **Frontend**: React Testing Library, Jest, MSW (Mock Service Worker)
- **Backend**: Jest, Supertest, MongoDB Memory Server
- **E2E Testing**: Cypress for end-to-end user flows
- **Load Testing**: Artillery for performance testing

## 🚀 Deployment Architecture

### Frontend Deployment (Vercel)
```yaml
# vercel.json configuration
{
  "builds": [
    {
      "src": "dist/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Backend Deployment (Railway/Heroku)
```yaml
# Dockerfile for containerized deployment
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

### Database Deployment (MongoDB Atlas)
- **Cluster Configuration**: M10 cluster for production workloads
- **Backup Strategy**: Automated daily backups with point-in-time recovery
- **Monitoring**: Real-time performance monitoring and alerts
- **Security**: Network access lists and database authentication

## 📊 Monitoring and Analytics

### Application Monitoring
- **Error Tracking**: Sentry integration for error monitoring
- **Performance Monitoring**: New Relic for application performance
- **Uptime Monitoring**: Pingdom for service availability
- **Log Management**: Winston logging with log rotation

### Business Analytics
- **User Analytics**: Google Analytics for user behavior
- **Email Analytics**: Brevo dashboard for email performance
- **Database Analytics**: MongoDB Atlas performance insights
- **API Analytics**: Custom middleware for endpoint usage tracking

## 🌍 Scalability Considerations

### Horizontal Scaling
- **Load Balancing**: Multiple server instances behind load balancer
- **Database Sharding**: MongoDB horizontal partitioning
- **CDN Distribution**: Global content delivery network
- **Microservices**: Service separation for independent scaling

### Vertical Scaling
- **Server Resources**: CPU and memory optimization
- **Database Performance**: Index optimization and query tuning
- **Caching Layers**: Redis for session and data caching
- **Asset Optimization**: Image compression and lazy loading

## 🏗️ Technical Architecture

### Microservices Approach
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React)       │◄──►│   (Express)     │◄──►│   (MongoDB)     │
│   Port: 5174    │    │   Port: 5000    │    │   Atlas Cloud   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Assets │    │   File Storage  │    │   Email Service │
│   (Vercel/CDN)  │    │   (Cloudinary)  │    │   (Brevo SMTP)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### API Architecture
**RESTful API Design** with consistent endpoints:
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - User authentication
- `GET /api/projects` - List projects with filtering
- `POST /api/projects` - Create new project
- `PUT /api/admin/users/:id/deactivate` - Admin actions

### Security Architecture
```
┌─────────────────┐
│   JWT Tokens    │ ─── Stateless authentication
├─────────────────┤
│   CORS Policy   │ ─── Cross-origin protection
├─────────────────┤
│   Rate Limiting │ ─── API abuse prevention
├─────────────────┤
│   Input Validation │ ─── XSS/injection protection
├─────────────────┤
│   Password Hashing │ ─── bcrypt encryption
└─────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account
- Cloudinary account (for file uploads)
- Brevo account (for email service)
- Google OAuth credentials

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/jeevanjiji/websphere.git
cd websphere-app
```

2. **Install dependencies**
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. **Environment Configuration**
Create a `.env` file in the backend directory:
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/websphere

# JWT
JWT_SECRET=your-jwt-secret-key

# Email Service (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_SMTP_USER=your-smtp-user@smtp-brevo.com
BREVO_SMTP_PASS=your-smtp-password

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Frontend URL
FRONTEND_URL=http://localhost:5174
```

4. **Start the application**
```bash
# Start backend server (from backend directory)
node server.js

# Start frontend development server (from frontend directory)
npm run dev
```

5. **Create admin user**
```bash
# From backend directory
node scripts/createAdmin.js
```

## 📱 User Flows

### 1. Client Flow
1. **Registration/Login**: Sign up as client via email or Google
2. **Project Creation**: 
   - Select from 8 visual project categories
   - Add project details (title, description, budget, deadline)
   - Upload attachments via Cloudinary
   - Auto-populated skills based on category
3. **Project Management**: View posted projects and manage applications
4. **Dashboard**: Overview of posted projects and freelancer responses

### 2. Freelancer Flow
1. **Registration/Login**: Sign up as freelancer via email or Google
2. **Profile Setup**: 
   - Complete profile with bio, skills, experience
   - Upload profile picture and portfolio
   - Auto skill extraction from bio text
3. **Project Browsing**: 
   - Browse projects with category images
   - Search by skills, budget, deadline
   - Apply to relevant projects
4. **Dashboard**: View applied projects and manage applications

### 3. Admin Flow
1. **Admin Login**: Secure admin authentication
2. **User Management**:
   - View all users with statistics
   - Deactivate/reactivate users based on ratings
   - Send professional deactivation emails
   - Bulk operations for testing
3. **System Analytics**: Overview of platform usage and statistics

## 🎨 Project Categories with Preset Images

| Category | Description | Preset Image |
|----------|-------------|--------------|
| UI/UX Design | Interface and user experience design | Modern design workspace |
| Frontend Development | Client-side web development | Code and development |
| Backend Development | Server-side development and APIs | Server infrastructure |
| Mobile App Development | iOS and Android app development | Mobile devices |
| Full Stack Development | End-to-end web applications | Complete dev environment |
| Data Science & Analytics | Machine learning and data analysis | Data visualization |
| Digital Marketing | SEO, social media, online marketing | Marketing graphics |
| Graphic Design | Visual design and branding | Creative design tools |

## 📧 Email System Features

### Template Types
- **Deactivation Notifications**: Professional emails with user statistics
- **Welcome Emails**: New user onboarding
- **Verification Emails**: Account confirmation
- **Password Reset**: Secure password recovery

### Email Content
- Responsive HTML design
- User statistics (rating, projects completed)
- Professional branding
- Clear call-to-action buttons
- Mobile-optimized layout

## 🔧 Advanced Features

### Authentication State Management
- **Immediate Navbar Updates**: Real-time authentication state changes
- **flushSync Integration**: Ensures immediate UI updates after login
- **Dynamic Component Keys**: Forces re-rendering when auth state changes
- **Google OAuth Integration**: Seamless Google login with state management

### Project Management
- **Category-based Images**: Visual project representation
- **Skill Auto-population**: Smart skill suggestions based on category
- **File Upload System**: Cloudinary integration for attachments
- **Search and Filtering**: Advanced project discovery

### Admin Tools
- **User Deactivation System**: Rating-based user management
- **Email Notification System**: Professional communication templates
- **Testing Environment**: Tools for creating test data
- **Analytics Dashboard**: System usage insights

## 🛡️ Security Features

- **JWT Authentication**: Secure API access tokens
- **Role-based Access Control**: Granular permissions
- **Input Validation**: Server-side data validation
- **CORS Configuration**: Secure cross-origin requests
- **Password Hashing**: bcrypt password security
- **Rate Limiting**: API abuse prevention

## 🧪 Testing

### Test Data Creation
```bash
# Create test freelancer accounts
node backend/scripts/createTestFreelancers.js

# Create admin user
node backend/scripts/createAdmin.js
```

### Test Credentials
- **Admin**: admin@admin.com / admin123
- **Test Users**: Generated via scripts

## 📦 Deployment

### Frontend (Vercel/Netlify)
1. Build the React application
2. Configure environment variables
3. Deploy to static hosting service

### Backend (Heroku/Railway)
1. Configure production environment variables
2. Set up MongoDB Atlas connection
3. Deploy to cloud platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@websphere.com or join our Slack channel.

## 📈 Future Enhancements

- [ ] Real-time chat system
- [x] Payment integration (Razorpay - Full Support: Cards, UPI, Net Banking, Wallets, EMI, Pay Later)
- [ ] Advanced search filters
- [ ] Mobile application
- [ ] API rate limiting
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Push notifications

---

**Built with ❤️ by the WebSphere Team**

*Last updated: August 25, 2025*
