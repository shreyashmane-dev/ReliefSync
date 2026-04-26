import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '../../core/store/useStore';
import { getInitials } from '../../core/utils/user';

const navItems = [
  { id: 'operations', label: 'Operations Hub', icon: 'dashboard', path: '/admin' },
  { id: 'analytics', label: 'Analytics & Heatmaps', icon: 'map', path: '/admin/analytics' },
  { id: 'people', label: 'People Management', icon: 'group', path: '/admin/people' },
  { id: 'trust', label: 'Trust & Safety', icon: 'verified_user', path: '/admin/trust' },
  { id: 'backup', label: 'Backup Coordination', icon: 'support', path: '/admin/backup' },
  { id: 'copilot', label: 'AI Copilot', icon: 'auto_awesome', path: '/admin/copilot' },
];

export const AdminLayout = () => {
  const { user } = useStore();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">ReliefSync</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Admin Command Center</p>
          </div>
        </div>

        <nav className="flex-1 px-4 flex flex-col gap-1 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-700/5'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-6 flex-1">
            <div className="relative max-w-md w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input 
                type="text" 
                placeholder="Universal Search (Cmd + K)"
                className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700/10 focus:border-blue-700/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 hover:text-blue-700 transition-colors relative">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="px-4 h-10 rounded-xl bg-blue-700 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20">
              Command Palette
            </button>
          </div>
        </header>

        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
