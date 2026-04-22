// client/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import SessionRun from './pages/SessionRun';
import WorkshopWorkspace from './pages/WorkshopWorkspace';
import Workshops from './pages/Workshops';
import Students from './pages/Students';
import Questions from './pages/Questions';
import StudentDashboard from './pages/StudentDashboard';
import DeclareMajor from './pages/DeclareMajor';
import StudentReportsPage from './pages/StudentReportsPage';
import Leaderboard from './pages/Leaderboard';
import AIPractice from './pages/AIPractice';
import AdminPanel from './pages/AdminPanel';
import Calendar from './pages/Calendar';
import Profile from './pages/Profile';
import Announcements from './pages/Announcements';
import ProtectedRoute from './components/ProtectedRoute';

import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { useAuth } from './hooks/useAuth';

function MentorRoute({ children }) {
  const { user, accessToken, loading } = useAuth();
  
  if (loading) {
    return (
        <div className="loading-container">
            <div className="loader"></div>
            <p>Authenticating...</p>
        </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (user.role === 'student') return <Navigate to="/student-dashboard" />;
  if (!user.major || user.major === 'Undeclared') return <Navigate to="/declare-major" />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={
              <MentorRoute>
                <Dashboard />
              </MentorRoute>
            } />
            
            <Route path="/session/:id" element={
              <ProtectedRoute>
                <SessionRun />
              </ProtectedRoute>
            } />
            
            <Route path="/workshops" element={
              <ProtectedRoute>
                <Workshops />
              </ProtectedRoute>
            } />
            
            <Route path="/workshop/:id" element={
              <ProtectedRoute>
                <WorkshopWorkspace />
              </ProtectedRoute>
            } />
            
            <Route path="/students" element={
              <MentorRoute>
                <Students />
              </MentorRoute>
            } />
            
            <Route path="/questions" element={
              <MentorRoute>
                <Questions />
              </MentorRoute>
            } />
            
            <Route path="/leaderboard" element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            } />
            
            <Route path="/history" element={
              <MentorRoute>
                <History />
              </MentorRoute>
            } />
            
            <Route path="/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                <AdminPanel />
              </ProtectedRoute>
            } />
            
            <Route path="/practice" element={
              <ProtectedRoute>
                <AIPractice />
              </ProtectedRoute>
            } />
            
            <Route path="/student-dashboard" element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/declare-major" element={
              <ProtectedRoute>
                <DeclareMajor />
              </ProtectedRoute>
            } />
            
            <Route path="/student-reports" element={
              <ProtectedRoute>
                <StudentReportsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            
            <Route path="/announcements" element={
              <ProtectedRoute>
                <Announcements />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ConfirmProvider>
    </ToastProvider>
  );
}

