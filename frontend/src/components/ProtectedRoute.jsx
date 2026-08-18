import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    // Could render a spinner or null while auth state loads
    return null;
  }
  return user ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
