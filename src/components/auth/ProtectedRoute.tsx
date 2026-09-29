import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/roles';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: readonly string[];
  requiredPermissionCode?: string;
}

const ProtectedRoute = ({ children, requiredRole, requiredPermission, requiredPermissionCode }: ProtectedRouteProps) => {
  const { user, loading, hasRole, userRoles } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (requiredRole && !hasRole(requiredRole)) {
        navigate('/dashboard', { replace: true });
      } else if (requiredPermissionCode ? !can(requiredPermissionCode) : requiredPermission && !hasPermission(userRoles, requiredPermission)) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, loading, requiredRole, requiredPermission, requiredPermissionCode, navigate, hasRole, userRoles, can]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;
  if (requiredRole && !hasRole(requiredRole)) return null;
  if (requiredPermissionCode ? !can(requiredPermissionCode) : requiredPermission && !hasPermission(userRoles, requiredPermission)) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
