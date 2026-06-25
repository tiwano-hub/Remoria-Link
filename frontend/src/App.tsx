import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import IntakePage from './pages/IntakePage';
import CaseFormPage from './pages/CaseFormPage';
import CaseListPage from './pages/CaseListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ContractCreatePage from './pages/ContractCreatePage';
import SignPage from './pages/SignPage';
import ReceiptPublicPage from './pages/ReceiptPublicPage';
import InventoryListPage from './pages/InventoryListPage';
import InventoryNewPage from './pages/InventoryNewPage';
import InventoryDetailPage from './pages/InventoryDetailPage';
import SalesPage from './pages/SalesPage';
import PaymentsPage from './pages/PaymentsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import PurchaseAnalyticsPage from './pages/PurchaseAnalyticsPage';
import SalesAnalyticsPage from './pages/SalesAnalyticsPage';
import UsersPage from './pages/UsersPage';
import MastersPage from './pages/MastersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import HelpPage from './pages/HelpPage';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      {/* 顧客向け（認証不要） */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sign/:token" element={<SignPage />} />
      <Route path="/receipt/:token" element={<ReceiptPublicPage />} />

      {/* 社内（要認証） */}
      <Route path="/" element={<Navigate to="/cases" replace />} />
      <Route path="/intake" element={<Protected><IntakePage /></Protected>} />
      <Route path="/cases" element={<Protected><CaseListPage /></Protected>} />
      <Route path="/cases/new" element={<Protected><CaseFormPage /></Protected>} />
      <Route path="/cases/:id" element={<Protected><CaseDetailPage /></Protected>} />
      <Route path="/cases/:id/contract" element={<Protected><ContractCreatePage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryListPage /></Protected>} />
      <Route path="/inventory/new" element={<Protected><InventoryNewPage /></Protected>} />
      <Route path="/inventory/:id" element={<Protected><InventoryDetailPage /></Protected>} />
      <Route path="/sales" element={<Protected><SalesPage /></Protected>} />
      <Route path="/payments" element={<Protected><PaymentsPage /></Protected>} />
      <Route path="/receipts" element={<Protected><ReceiptsPage /></Protected>} />
      <Route path="/analytics/purchase" element={<Protected><PurchaseAnalyticsPage /></Protected>} />
      <Route path="/analytics/sales" element={<Protected><SalesAnalyticsPage /></Protected>} />
      <Route path="/users" element={<Protected><UsersPage /></Protected>} />
      <Route path="/masters" element={<Protected><MastersPage /></Protected>} />
      <Route path="/audit-logs" element={<Protected><AuditLogsPage /></Protected>} />
      <Route path="/help" element={<Protected><HelpPage /></Protected>} />
      <Route path="*" element={<Navigate to="/cases" replace />} />
    </Routes>
  );
}
