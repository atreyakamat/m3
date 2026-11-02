import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/authContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { homeFor } from './lib/routes';
import { Login } from './pages/Login';
import { FirstLogin } from './pages/FirstLogin';
import { WorkerLayout } from './pages/worker/WorkerLayout';
import { WorkerDashboard } from './pages/worker/Dashboard';
import { SiteSelection } from './pages/worker/SiteSelection';
import { Screening } from './pages/worker/Screening';
import { Transfer } from './pages/worker/Transfer';
import { FeelingUnwell } from './pages/worker/FeelingUnwell';
import { MalariaStatus } from './pages/worker/MalariaStatus';
import { Prescriptions } from './pages/worker/Prescriptions';
import { FollowUps } from './pages/worker/FollowUps';
import { Profile } from './pages/worker/Profile';
import { ContractorLayout } from './pages/contractor/ContractorLayout';
import { ContractorDashboard } from './pages/contractor/Dashboard';
import { MySites } from './pages/contractor/MySites';
import { InitiateTransfer } from './pages/contractor/InitiateTransfer';
import { Approvals } from './pages/contractor/Approvals';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverview } from './pages/admin/Overview';
import { SitesList } from './pages/admin/SitesList';
import { SiteForm } from './pages/admin/SiteForm';
import { SiteDetailPage } from './pages/admin/SiteDetail';
import { UsersList } from './pages/admin/UsersList';
import { UserForm } from './pages/admin/UserForm';
import { UserDetailPage } from './pages/admin/UserDetail';
import { WorkersList } from './pages/admin/WorkersList';
import { WorkerDetailPage } from './pages/admin/WorkerDetail';
import { RequestsPage } from './pages/admin/Requests';
import { TransfersPage } from './pages/admin/Transfers';
import { TravelReportsPage } from './pages/admin/TravelReports';
import { TravelReportDetailPage } from './pages/admin/TravelReportDetail';
import { NotificationsPage } from './pages/admin/Notifications';
import { DemoDataPage } from './pages/admin/DemoData';
import { Placeholder } from './pages/Placeholder';

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />

      {/* Mandatory first-login credential change (temporary password / PIN set by Admin). */}
      <Route path="/first-login" element={user ? <FirstLogin /> : <Navigate to="/login" replace />} />

      <Route
        path="/worker"
        element={<ProtectedRoute roles={['WORKER']}><WorkerLayout /></ProtectedRoute>}
      >
        <Route index element={<WorkerDashboard />} />
        <Route path="site" element={<SiteSelection />} />
        <Route path="screening" element={<Screening />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="unwell" element={<FeelingUnwell />} />
        <Route path="malaria" element={<MalariaStatus />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="followups" element={<FollowUps />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/contractor"
        element={<ProtectedRoute roles={['CONTRACTOR']}><ContractorLayout /></ProtectedRoute>}
      >
        <Route index element={<ContractorDashboard />} />
        <Route path="sites" element={<MySites />} />
        <Route path="initiate" element={<InitiateTransfer />} />
        <Route path="approvals" element={<Approvals />} />
      </Route>

      {/* Admin dashboard — standard login, ADMIN role enforced by the backend as well. */}
      <Route
        path="/admin"
        element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}
      >
        <Route index element={<AdminOverview />} />
        <Route path="sites" element={<SitesList />} />
        <Route path="sites/new" element={<SiteForm />} />
        <Route path="sites/:siteCode" element={<SiteDetailPage />} />
        <Route path="sites/:siteCode/edit" element={<SiteForm />} />
        <Route path="users" element={<UsersList />} />
        <Route path="users/new" element={<UserForm />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="workers" element={<WorkersList />} />
        <Route path="workers/:workerCode" element={<WorkerDetailPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="travel-reports" element={<TravelReportsPage />} />
        <Route path="travel-reports/:id" element={<TravelReportDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="demo-data" element={<DemoDataPage />} />
      </Route>

      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={['HEALTH_WORKER', 'CLINICIAN', 'PATHOLOGIST', 'RESEARCH_LAB']}>
            <Placeholder />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
