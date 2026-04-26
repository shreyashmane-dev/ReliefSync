import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase/config';
import { useStore } from '../core/store/useStore';
import { getInitials, isVolunteerConsoleEnabled } from '../core/utils/user';

export const Layout = () => {
  const { pathname } = useLocation();
  const { user } = useStore();
  const [broadcast, setBroadcast] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        // Only show if less than 1 hour old
        if (Date.now() - new Date(data.createdAt?.toDate?.() || Date.now()).getTime() < 3600000) {
          setBroadcast(data);
          // Auto-hide alert after 10 seconds
          setTimeout(() => setBroadcast(null), 10000);
        }
      }
    });
    return () => unsub();
  }, []);

  const isVolunteer = isVolunteerConsoleEnabled(user);

  const navItems = isVolunteer ? [
    { path: '/', icon: 'dashboard', label: 'Jobs' },
    { path: '/my-tasks', icon: 'task', label: 'My Tasks' },
    { path: '/impact', icon: 'analytics', label: 'Impact' },
    { path: '/assistant', icon: 'smart_toy', label: 'AI Assistant' },
  ] : [
    { path: '/', icon: 'assignment', label: 'Reports' },
    { path: '/my-reports', icon: 'folder_shared', label: 'My Reports' },
    { path: '/impact', icon: 'analytics', label: 'Impact' },
    { path: '/assistant', icon: 'smart_toy', label: 'AI Assistant' },
  ];

  return (
    <div className="bg-background text-on-background font-body-md min-h-[100dvh] flex flex-col antialiased overflow-x-clip">
      {/* TopAppBar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur w-full sticky top-0 z-50 border-b border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none font-sans text-base font-semibold">
        <div className="flex justify-between items-center px-4 md:px-6 py-3 w-full max-w-[1200px] mx-auto gap-3 safe-px">
          <div className="flex items-center gap-md">
            <span className="material-symbols-outlined text-blue-700 dark:text-blue-400 fill text-[24px]">emergency</span>
            <span className="text-lg md:text-xl font-extrabold tracking-tight text-blue-700 dark:text-blue-500">ReliefSync</span>
          </div>

          {isVolunteer && (
            <div className="hidden lg:flex flex-col ml-4">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">Field Ops Console</span>
              <span className="text-sm font-bold text-slate-700">Welcome, {user?.name.split(' ')[0]}</span>
            </div>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin" className="hidden lg:flex flex-col ml-4 group">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none group-hover:text-red-700 transition-colors">Strategic Control</span>
              <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors flex items-center gap-1">
                Open Command Center
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </span>
            </Link>
          )}

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-lg">
            {navItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`transition-colors active:scale-95 duration-150 px-md py-base rounded-lg flex items-center gap-base ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-400 font-bold bg-slate-50 dark:bg-slate-800'
                      : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300'
                  }`}
                >
                  <span className={`material-symbols-outlined ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-sm shrink-0">
            <button className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container-high items-center justify-center hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
            </button>
            <Link to="/profile">
              {user?.photoURL ? (
                <img
                  alt="User Profile"
                  className="w-10 h-10 rounded-full border-2 border-white elevation-1 object-cover"
                  src={user.photoURL}
                />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-white elevation-1 bg-blue-700 text-white flex items-center justify-center text-sm font-bold">
                  {getInitials(user?.name)}
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-lg py-4 md:py-lg pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-lg flex flex-col gap-4 md:gap-6 relative safe-px overflow-x-clip">
        {/* Admin Broadcast Alert */}
        {broadcast && (
          <div className="bg-red-600 text-white rounded-2xl p-4 shadow-xl shadow-red-600/20 flex items-center gap-4 animate-in slide-in-from-top-10 duration-500">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
               <span className="material-symbols-outlined text-white">campaign</span>
            </div>
            <div className="flex-1">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-white/80 leading-none mb-1">HQ Broadcast</h4>
               <p className="text-sm font-bold leading-tight">{broadcast.message}</p>
            </div>
            <button 
              onClick={() => setBroadcast(null)}
              className="w-8 h-8 rounded-lg hover:bg-black/10 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
        
        <Outlet />
      </main>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-100 dark:border-slate-800 shadow-[0_-2px_16px_rgba(15,23,42,0.08)] fixed bottom-0 left-0 w-full flex justify-around items-stretch px-2 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 font-sans text-[10px] font-bold uppercase tracking-[0.08em] safe-px">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center transition-all active:scale-90 duration-200 w-1/4 min-w-0 min-h-[60px] ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/20 rounded-xl px-2 py-2'
                  : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-300'
              }`}
            >
              <span className={`material-symbols-outlined mb-1 text-[20px] ${isActive ? 'fill' : ''}`}>{item.icon}</span>
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
