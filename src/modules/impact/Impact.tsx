import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { computeImpactPoints, computeTrustScore, getEarnedBadges, getLeague } from '../../core/utils/impact';
import { getInitials } from '../../core/utils/user';

export const Impact = () => {
  const { user } = useStore();
  const [allReports, setAllReports] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsubReports = onSnapshot(collection(db, 'reports'), snap => {
      setAllReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReports(); unsubUsers(); };
  }, []);

  const myReports = useMemo(() => allReports.filter(r => r.userId === user?.id), [allReports, user?.id]);
  const impactPoints = computeImpactPoints({ reports: myReports, phoneVerified: Boolean(user?.phoneVerified) });
  const trustScore = computeTrustScore({
    reports: myReports,
    phoneVerified: Boolean(user?.phoneVerified),
    hasProfilePhoto: Boolean(user?.photoURL),
  });
  const league = getLeague(impactPoints);
  const badges = getEarnedBadges({ reports: myReports, phoneVerified: Boolean(user?.phoneVerified), trustScore });

  const leaderboard = useMemo(() => {
    const reportMap = new Map<string, any[]>();
    allReports.forEach(r => {
      const list = reportMap.get(r.userId) || [];
      list.push(r);
      reportMap.set(r.userId, list);
    });

    return allUsers
      .map(u => ({
        id: u.id,
        name: u.name || 'Anonymous',
        photoURL: u.photoURL,
        points: computeImpactPoints({ reports: reportMap.get(u.id) || [], phoneVerified: Boolean(u.phoneVerified) }),
        trust: computeTrustScore({ reports: reportMap.get(u.id) || [], phoneVerified: Boolean(u.phoneVerified), hasProfilePhoto: !!u.photoURL }),
      }))
      .filter(u => u.points > 0 || u.id === user?.id)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  }, [allReports, allUsers, user?.id]);

  return (
    <div className="flex flex-col gap-10 pb-20">
      {/* Impact Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 relative overflow-hidden rounded-[40px] bg-slate-900 p-10 md:p-12 text-white shadow-2xl">
            <div className="relative z-10">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center border-2" style={{ borderColor: league.current.color, backgroundColor: `${league.current.color}15` }}>
                     <span className="material-symbols-outlined text-4xl" style={{ color: league.current.color }}>{league.current.icon}</span>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active League</p>
                     <h2 className="text-3xl font-black">{league.current.name}</h2>
                  </div>
               </div>
               
               <div className="flex items-end gap-2 mb-10">
                  <span className="text-6xl font-black leading-none">{impactPoints}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Field Experience (XP)</span>
               </div>

               <div className="flex flex-col gap-3 max-w-md">
                 <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Progression to {league.next?.name || 'Top Tier'}</span>
                    <span className="text-white">{league.progress}%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${league.progress}%` }} />
                 </div>
                 {league.next && (
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {league.pointsToNext} XP remaining to achieve Next Rank
                   </p>
                 )}
               </div>
            </div>
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
         </div>

         <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-slate-50" cx="50" cy="50" fill="none" r="45" stroke="currentColor" strokeWidth="8" />
                  <circle 
                    className="text-blue-600" 
                    cx="50" cy="50" fill="none" r="45" 
                    stroke="currentColor" strokeWidth="8" 
                    strokeDasharray="283" 
                    strokeDashoffset={283 - (283 * trustScore / 100)} 
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
                </svg>
                <div className="flex flex-col items-center">
                   <span className="text-4xl font-black text-slate-900">{trustScore}</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Index</span>
                </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Calculated from verified status, community confirmations, and response outcomes.
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
         {/* Badges Section */}
         <div className="md:col-span-8 bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Achievements</h3>
               <span className="px-4 py-2 rounded-xl bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">{badges.filter(b => b.earned).length} Earned</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
               {badges.map(badge => (
                 <div key={badge.key} className={`flex flex-col items-center text-center group ${!badge.earned ? 'opacity-30 grayscale' : ''}`}>
                    <div className="w-20 h-20 rounded-[32px] flex items-center justify-center mb-4 transition-all group-hover:scale-110 shadow-lg" style={{ backgroundColor: `${badge.accent}15`, color: badge.accent, border: `1px solid ${badge.accent}20` }}>
                       <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{badge.icon}</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-tight">{badge.name}</p>
                 </div>
               ))}
            </div>
         </div>

         {/* Leadership */}
         <div className="md:col-span-4 bg-slate-900 rounded-[40px] p-10 text-white flex flex-col">
            <h3 className="text-xl font-black uppercase tracking-tight mb-8">Regional Elites</h3>
            <div className="flex flex-col gap-6 flex-1">
               {leaderboard.map((entry, i) => (
                 <div key={entry.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${entry.id === user?.id ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-white/5'}`}>
                    <span className="text-[10px] font-black w-4 text-slate-500">{i + 1}</span>
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                       {entry.photoURL ? <img src={entry.photoURL} className="w-full h-full object-cover" /> : getInitials(entry.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black truncate">{entry.id === user?.id ? 'You (HQ)' : entry.name}</p>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{entry.points} XP</p>
                    </div>
                    <span className="material-symbols-outlined text-blue-400 text-lg">verified</span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
