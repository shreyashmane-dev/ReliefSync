import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './core/firebase/config';
import { useStore } from './core/store/useStore';
import { isVolunteerConsoleEnabled } from './core/utils/user';
import { connectSocket, disconnectSocket } from './core/services/socketClient';
import { Layout } from './shared/Layout';
import { ReportsHome } from './modules/reports/ReportsHome';
import { MyReports } from './modules/my-reports/MyReports';
import { Impact } from './modules/impact/Impact';
import { Assistant } from './modules/assistant/Assistant';
import { Profile } from './modules/profile/Profile';
import AIAssistant from './components/AIAssistant';

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

// Admin Modules
import { AdminLayout } from './modules/admin/AdminLayout';
import { OperationsHub } from './modules/admin/OperationsHub';
import { AnalyticsMap, PeopleManagement, TrustSafety, BackupCoordination, AICopilot } from './modules/admin/tabs';

const App = () => {
  const { user, setUser } = useStore();
  const [authLoading, setAuthLoading] = useState(true);
  const isVolunteerMode = isVolunteerConsoleEnabled(user);

  // Persist auth state across refreshes using Firebase onAuthStateChanged
  useEffect(() => {
    let unsubscribeUserProfile: () => void = () => {};
    let unsubscribeVolunteerProfile: () => void = () => {};
    let unsubscribeAdminProfile: () => void = () => {};
    let notificationsRequestedForUid: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeUserProfile();
      unsubscribeVolunteerProfile();
      unsubscribeAdminProfile();

      if (firebaseUser) {
        const baseUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: 'user' as 'user' | 'admin' | 'volunteer',
          impactScore: 0,
          location: null,
          responderActive: false,
          isVolunteerApproved: false,
          volunteerRegistered: false,
        };

        let userProfileData: Record<string, unknown> | null = null;
        let volunteerProfileData: Record<string, unknown> | null = null;
        let adminProfileData: Record<string, unknown> | null = null;
        let userLoaded = false;
        let adminLoaded = false;

        const syncUserState = () => {
          // Wait for both user and admin profiles to be checked before releasing authLoading
          if (!userLoaded || !adminLoaded) return;

          const mergedUser = {
            ...baseUser,
            ...(userProfileData || {}),
            ...(volunteerProfileData || {}),
            role: adminProfileData ? 'admin' : (userProfileData?.role || 'user'),
            volunteerRegistered: volunteerProfileData !== null,
            isVolunteerApproved: volunteerProfileData?.approved === true,
          };

          setUser(mergedUser);
          setAuthLoading(false);

          // Request Push Notification Permissions
          if (firebaseUser.uid && notificationsRequestedForUid !== firebaseUser.uid) {
             notificationsRequestedForUid = firebaseUser.uid;
             import('./core/services/fcmService').then(({ requestFirebaseNotificationPermission }) => {
                requestFirebaseNotificationPermission(firebaseUser.uid);
             });
          }
        };

        unsubscribeUserProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (userSnapshot) => {
            userProfileData = userSnapshot.exists() ? userSnapshot.data() : {};
            userLoaded = true;
            syncUserState();
          },
          (error) => {
            console.error('Error restoring user profile:', error);
            userLoaded = true;
            syncUserState();
          },
        );

        unsubscribeVolunteerProfile = onSnapshot(
          doc(db, 'volunteers', firebaseUser.uid),
          (volunteerSnapshot) => {
            volunteerProfileData = volunteerSnapshot.exists() ? volunteerSnapshot.data() : null;
            syncUserState();
          },
          (error) => {
            console.error('Error restoring volunteer profile:', error);
            volunteerProfileData = null;
            syncUserState();
          },
        );
        unsubscribeAdminProfile = onSnapshot(
          doc(db, 'admins', firebaseUser.uid),
          (adminSnapshot) => {
            adminProfileData = adminSnapshot.exists() ? adminSnapshot.data() : null;
            adminLoaded = true;
            syncUserState();
          },
          (error) => {
            console.error('Error restoring admin profile:', error);
            adminProfileData = null;
            adminLoaded = true;
            syncUserState();
          },
        );
      } else {
        notificationsRequestedForUid = null;
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeUserProfile();
      unsubscribeVolunteerProfile();
      unsubscribeAdminProfile();
      unsubscribe();
    };
  }, [setUser]);

  useEffect(() => {
    if (!user?.id) {
      disconnectSocket();
      return;
    }

    connectSocket(user.id, user.role || 'user');
    return () => {
      disconnectSocket();
    };
  }, [user?.id, user?.role]);

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
        {/* Public Routes */}
        <Route path="/auth/admin" element={<AdminLogin />} />
        
        {!user ? (
          <Route path="/" element={<AuthLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="auth" element={<AuthEntry />} />
            <Route path="auth/signin" element={<UserSignIn />} />
            <Route path="auth/signup" element={<UserSignUp />} />
            <Route path="auth/phone" element={<PhoneAuth />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          /* Main Application Layout */
          <Route path="/" element={<Layout />}>
            <Route index element={isVolunteerMode ? <VolunteerJobs /> : <ReportsHome />} />
            <Route path="my-reports" element={<MyReports />} />
            <Route path="my-tasks" element={isVolunteerMode ? <VolunteerTasks /> : <Navigate to="/" replace />} />
            <Route path="my-tasks/:taskId" element={isVolunteerMode ? <TaskDetail /> : <Navigate to="/" replace />} />
            <Route path="my-tasks/:taskId/complete" element={isVolunteerMode ? <CompletionForm /> : <Navigate to="/" replace />} />
            <Route path="impact" element={isVolunteerMode ? <VolunteerImpact /> : <Impact />} />
            <Route path="assistant" element={isVolunteerMode ? <VolunteerAssistant /> : <Assistant />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}

        {/* Admin Command Center - Protected */}
        <Route path="/admin" element={user?.role === 'admin' ? <AdminLayout /> : <Navigate to="/auth/admin" replace />}>
          <Route index element={<OperationsHub />} />
          <Route path="analytics" element={<AnalyticsMap />} />
          <Route path="people" element={<PeopleManagement />} />
          <Route path="trust" element={<TrustSafety />} />
          <Route path="backup" element={<BackupCoordination />} />
          <Route path="copilot" element={<AICopilot />} />
        </Route>
      </Routes>
      {user && <AIAssistant currentUser={user} />}
    </BrowserRouter>
  );
};

export default App;
