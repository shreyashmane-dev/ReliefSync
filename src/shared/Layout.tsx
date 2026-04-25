import { Link, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../core/store/useStore';
import { getInitials } from '../core/utils/user';

export const Layout = () => {
  const { pathname } = useLocation();
  const { user } = useStore();

  const navItems = [
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
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-lg py-4 md:py-lg pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-lg flex flex-col gap-6 md:gap-xxl relative safe-px overflow-x-clip">
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
