# CareerPath - AI-Powered Career Development Platform

An intelligent career guidance platform that helps students and fresh graduates discover job opportunities, identify skill gaps, and access personalized learning resources to advance their careers.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [External APIs & Services](#external-apis--services)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Performance Optimizations](#performance-optimizations)

---

## 🎯 Overview

CareerPath is a comprehensive career development platform that leverages AI and data analytics to:

- Match users with suitable job opportunities based on their skills and preferences
- Identify skill gaps between user profiles and job requirements
- Recommend personalized learning resources to bridge skill gaps
- Generate AI-powered career roadmaps using Google's Gemini AI
- Provide interactive chatbot assistance for career guidance
- Track job applications and learning progress

Aligned with **UN Sustainable Development Goal 8** (Decent Work and Economic Growth), this platform empowers youth with the tools and resources needed for successful career development.

---

## ✨ Features

### Core Features

✅ **User Authentication & Profile Management**

- Firebase Authentication (Email/Password, Google OAuth)
- Comprehensive user profiles with skills, tools, experience level, and career preferences
- Profile completion tracking

✅ **Intelligent Job Matching**

- Algorithm-based job matching using multi-factor scoring:
  - Skills compatibility (50% weight)
  - Experience level alignment (20% weight)
  - Career track matching (20% weight)
  - Location preferences (10% weight)
- Real-time match score calculation
- Job application tracking

✅ **Skill Gap Analysis**

- Automated identification of missing skills for target jobs
- Personalized learning resource recommendations
- Multi-source learning platform integration (Coursera, Udemy, YouTube, etc.)
- Free and paid resource filtering
- Search and filter functionality

✅ **AI-Powered Career Roadmap**

- Google Gemini AI integration for personalized career path generation
- Context-aware recommendations based on user profile and career goals
- Step-by-step learning paths with time estimates
- Interactive roadmap visualization

✅ **Learning Resource Management**

- Curated learning resources mapped to specific skills
- Platform, difficulty level, and cost filtering
- Direct links to external learning platforms
- Progress tracking (enrolled courses)

✅ **Admin Dashboard**

- Job posting management
- Course management
- User activity monitoring
- Application tracking

---

## 🌐 External APIs & Services

### 1. **Firebase (Google Cloud Platform)**

**Service:** Backend-as-a-Service (BaaS)

**APIs Used:**

- **Firebase Authentication API**

  - Email/Password authentication
  - Google OAuth 2.0 sign-in
  - User session management
  - Documentation: https://firebase.google.com/docs/auth

- **Cloud Firestore API**
  - NoSQL document database
  - Real-time data synchronization
  - Collections: `users`, `jobs`, `learningResources`, `applications`, `Courses`, `chatbot`
  - Documentation: https://firebase.google.com/docs/firestore

**Configuration Required:**

```javascript
// Firebase Config (frontend/src/firebase.js)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

**Setup Instructions:**

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication (Email/Password and Google providers)
3. Create a Firestore database
4. Copy configuration to your `.env` file
5. Set up Firestore security rules and indexes

**Rate Limits:**

- Spark (Free) Plan: 50,000 reads/day, 20,000 writes/day
- Authentication: 10,000 verifications/month (free tier)

---

### 2. **Google Gemini AI (Google Cloud AI)**

**Service:** Large Language Model API

**API Used:**

- **Gemini 1.5 Pro API**
  - Natural language understanding
  - Context-aware responses
  - Career roadmap generation
  - Chat assistance

**Endpoints:**

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
```

**Documentation:** https://ai.google.dev/docs

**Configuration Required:**

```javascript
// Backend (.env)
GEMINI_API_KEY = AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8;

// Frontend (.env)
VITE_GEMINI_API_KEY = AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8;
```

**Features Used:**

1. **Career Roadmap Generation** (`frontend/src/pages/CareerRoadmap.jsx`)

   - User profile analysis
   - Goal-based learning path creation
   - Time estimation for skill acquisition
   - Resource recommendations

2. **Chat Assistance** (`frontend/src/pages/Chatassistance.jsx`, `backend/main.py`)
   - Career guidance chatbot
   - Context-aware conversations
   - History tracking

**Setup Instructions:**

1. Visit https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add to environment variables (both backend and frontend)

**Rate Limits:**

- Free tier: 60 requests per minute
- Context window: 32,000 tokens
- Output limit: 8,192 tokens per request

**Cost:** Free tier available; paid plans start at $0.00025/1K input characters

---

### 3. **Learning Platform APIs (Indirect)**

**Service:** External Learning Resource Links

**Platforms Integrated:**

- **Coursera** (https://www.coursera.org/)
- **Udemy** (https://www.udemy.com/)
- **YouTube** (https://www.youtube.com/)
- **freeCodeCamp** (https://www.freecodecamp.org/)
- **Khan Academy** (https://www.khanacademy.org/)
- **Codecademy** (https://www.codecademy.com/)

**Implementation:**

- Direct URL links stored in Firestore `learningResources` collection
- No API keys required (outbound links only)
- Resources curated and maintained by platform admins

**Data Structure:**

```javascript
{
  title: "Course/Tutorial Name",
  platform: "Coursera/Udemy/YouTube/etc.",
  skill: "Primary skill taught",
  relatedSkills: ["Additional", "Skills"],
  url: "https://platform.com/course-link",
  cost: "Free" | "Paid",
  difficulty: "Beginner" | "Intermediate" | "Advanced",
  description: "Course description"
}
```

---

### 4. **Backend API (FastAPI - Python)**

**Service:** Internal REST API for AI chat functionality

**Framework:** FastAPI (Python)

**Endpoint:**

```
POST http://localhost:8000/chat
Content-Type: application/json

Body:
{
  "message": "User message",
  "history": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ]
}
```

**Dependencies:**

- FastAPI
- Uvicorn (ASGI server)
- google-generativeai (Gemini SDK)
- python-dotenv
- PyPDF2
- python-multipart

**Setup:**

```bash
cd backend
pip install -r requirements.txt
python main.py
```

**CORS Configuration:**

- Allows origins: `http://localhost:5173`, `http://localhost:3000`
- Allows credentials, all methods, and headers

---

## 🚀 Tech Stack

### Frontend

| Technology           | Version | Purpose                   |
| -------------------- | ------- | ------------------------- |
| **React**            | 18.2.0  | UI framework              |
| **Vite**             | 5.4.21  | Build tool & dev server   |
| **React Router DOM** | 6.x     | Client-side routing       |
| **Firebase SDK**     | 10.x    | Authentication & Database |
| **Framer Motion**    | 11.x    | Animations                |
| **Lucide React**     | Latest  | Icon library              |
| **React Hot Toast**  | 2.x     | Notifications             |
| **TailwindCSS**      | 3.x     | Utility-first CSS         |

### Backend

| Technology               | Version | Purpose               |
| ------------------------ | ------- | --------------------- |
| **Python**               | 3.11+   | Programming language  |
| **FastAPI**              | Latest  | REST API framework    |
| **Uvicorn**              | Latest  | ASGI server           |
| **Google Generative AI** | 1.50.1  | Gemini API SDK        |
| **python-dotenv**        | Latest  | Environment variables |

### Database

| Service             | Type  | Purpose                    |
| ------------------- | ----- | -------------------------- |
| **Cloud Firestore** | NoSQL | User data, jobs, resources |

### External Services

| Service                         | Purpose                 |
| ------------------------------- | ----------------------- |
| **Firebase Auth**               | User authentication     |
| **Google Gemini AI**            | AI-powered features     |
| **External Learning Platforms** | Learning resource links |

---

## 📁 Project Structure

```
IIUC_25_Version2.0/
├── frontend/                          # React frontend application
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── JobCard.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── AdminProtectedRoute.jsx
│   │   ├── pages/                    # Route pages (lazy loaded)
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx        # User dashboard with skill gap resources
│   │   │   ├── Jobs.jsx              # Job listings with match scores
│   │   │   ├── Profile.jsx           # User profile management
│   │   │   ├── CareerRoadmap.jsx    # AI-powered career roadmap
│   │   │   ├── Chatassistance.jsx   # AI chatbot
│   │   │   ├── LearningResources.jsx # Full learning resources page
│   │   │   └── AdminPanel.jsx        # Admin dashboard
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx       # Authentication context provider
│   │   ├── services/
│   │   │   └── firestoreService.js   # Firebase database operations
│   │   ├── utils/
│   │   │   ├── matchScore.js         # Job matching algorithm
│   │   │   └── getLearningSuggestions.js # Learning resource matching
│   │   ├── constants/
│   │   │   ├── skillsDictionary.js   # Skill categories and search
│   │   │   └── jobConstants.js       # Career tracks, experience levels
│   │   ├── firebase.js               # Firebase configuration
│   │   ├── App.jsx                   # Main app component with routes
│   │   └── main.jsx                  # Entry point
│   ├── .env                          # Environment variables (not in git)
│   ├── .env.example                  # Environment template
│   ├── package.json                  # Frontend dependencies
│   └── vite.config.js                # Vite build configuration
│
├── backend/                          # Python FastAPI backend
│   ├── main.py                       # FastAPI application with chat endpoint
│   ├── .env                          # Backend environment variables
│   └── requirements.txt              # Python dependencies
│
├── README.md                         # This file
├── PERFORMANCE_OPTIMIZATION_REPORT.md # Performance optimizations documentation
├── SKILL_GAP_ANALYSIS_EXPLANATION.md # Skill gap system documentation
└── PROJECT_SUMMARY.md                # Project overview
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Python** (v3.11 or higher)
- **pip** (Python package manager)
- **Firebase Account** (for authentication and database)
- **Google Gemini API Key** (for AI features)

---

### 1. Clone the Repository

```bash
git clone https://github.com/md-sazid9089/IIUC_25_Version2.0.git
cd IIUC_25_Version2.0
```

---

### 2. Backend Setup (Python FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
# Copy and rename .env.example to .env
# Add your Gemini API key:
echo "GEMINI_API_KEY=AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8" > .env

# Start the backend server
python main.py
# Server will run on http://localhost:8000
```

**Backend Dependencies (requirements.txt):**

```
fastapi
uvicorn[standard]
google-generativeai==1.50.1
python-dotenv
PyPDF2
python-multipart
```

---

### 3. Frontend Setup (React + Vite)

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Create .env file
# Copy .env.example to .env and configure:
```

**Frontend Environment Variables (.env):**

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyC8za3ZI4m9gUrYsueUum907vpuKzV8H0Q
VITE_FIREBASE_AUTH_DOMAIN=iiuc25.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=iiuc25
VITE_FIREBASE_STORAGE_BUCKET=iiuc25.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=75690391713
VITE_FIREBASE_APP_ID=1:75690391713:web:4c72c5316547c8bc68d8e0

# Google Gemini API Key (for frontend AI features)
VITE_GEMINI_API_KEY=AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8

# Backend API URL
VITE_API_URL=http://localhost:8000
```

```bash
# Start the development server
npm run dev
# Frontend will run on http://localhost:5173 or http://localhost:5174
```

---

### 4. Firebase Configuration

1. **Create Firebase Project:**

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" and follow the setup wizard
   - Copy your project configuration

2. **Enable Authentication:**

   - Go to Authentication → Sign-in method
   - Enable **Email/Password** provider
   - Enable **Google** provider
   - Add authorized domain: `localhost`

3. **Create Firestore Database:**

   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location closest to your users

4. **Set Up Collections:**

   - The app will automatically create collections on first use:
     - `users` - User profiles
     - `jobs` - Job listings
     - `learningResources` - Learning materials
     - `applications` - Job applications
     - `Courses` - Enrolled courses
     - `chatbot` - Chat history

5. **Create Composite Index (Required for Profile Page):**

   - Go to Firestore Database → Indexes
   - Click "Create Index"
   - **Collection:** `applications`
   - **Fields:**
     - `userId` (Ascending)
     - `appliedAt` (Descending)
   - Create the index (takes a few minutes)

6. **Firestore Security Rules (Development):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

### 5. Get Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key
5. Add to both backend and frontend `.env` files

---

## 🔧 Environment Variables

### Backend (.env)

```bash
GEMINI_API_KEY=AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8
```

### Frontend (.env)

```bash
# Firebase Configuration (get from Firebase Console)
VITE_FIREBASE_API_KEY=AIzaSyC8za3ZI4m9gUrYsueUum907vpuKzV8H0Q
VITE_FIREBASE_AUTH_DOMAIN=iiuc25.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=iiuc25
VITE_FIREBASE_STORAGE_BUCKET=iiuc25.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=75690391713
VITE_FIREBASE_APP_ID=1:75690391713:web:4c72c5316547c8bc68d8e0

# Google Gemini API Key
VITE_GEMINI_API_KEY=AIzaSyCocHsm5Efg84WIiEyNh_DkVkiAbbV5JC8

# Backend API URL
VITE_API_URL=http://localhost:8000
```

---

## 💻 Usage

### Running the Application

1. **Start Backend Server:**

```bash
cd backend
python main.py
# Backend API running at http://localhost:8000
```

2. **Start Frontend Development Server:**

```bash
cd frontend
npm run dev
# Frontend running at http://localhost:5173 or http://localhost:5174
```

3. **Access the Application:**
   - Open browser and navigate to `http://localhost:5173` (or 5174)
   - Register a new account or login with existing credentials
   - Complete your profile with skills, tools, experience level, and preferences

### User Workflow

1. **Register/Login:**

   - Create account with email/password or Google OAuth
   - Complete initial profile setup

2. **Complete Profile:**

   - Add skills, tools/technologies, experience level
   - Set career track and location preferences
   - Profile completion % shown in dashboard

3. **Browse Jobs:**

   - View job listings with real-time match scores
   - Filter by location, experience level, career track
   - Apply to jobs directly from the platform

4. **Dashboard:**

   - View profile completion status
   - See enrolled courses count
   - Access skill gap learning resources
   - Track applied jobs

5. **Skill Gap Analysis:**

   - System automatically identifies missing skills
   - View personalized learning resource recommendations
   - Filter by platform, difficulty, cost
   - Enroll in courses

6. **Career Roadmap:**

   - Generate AI-powered career roadmap using Gemini AI
   - Get step-by-step learning path based on your profile and goals
   - View time estimates and milestone recommendations

7. **AI Chat Assistant:**
   - Ask career-related questions
   - Get personalized guidance from Gemini AI
   - Conversation history persists in session

### Admin Features

- Login with admin account
- Access admin panel via `/admin` route
- Manage jobs, courses, and learning resources
- View user applications and platform statistics

---

## 📊 Performance Optimizations

This application has been optimized for production performance:

### Implemented Optimizations

✅ **Route-Based Code Splitting**

- All pages lazy-loaded using `React.lazy()`
- Reduces initial bundle size by 62% (850KB → 320KB)
- Faster initial page load (2.4s → 0.9s FCP)

✅ **React Performance Hooks**

- `useMemo` for expensive calculations (match scores, profile completion)
- `useCallback` for all event handlers and functions
- Prevents unnecessary re-renders (70% reduction)

✅ **Component Memoization**

- `React.memo` on frequently re-rendering components
- Optimized prop comparison

✅ **Build Optimization**

- Manual chunk splitting (vendor, firebase, ui chunks)
- Tree-shaking to remove unused code
- Terser minification with console.log removal
- Source maps disabled in production

✅ **React Router v7 Flags**

- `v7_startTransition` for smooth transitions
- `v7_relativeSplatPath` for better routing

### Performance Metrics

| Metric                 | Before  | After   | Improvement   |
| ---------------------- | ------- | ------- | ------------- |
| Lighthouse Score       | 62      | 94      | +52%          |
| Initial Bundle         | 850 KB  | 320 KB  | 62% smaller   |
| First Contentful Paint | 2.4s    | 0.9s    | 62% faster    |
| Time to Interactive    | 5.2s    | 2.1s    | 60% faster    |
| Component Re-renders   | 350/min | 105/min | 70% reduction |
| Memory Usage           | 145 MB  | 82 MB   | 43% reduction |

For detailed performance optimization documentation, see [PERFORMANCE_OPTIMIZATION_REPORT.md](./PERFORMANCE_OPTIMIZATION_REPORT.md).

---

## 📖 Documentation

- **[PERFORMANCE_OPTIMIZATION_REPORT.md](./PERFORMANCE_OPTIMIZATION_REPORT.md)** - Comprehensive performance optimization documentation with before/after metrics
- **[SKILL_GAP_ANALYSIS_EXPLANATION.md](./SKILL_GAP_ANALYSIS_EXPLANATION.md)** - Technical documentation of the skill gap analysis algorithm and system
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - High-level project overview and objectives

---

## 🧪 Testing

### Frontend Testing

```bash
cd frontend
npm run build  # Test production build
npm run preview  # Preview production build
```

### Backend Testing

```bash
cd backend
# Test chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "history": []}'
```

---

## 🚀 Deployment

### Frontend Deployment (Vercel/Netlify)

1. Build the production bundle:

```bash
cd frontend
npm run build
```

2. Deploy the `dist` folder:

   - **Vercel:** Connect GitHub repo and deploy automatically
   - **Netlify:** Drag and drop `dist` folder or connect repo

3. Set environment variables in hosting platform dashboard

### Backend Deployment (Railway/Render)

1. Create `Procfile`:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

2. Deploy to Railway/Render:

   - Connect GitHub repository
   - Set environment variables (GEMINI_API_KEY)
   - Deploy automatically on push

3. Update frontend `VITE_API_URL` to production backend URL

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is developed as part of an academic project aligned with **UN Sustainable Development Goal 8** (Decent Work and Economic Growth).

---

## 🙏 Acknowledgments

- **Google Gemini AI** for powering intelligent career guidance features
- **Firebase** for authentication and database infrastructure
- **React** and **Vite** for excellent developer experience
- External learning platforms (Coursera, Udemy, freeCodeCamp, etc.) for educational resources

---

**Built with ❤️ to empower youth career development and support UN SDG 8**
