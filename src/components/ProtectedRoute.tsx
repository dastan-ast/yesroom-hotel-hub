import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireRole?: 'superadmin' | 'owner' | 'admin' | 'guest';
  requireHotel?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole,
  requireHotel = false
}: ProtectedRouteProps) {
  const { user, loading, role, hotelId, isSuperAdmin, isOwner, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in
  if (requireAuth && !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requireRole) {
    const hasRequiredRole = 
      requireRole === 'superadmin' ? isSuperAdmin :
      requireRole === 'owner' ? isOwner :
      requireRole === 'admin' ? isAdmin :
      true;

    if (!hasRequiredRole) {
      // Redirect based on actual role
      if (isSuperAdmin) {
        return <Navigate to="/super-admin" replace />;
      } else if (isOwner || isAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
      } else {
        return <Navigate to="/" replace />;
      }
    }
  }

  // Check if hotel is required but not set (needs onboarding)
  if (requireHotel && !hotelId && !isSuperAdmin) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
