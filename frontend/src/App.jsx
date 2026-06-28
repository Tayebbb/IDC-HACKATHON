/**
 * App Component
 * Main application with routing and layout
 */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';

// Components (loaded immediately as they're needed on every page)
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import FloatingAIButton from "./components/FloatingAIButton";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

// Lazy load pages for better performance
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const Resources = lazy(() => import("./pages/Resources"));
const LearningResources = lazy(() => import("./pages/LearningResources"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chatassistance = lazy(() => import("./pages/Chatassistance"));
const CareerRoadmap = lazy(() => import("./pages/CareerRoadmap"));
const CvUpload = lazy(() => import("./pages/CvUpload"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const JobMarketInsights = lazy(() => import("./pages/JobMarketInsights"));
const MockInterview = lazy(() => import("./pages/MockInterview"));
const KnowledgeGraph = lazy(() => import("./pages/KnowledgeGraph"));
const JobApplicationGenerator = lazy(() => import("./pages/JobApplicationGenerator"));

// Branded page-level loading fallback
import { AILoading } from './components/branding';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-base">
    <AILoading label="Loading CareerPath…" size={64} />
  </div>
);

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const hideNavbarRoutes = ['/job-market-insights'];
  // Immersive routes hide the global Navbar + Footer and reveal the navbar
  // only when the cursor approaches the top edge of the viewport.
  const immersiveRoutes = ['/chatassistance'];
  const isImmersive = immersiveRoutes.includes(location.pathname);
  const shouldHideNavbar =
    isAdminRoute || hideNavbarRoutes.includes(location.pathname) || isImmersive;

  // Track cursor proximity to the top edge for immersive nav reveal
  const [navRevealed, setNavRevealed] = useState(false);
  useEffect(() => {
    if (!isImmersive) {
      document.body.classList.remove('immersive-chat', 'nav-revealed');
      setNavRevealed(false);
      return;
    }
    document.body.classList.add('immersive-chat');
    const onMove = (e) => setNavRevealed(e.clientY <= 56);
    const onLeave = () => setNavRevealed(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove('immersive-chat', 'nav-revealed');
    };
  }, [isImmersive]);

  useEffect(() => {
    if (!isImmersive) return;
    document.body.classList.toggle('nav-revealed', navRevealed);
  }, [isImmersive, navRevealed]);

  return (
    <div className="App">
      {/* Always render the Navbar on immersive routes too; visibility is
          controlled by global CSS keyed off body.immersive-chat. */}
      {(!shouldHideNavbar || isImmersive) && <Navbar />}

      {/* Add padding-top to account for fixed navbar only for non-admin / non-immersive routes */}
      <div className={!shouldHideNavbar ? 'pt-20' : ''}>
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
            {/* Home route - show home page or redirect if logged in */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/learning-resources" element={
              <ProtectedRoute>
                <LearningResources />
              </ProtectedRoute>
            } />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chatassistance" element={<Chatassistance />} />
            <Route path="/cv-upload" element={<ProtectedRoute><CvUpload /></ProtectedRoute>} />
            <Route path="/career-roadmap" element={<ProtectedRoute><CareerRoadmap /></ProtectedRoute>} />
            <Route path="/mock-interview" element={<ProtectedRoute><MockInterview /></ProtectedRoute>} />
            <Route path="/knowledge-graph" element={<ProtectedRoute><KnowledgeGraph /></ProtectedRoute>} />
            <Route path="/job-application-generator" element={<ProtectedRoute><JobApplicationGenerator /></ProtectedRoute>} />
            <Route path="/job-market-insights" element={<JobMarketInsights />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin-dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
            <Route path="/admin/jobs" element={<AdminProtectedRoute><AdminPanel /></AdminProtectedRoute>} />
            <Route path="/admin/courses" element={<AdminProtectedRoute><AdminCourses /></AdminProtectedRoute>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      {/* Show footer only for non-admin and non-immersive routes */}
      {!isAdminRoute && !isImmersive && <Footer />}
      {/* Floating AI Assistant Button — hide on the chat page itself */}
      {!isImmersive && <FloatingAIButton />}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(var(--c-bg-elevated))',
            color: 'rgb(var(--c-text-main))',
            border: '1px solid rgb(var(--c-glass-border) / 0.18)',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <AppContent />
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
