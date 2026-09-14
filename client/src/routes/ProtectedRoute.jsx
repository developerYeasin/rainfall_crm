import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { Loading } from '@/components/ui/States.jsx';

export const ProtectedRoute = ({ roles, children }) => {
  const { user, booting, can } = useAuth();
  const location = useLocation();

  if (booting) return <Loading label="সেশন যাচাই হচ্ছে…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !can(...roles)) return <Navigate to="/" replace />;

  return children;
};
