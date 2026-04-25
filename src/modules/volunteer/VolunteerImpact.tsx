import { useStore } from '../../core/store/useStore';

const LEAGUES = [
  { name: 'Wood', minPoints: 0, color: '#92400e', icon: 'forest' },
  { name: 'Iron', minPoints: 100, color: '#475569', icon: 'foundation' },
  { name: 'Bronze', minPoints: 500, color: '#b45309', icon: 'workspace_premium' },
  { name: 'Silver', minPoints: 1500, color: '#64748b', icon: 'military_tech' },
  { name: 'Gold', minPoints: 3000, color: '#eab308', icon: 'stars' },
  { name: 'Platinum', minPoints: 7000, color: '#0ea5e9', icon: 'shield_moon' },
  { name: 'Guardian', minPoints: 15000, color: '#7c3aed', icon: 'security' },
];

export const VolunteerImpact = () => {
  const { user } = useStore();
  const points = user?.impactScore || 0;
  
  const currentLeagueIndex = [...LEAGUES].reverse().findIndex(l => points >= l.minPoints);
  const currentLeague = currentLeagueIndex === -1 ? LEAGUES[0] : [...LEAGUES].reverse()[currentLeagueIndex];
  const nextLeague = LEAGUES[LEAGUES.indexOf(currentLeague) + 1];
  
  const progressToNext = nextLeague 
    ? ((points - currentLeague.minPoints) / (nextLeague.minPoints - currentLeague.minPoints)) * 100 
    : 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Mission Impact</h1>
        <p className="text-on-surface-variant text-sm">Your operational contribution to crisis resolution.</p>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: currentLeague.color }}>
            <span className="material-symbols-outlined text-4xl leading-none">{currentLeague.icon}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: currentLeague.color }}>
              Current Rank
            </span>
            <h2 className="text-2xl font-black text-on-surface leading-tight">
              {currentLeague.name} League
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-4xl font-black text-blue-700">{points}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impact Points Earned</span>
            </div>
            {nextLeague && (
              <span className="text-xs font-bold text-on-surface-variant mb-1">
                {nextLeague.minPoints - points} to {nextLeague.name}
              </span>
            )}
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(29,78,216,0.3)]"
              style={{ width: `${progressToNext}%`, backgroundColor: currentLeague.color }}
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Missions Done', value: '42', icon: 'checklist', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Trust Score', value: '98%', icon: 'verified_user', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Response Time', value: '18m', icon: 'bolt', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Backup Help', value: '14', icon: 'handshake', color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-on-surface leading-tight">{stat.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Achievements Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-700">military_tech</span>
          Operational Merit Badges
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Fast Responder', icon: 'acute' },
            { name: 'Relief Hero', icon: 'volunteer_activism' },
            { name: 'Crisis Guardian', icon: 'shield_with_heart' },
          ].map((b, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-50 p-3 flex flex-col items-center justify-center gap-2 text-center opacity-50 grayscale">
              <div className="w-12 h-12 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-slate-300">{b.icon}</span>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase leading-tight">{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
