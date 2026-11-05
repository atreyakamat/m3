import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/authContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { homeFor } from './lib/routes';
import { Login } from './pages/Login';
import { FirstLogin } from './pages/FirstLogin';
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
import { FacilitiesList } from './pages/admin/FacilitiesList';
import { FacilityDetailPage } from './pages/admin/FacilityDetail';
import { ProfileCorrectionsPage } from './pages/admin/ProfileCorrections';
import { Placeholder } from './pages/Placeholder';
import { HealthWorkerLayout } from './pages/health-worker/HealthWorkerLayout';
import { HealthWorkerDashboard } from './pages/health-worker/HealthWorkerDashboard';
import { WorkerSearchPage as HWWorkerSearchPage } from './pages/health-worker/WorkerSearch';
import { WorkerDetailPage as HWWorkerDetailPage } from './pages/health-worker/WorkerDetail';
import { ScreeningFormPage } from './pages/health-worker/ScreeningForm';
import { SuspectedCaseFormPage } from './pages/health-worker/SuspectedCaseForm';
import { FollowUpsPage } from './pages/health-worker/FollowUps';
import { TravelArrivalsPage } from './pages/health-worker/TravelArrivals';
import { FacilityInboxPage } from './pages/health-worker/FacilityInbox';

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user && user.role !== 'WORKER' && user.role !== 'CONTRACTOR' ? (
            <Navigate to={homeFor(user.role)} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Mandatory first-login credential change (temporary password / PIN set by Admin). */}
      <Route
        path="/first-login"
        element={
          user && user.role !== 'WORKER' && user.role !== 'CONTRACTOR' ? (
            <FirstLogin />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Worker routes are blocked on the web portal — workers must use the mobile app */}
      <Route
        path="/worker"
        element={
          <Navigate
            to="/login"
            state={{ error: 'Worker accounts can only access the M3 mobile app.' }}
            replace
          />
        }
      />
      <Route
        path="/worker/*"
        element={
          <Navigate
            to="/login"
            state={{ error: 'Worker accounts can only access the M3 mobile app.' }}
            replace
          />
        }
      />

      {/* Contractor routes are blocked on the web portal — contractors must use the mobile app */}
      <Route
        path="/contractor"
        element={
          <Navigate
            to="/login"
            state={{ error: 'Contractor accounts can only access the M3 mobile app.' }}
            replace
          />
        }
      />
      <Route
        path="/contractor/*"
        element={
          <Navigate
            to="/login"
            state={{ error: 'Contractor accounts can only access the M3 mobile app.' }}
            replace
          />
        }
      />

      {/* Admin dashboard — standard login, ADMIN role enforced by the backend as well. */}
      <Route
        path="/admin"
        element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}
      >
        <Route index element={<AdminOverview />} />
        <Route path="facilities" element={<FacilitiesList />} />
        <Route path="facilities/:id" element={<FacilityDetailPage />} />
        <Route path="corrections" element={<ProfileCorrectionsPage />} />
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

      {/* Health Worker portal */}
      <Route
        path="/health-worker"
        element={
          <ProtectedRoute roles={['HEALTH_WORKER']}>
            <HealthWorkerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HealthWorkerDashboard />} />
        <Route path="search" element={<HWWorkerSearchPage />} />
        <Route path="workers/:id" element={<HWWorkerDetailPage />} />
        <Route path="screening" element={<ScreeningFormPage />} />
        <Route path="cases" element={<SuspectedCaseFormPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="travel-arrivals" element={<TravelArrivalsPage />} />
        <Route path="inbox" element={<FacilityInboxPage />} />
      </Route>

      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={['HEALTH_WORKER', 'CLINICIAN', 'PATHOLOGIST', 'RESEARCH_LAB']}>
            <Placeholder />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              user && user.role !== 'WORKER' && user.role !== 'CONTRACTOR'
                ? homeFor(user.role)
                : '/login'
            }
            replace
          />
        }
      />
    </Routes>
  );
}
