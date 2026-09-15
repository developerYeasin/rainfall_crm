import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { LoginPage } from '@/features/auth/LoginPage.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { Loading } from '@/components/ui/States.jsx';
import { STAFF_ROLES } from '@/lib/status.js';

/** Pages load on demand so a client login never downloads the agency screens (and charts load once needed). */
const page = (loader, name) => {
  const Component = lazy(() => loader().then((m) => ({ default: m[name] })));
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
};

const OverviewPage = () => page(() => import('@/features/dashboard/OverviewPage.jsx'), 'OverviewPage');

/** Client logins land on their own business portal; the team lands on the agency overview. */
const HomeRoute = () => {
  const { user } = useAuth();
  return user?.role === 'client' ? <Navigate to="/business" replace /> : <OverviewPage />;
};

const workspace = () => page(() => import('@/features/business/BusinessWorkspace.jsx'), 'BusinessWorkspace');

const businessTabs = [
  { index: true, element: page(() => import('@/features/business/BusinessSummaryTab.jsx'), 'BusinessSummaryTab') },
  { path: 'ads', element: page(() => import('@/features/ads/AdsTab.jsx'), 'AdsTab') },
  { path: 'orders', element: page(() => import('@/features/business/OrdersTab.jsx'), 'OrdersTab') },
  { path: 'stock', element: page(() => import('@/features/business/StockTab.jsx'), 'StockTab') },
  { path: 'expenses', element: page(() => import('@/features/business/ExpensesTab.jsx'), 'ExpensesTab') },
  { path: 'accounting', element: page(() => import('@/features/accounting/AccountingTab.jsx'), 'AccountingTab') },
  { path: 'messages', element: page(() => import('@/features/messages/MessagesTab.jsx'), 'MessagesTab') },
];

const leadsOnly = (element) => <ProtectedRoute roles={['admin', 'manager']}>{element}</ProtectedRoute>;

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
        element: <ProtectedRoute roles={['client']}>{workspace()}</ProtectedRoute>,
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
          { path: 'clients', element: page(() => import('@/features/clients/ClientsPage.jsx'), 'ClientsPage') },
          { path: 'clients/:id', element: page(() => import('@/features/clients/ClientDetailPage.jsx'), 'ClientDetailPage') },
          { path: 'clients/:id/business', element: workspace(), children: businessTabs },
          { path: 'cycles', element: page(() => import('@/features/cycles/CyclesPage.jsx'), 'CyclesPage') },
          {
            path: 'cycles/:id',
            element: page(() => import('@/features/cycles/CycleWorkspace.jsx'), 'CycleWorkspace'),
            children: [
              { index: true, element: page(() => import('@/features/cycles/ProjectionTab.jsx'), 'ProjectionTab') },
              { path: 'performance', element: page(() => import('@/features/performance/PerformanceTab.jsx'), 'PerformanceTab') },
              { path: 'control', element: page(() => import('@/features/control/ControlTab.jsx'), 'ControlTab') },
              { path: 'tasks', element: page(() => import('@/features/tasks/TasksTab.jsx'), 'TasksTab') },
              { path: 'content', element: page(() => import('@/features/content/ContentTab.jsx'), 'ContentTab') },
              { path: 'summary', element: page(() => import('@/features/dashboard/SummaryTab.jsx'), 'SummaryTab') },
            ],
          },
          { path: 'ad-accounts', element: page(() => import('@/features/ads/AdAccountsPage.jsx'), 'AdAccountsPage') },
          { path: 'tasks', element: page(() => import('@/features/agencyTasks/AgencyTasksPage.jsx'), 'AgencyTasksPage') },
          { path: 'finance', element: leadsOnly(page(() => import('@/features/finance/FinancePage.jsx'), 'FinancePage')) },
          { path: 'team', element: leadsOnly(page(() => import('@/features/team/TeamPage.jsx'), 'TeamPage')) },
          { path: 'users', element: leadsOnly(page(() => import('@/features/users/UsersPage.jsx'), 'UsersPage')) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
