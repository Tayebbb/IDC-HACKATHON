/**
 * Admin Protected Route
 * Ensures only authenticated admin users can access the admin panel
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const ADMIN_EMAIL = 'admin@gmail.com';

const AdminProtectedRoute = ({ children }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) {
        setIsAdminAuthenticated(true);
      } else {
        setIsAdminAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // Loading state
  if (isAdminAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If not admin, redirect to admin login
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
