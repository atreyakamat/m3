import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ProtectedRoute, homeFor } from './routes/ProtectedRoute';
import { Login } from './pages/Login';
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
import { Placeholder } from './pages/Placeholder';

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />

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

      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={['HEALTH_WORKER', 'CLINICIAN', 'PATHOLOGIST', 'RESEARCH_LAB', 'ADMIN']}>
            <Placeholder />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
