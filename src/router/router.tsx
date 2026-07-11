import { Navigate, createHashRouter } from 'react-router-dom';

import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteErrorPage } from '../components/feedback/RouteErrorPage';
import { AppLayout } from '../layouts/AppLayout';
import { AbsencesPage } from '../pages/AbsencesPage';
import { AdjustmentsPage } from '../pages/AdjustmentsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EmployeesPage } from '../pages/EmployeesPage';
import { LoginPage } from '../pages/LoginPage';
import { MonthlySettlementPage } from '../pages/MonthlySettlementPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { routes } from '../utils/routes';

export const router = createHashRouter([
  {
    path: routes.login,
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to={routes.dashboard} replace />,
          },
          {
            path: routes.dashboard,
            element: <DashboardPage />,
          },
          {
            path: routes.employees,
            element: <EmployeesPage />,
          },
          {
            path: routes.settlement,
            element: <MonthlySettlementPage />,
          },
          {
            path: routes.absences,
            element: <AbsencesPage />,
          },
          {
            path: routes.adjustments,
            element: <AdjustmentsPage />,
          },
          {
            path: routes.reports,
            element: <ReportsPage />,
          },
          {
            path: routes.settings,
            element: <SettingsPage />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
