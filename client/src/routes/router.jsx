import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { LoginPage } from '@/features/auth/LoginPage.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { OverviewPage } from '@/features/dashboard/OverviewPage.jsx';
import { ClientsPage } from '@/features/clients/ClientsPage.jsx';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage.jsx';
import { CyclesPage } from '@/features/cycles/CyclesPage.jsx';
import { CycleWorkspace } from '@/features/cycles/CycleWorkspace.jsx';
import { ProjectionTab } from '@/features/cycles/ProjectionTab.jsx';
import { PerformanceTab } from '@/features/performance/PerformanceTab.jsx';
import { ControlTab } from '@/features/control/ControlTab.jsx';
import { TasksTab } from '@/features/tasks/TasksTab.jsx';
import { ContentTab } from '@/features/content/ContentTab.jsx';
import { SummaryTab } from '@/features/dashboard/SummaryTab.jsx';
import { UsersPage } from '@/features/users/UsersPage.jsx';
import { BusinessWorkspace } from '@/features/business/BusinessWorkspace.jsx';
import { BusinessSummaryTab } from '@/features/business/BusinessSummaryTab.jsx';
import { StockTab } from '@/features/business/StockTab.jsx';
import { OrdersTab } from '@/features/business/OrdersTab.jsx';
import { ExpensesTab } from '@/features/business/ExpensesTab.jsx';
import { STAFF_ROLES } from '@/lib/status.js';

/** Client logins land on their own business portal; the team lands on the agency overview. */
const HomeRoute = () => {
  const { user } = useAuth();
  return user?.role === 'client' ? <Navigate to="/business" replace /> : <OverviewPage />;
};

const businessTabs = [
  { index: true, element: <BusinessSummaryTab /> },
  { path: 'stock', element: <StockTab /> },
  { path: 'orders', element: <OrdersTab /> },
  { path: 'expenses', element: <ExpensesTab /> },
];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomeRoute /> },
      {
        path: 'business',
        element: (
          <ProtectedRoute roles={['client']}>
            <BusinessWorkspace />
          </ProtectedRoute>
        ),
        children: businessTabs,
      },
      {
        // Agency-internal pages — client logins are bounced back to their portal.
        element: (
          <ProtectedRoute roles={STAFF_ROLES}>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { path: 'clients', element: <ClientsPage /> },
          { path: 'clients/:id', element: <ClientDetailPage /> },
          { path: 'clients/:id/business', element: <BusinessWorkspace />, children: businessTabs },
          { path: 'cycles', element: <CyclesPage /> },
          {
            path: 'cycles/:id',
            element: <CycleWorkspace />,
            children: [
              { index: true, element: <ProjectionTab /> },
              { path: 'performance', element: <PerformanceTab /> },
              { path: 'control', element: <ControlTab /> },
              { path: 'tasks', element: <TasksTab /> },
              { path: 'content', element: <ContentTab /> },
              { path: 'summary', element: <SummaryTab /> },
            ],
          },
          {
            path: 'users',
            element: (
              <ProtectedRoute roles={['admin', 'manager']}>
                <UsersPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
