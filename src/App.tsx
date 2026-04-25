import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './core/firebase/config';
import { useStore } from './core/store/useStore';
import { Layout } from './shared/Layout';
import { ReportsHome } from './modules/reports/ReportsHome';
import { MyReports } from './modules/my-reports/MyReports';
import { Impact } from './modules/impact/Impact';
import { Assistant } from './modules/assistant/Assistant';
import { Profile } from './modules/profile/Profile';

// Volunteer Modules
import { VolunteerJobs } from './modules/volunteer/VolunteerJobs';
import { VolunteerTasks } from './modules/volunteer/VolunteerTasks';
import { TaskDetail } from './modules/volunteer/TaskDetail';
import { CompletionForm } from './modules/volunteer/CompletionForm';
import { VolunteerImpact } from './modules/volunteer/VolunteerImpact';
import { VolunteerAssistant } from './modules/volunteer/VolunteerAssistant';
import { VolunteerOnboarding } from './modules/volunteer/VolunteerOnboarding';

// Auth & Landing Routes
import { LandingPage } from './modules/landing/LandingPage';
import { AuthLayout } from './modules/auth/AuthLayout';
import { AuthEntry } from './modules/auth/AuthEntry';
import { UserSignIn } from './modules/auth/UserSignIn';
import { UserSignUp } from './modules/auth/UserSignUp';
import { PhoneAuth } from './modules/auth/PhoneAuth';
import { AdminLogin } from './modules/auth/AdminLogin';

const App = () => {
  const { user, setUser } = useStore();
  const [authLoading, setAuthLoading] = useState(true);

  // Persist auth state across refreshes using Firebase onAuthStateChanged
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let userData = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: 'user' as 'user' | 'admin' | 'volunteer',
            impactScore: 0,
            location: null
          };
          if (userDoc.exists()) {
            userData = { ...userData, ...userDoc.data() } as any;
          }
          setUser(userData);
        } catch (err) {
          console.error('Error restoring auth:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [setUser]);

  // Show loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
          </div>
          <span className="text-on-surface-variant font-label-bold text-label-bold tracking-wider uppercase">Loading ReliefSync...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user && <VolunteerOnboarding />}
      <Routes>
        {/* If user is NOT logged in, route to auth layout */}
        {!user ? (
          <Route path="/" element={<AuthLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="auth" element={<AuthEntry />} />
            <Route path="auth/signin" element={<UserSignIn />} />
            <Route path="auth/signup" element={<UserSignUp />} />
            <Route path="auth/phone" element={<PhoneAuth />} />
            <Route path="auth/admin" element={<AdminLogin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          /* If local/volunteer is logged in, route to main layout */
          <Route path="/" element={<Layout />}>
            <Route index element={user.role === 'volunteer' ? <VolunteerJobs /> : <ReportsHome />} />
            <Route path="my-reports" element={<MyReports />} />
            <Route path="my-tasks" element={<VolunteerTasks />} />
            <Route path="my-tasks/:taskId" element={<TaskDetail />} />
            <Route path="my-tasks/:taskId/complete" element={<CompletionForm />} />
            <Route path="impact" element={user.role === 'volunteer' ? <VolunteerImpact /> : <Impact />} />
            <Route path="assistant" element={user.role === 'volunteer' ? <VolunteerAssistant /> : <Assistant />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
