import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import { AppShell } from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/dashboard/Dashboard';
import ProductsList from './pages/products/ProductsList';
import QrHub from './pages/qr/QrHub';
import UserManagement from './pages/users/UserManagement';
import ReportsAnalytics from './pages/reports/ReportsAnalytics';
import AuditLogs from './pages/audit/AuditLogs';
import BusinessList from './pages/businesses/BusinessList';
import BusinessFormManager from './pages/businesses/BusinessFormManager';
import BranchList from './pages/businesses/BranchList';
import BranchDetail from './pages/branches/BranchDetail';
import StoreList from './pages/branches/StoreList';
import FloorReport from './pages/branches/FloorReport';
import StoreReport from './pages/stores/StoreReport';
import AddProductPage from './pages/products/AddProductPage';
import DamageProducts from './pages/products/DamageProducts';
import LowStock from './pages/products/LowStock';
import SalesHistory from './pages/sales/SalesHistory';

// Dev-only component gallery (never linked in the sidebar, not built into production routes)
const Styleguide = import.meta.env.DEV ? lazy(() => import('./pages/dev/Styleguide')) : null;

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center" role="status" aria-live="polite">
        <span className="w-5 h-5 rounded-full border-2 border-line border-t-accent animate-spin" aria-hidden="true" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
          <ConfirmProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes share one persistent shell (sidebar + header) */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/add"
              element={
                <ProtectedRoute>
                  <AddProductPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <ProductsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qr/generate"
              element={
                <ProtectedRoute>
                  <QrHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qr/scan"
              element={
                <ProtectedRoute>
                  <QrHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/pending"
              element={<Navigate to="/users?tab=pending" replace />}
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/movement"
              element={
                <ProtectedRoute>
                  <ReportsAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route path="/businesses" element={<ProtectedRoute allowedRoles={['super_admin']}><BusinessList /></ProtectedRoute>} />
            <Route path="/businesses/:id/forms" element={<ProtectedRoute allowedRoles={['super_admin']}><BusinessFormManager /></ProtectedRoute>} />
            <Route path="/businesses/:id/branches" element={<ProtectedRoute allowedRoles={['super_admin']}><BranchList /></ProtectedRoute>} />
            <Route path="/branches/:id" element={<ProtectedRoute allowedRoles={['super_admin']}><BranchDetail /></ProtectedRoute>} />
            <Route path="/branches/:id/stores" element={<ProtectedRoute><StoreList /></ProtectedRoute>} />
            <Route path="/branches/:id/floor-report" element={<ProtectedRoute><FloorReport /></ProtectedRoute>} />
            <Route path="/stores/:id/report" element={<ProtectedRoute><StoreReport /></ProtectedRoute>} />
            <Route path="/damage" element={<ProtectedRoute><DamageProducts /></ProtectedRoute>} />
            <Route path="/low-stock" element={<ProtectedRoute><LowStock /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><SalesHistory /></ProtectedRoute>} />

            {Styleguide && (
              <Route path="/styleguide" element={<ProtectedRoute><Suspense fallback={null}><Styleguide /></Suspense></ProtectedRoute>} />
            )}

            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </ConfirmProvider>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
