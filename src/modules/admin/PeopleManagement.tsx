import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase/config';

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  tier?: string;
  impactScore?: number;
  photoURL?: string;
  history?: string;
}

const LEVELS = [
  { name: 'Prarambh', minPoints: 0 },
  { name: 'Udaan', minPoints: 120 },
  { name: 'Sankalp', minPoints: 260 },
  { name: 'Drishti', minPoints: 480 },
  { name: 'Prabhav', minPoints: 760 },
  { name: 'Shikhar', minPoints: 1100 },
];

export const PeopleManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'volunteers' | 'applicants'>('users');
  const [people, setPeople] = useState<Person[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isReviewingPromotions, setIsReviewingPromotions] = useState(false);
  const [promotionCandidates, setPromotionCandidates] = useState<any[]>([]);

  useEffect(() => {
    let q;
    if (activeSubTab === 'applicants') {
      // Use a single query that doesn't require a composite index
      q = query(collection(db, 'users'), where('volunteerApplied', '==', true));
    } else if (activeSubTab === 'volunteers') {
      q = query(collection(db, 'users'), where('role', '==', 'volunteer'));
    } else {
      q = query(collection(db, 'users'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Person[];

      // Apply additional filtering client-side if needed
      if (activeSubTab === 'applicants') {
        data = data.filter(p => p.role === 'user');
      }

      setPeople(data);
    });

    return () => unsubscribe();
  }, [activeSubTab]);

  const handleReviewPromotions = async () => {
    const q = query(collection(db, 'users'), where('impactScore', '>', 50));
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    
    const candidates = all.filter(u => {
      const currentPoints = u.impactScore || 0;
      const currentTier = u.tier || 'Prarambh';
      const highestPossible = [...LEVELS].reverse().find(l => currentPoints >= l.minPoints);
      return highestPossible && highestPossible.name !== currentTier;
    }).map(u => {
      const highestPossible = [...LEVELS].reverse().find(l => (u.impactScore || 0) >= l.minPoints);
      return {
        ...u,
        suggestedTier: highestPossible?.name,
        reason: `Exceeds XP threshold for ${highestPossible?.name}.`
      };
    });

    setPromotionCandidates(candidates);
    setIsReviewingPromotions(true);
  };

  const handleApprovePromotion = async (userId: string, newTier: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { tier: newTier });
      setPromotionCandidates(prev => prev.filter(c => c.id !== userId));
      if (promotionCandidates.length <= 1) setIsReviewingPromotions(false);
    } catch (err) {
      console.error('Promotion error:', err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const userToApprove = people.find(p => p.id === id);
      await setDoc(doc(db, 'volunteers', id), { 
        id,
        name: userToApprove?.name || 'Unknown',
        email: userToApprove?.email || '',
        photoURL: userToApprove?.photoURL || '',
        approved: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await updateDoc(doc(db, 'users', id), { 
        role: 'volunteer',
        volunteerApplied: false 
      });
    } catch (err) {
      console.error('Failed to approve volunteer:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { volunteerApplied: false });
    } catch (err) {
      console.error('Failed to reject volunteer:', err);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY remove this user account?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      await deleteDoc(doc(db, 'volunteers', id)).catch(() => {});
      setMenuOpenId(null);
    } catch (err) {
      console.error('Failed to remove user:', err);
    }
  };

  const handleDemoteVolunteer = async (id: string) => {
    if (!window.confirm('Remove volunteer status and demote to standard user?')) return;
    try {
      await updateDoc(doc(db, 'users', id), { 
        role: 'user', 
        volunteerApplied: false,
        responderActive: false,
        isVolunteerApproved: false
      });
      await deleteDoc(doc(db, 'volunteers', id)).catch(() => {});
      setMenuOpenId(null);
      setActiveSubTab('users');
    } catch (err) {
      console.error('Failed to demote volunteer:', err);
    }
  };

  const tierDistribution = useMemo(() => {
    const counts = { Shikhar: 0, Prabhav: 0, Drishti: 0, Sankalp: 0, Udaan: 0, Prarambh: 0 };
    let total = 0;
    people.forEach(p => {
      const tier = p.tier || (p.role === 'volunteer' ? 'Prarambh' : null);
      if (tier && counts[tier as keyof typeof counts] !== undefined) {
        counts[tier as keyof typeof counts]++;
        total++;
      }
    });

    const config = [
      { label: 'Shikhar', color: '#ef4444' },
      { label: 'Prabhav', color: '#f97316' },
      { label: 'Drishti', color: '#a855f7' },
      { label: 'Sankalp', color: '#f59e0b' },
      { label: 'Udaan', color: '#3b82f6' },
      { label: 'Prarambh', color: '#86efac' },
    ];
    return config.map(item => ({
      ...item,
      percentage: total === 0 ? 0 : Math.round(((counts[item.label as keyof typeof counts] || 0) / total) * 100)
    }));
  }, [people]);

  return (
    <div className="flex flex-col gap-8" onClick={() => setMenuOpenId(null)}>
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">People Management</h2>
          <p className="text-slate-500 font-medium">Manage responders, orchestration tiers and trust scoring.</p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
          {['users', 'volunteers', 'applicants'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab as any)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeSubTab === tab 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
        <div className="col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="relative w-64">
                   <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                   <input type="text" placeholder={`Search ${activeSubTab}...`} className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-700/10" />
               </div>
               <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Filter</button>
                  <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Export</button>
               </div>
            </div>

            <div className="divide-y divide-slate-50">
               {people.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No {activeSubTab} found</div>
               ) : people.map((person) => (
                 <div key={person.id} className="px-8 py-5 flex items-center gap-6 hover:bg-slate-50/50 transition-colors group relative">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                       {person.photoURL ? <img src={person.photoURL} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">person</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-0.5">
                          <h5 className="font-extrabold text-slate-900 truncate">{person.name || 'Unknown User'}</h5>
                          {(person.tier || person.role === 'volunteer' || activeSubTab === 'applicants') && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter shadow-sm ${
                              person.tier === 'Shikhar' ? 'bg-red-600 text-white' : person.tier === 'Prabhav' ? 'bg-orange-500 text-white' : (activeSubTab === 'applicants' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600')
                            }`}>
                              {activeSubTab === 'applicants' ? 'New Applicant' : (person.tier || 'Prarambh')}
                            </span>
                          )}
                       </div>
                       <p className="text-xs text-slate-500 font-medium truncate">{person.email || person.id}</p>
                    </div>

                    <div className="flex items-center gap-12 shrink-0">
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Experience</p>
                          <p className="text-sm font-black text-slate-900">{person.impactScore || 0} pts</p>
                       </div>
                       
                       {activeSubTab === 'applicants' ? (
                         <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleApprove(person.id); }} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800">Approve</button>
                            <button onClick={(e) => { e.stopPropagation(); handleReject(person.id); }} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50">Reject</button>
                         </div>
                       ) : (
                         <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === person.id ? null : person.id); }} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-700 transition-all">
                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                            </button>
                            {menuOpenId === person.id && (
                              <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                                 <div className="p-2 flex flex-col">
                                    <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-50 text-left transition-all">
                                       <span className="material-symbols-outlined text-sm text-slate-400">analytics</span>
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">View Activity</span>
                                    </button>
                                    <div className="h-[1px] bg-slate-100 my-1 mx-2" />
                                    {activeSubTab === 'volunteers' && (
                                       <button onClick={() => handleDemoteVolunteer(person.id)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-50 text-left group">
                                          <span className="material-symbols-outlined text-sm text-red-400 group-hover:text-red-600">person_remove</span>
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">Demote User</span>
                                       </button>
                                    )}
                                    <button onClick={() => handleRemoveUser(person.id)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-50 text-left group">
                                       <span className="material-symbols-outlined text-sm text-red-400 group-hover:text-red-600">delete</span>
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">Delete Account</span>
                                    </button>
                                 </div>
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {activeSubTab !== 'applicants' && (
            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">League Rankings</h4>
                  <h3 className="text-2xl font-black mb-6 tracking-tight">{activeSubTab === 'volunteers' ? 'Volunteer' : 'User'} Distribution</h3>
                  <div className="flex flex-col gap-4">
                     {tierDistribution.map(tier => (
                       <div key={tier.label} className="flex flex-col gap-1.5 opacity-90">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                             <span>{tier.label}</span>
                             <span>{tier.percentage}%</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                             <div className="h-full rounded-full transition-all duration-500" style={{ width: `${tier.percentage}%`, backgroundColor: tier.color }}></div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 blur-3xl rounded-full"></div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-[32px] p-6">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600">bolt</span>
                 </div>
                 <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest leading-none">Promotion AI</h4>
              </div>
              <p className="text-xs text-amber-800 font-medium leading-relaxed mb-4">AI recommends responders for promotion based on reliability and activity.</p>
                 <button onClick={handleReviewPromotions} className="w-full py-3 rounded-2xl bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all">Review Promotions</button>
          </div>
        </div>
      </div>

      {isReviewingPromotions && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-amber-50/30">
                 <div>
                    <h3 className="text-xl font-black text-slate-900">Promotion AI Review</h3>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mt-1">Found {promotionCandidates.length} potential upgrades</p>
                 </div>
                 <button onClick={() => setIsReviewingPromotions(false)} className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {promotionCandidates.length === 0 ? (
                   <div className="text-center py-12">
                      <p className="text-slate-400 font-bold uppercase text-[10px]">No new candidates meeting criteria</p>
                   </div>
                 ) : promotionCandidates.map(candidate => (
                   <div key={candidate.id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0"><span className="text-xl font-black text-blue-700">{(candidate.name || 'U').charAt(0)}</span></div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-extrabold text-slate-900">{candidate.name}</h4>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 line-through uppercase tracking-tighter">{candidate.tier || 'Prarambh'}</span>
                            <span className="material-symbols-outlined text-xs text-slate-300">arrow_forward</span>
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{candidate.suggestedTier}</span>
                         </div>
                         <p className="text-[10px] text-slate-500 font-medium mt-2 italic">"{candidate.reason}"</p>
                      </div>
                      <button onClick={() => handleApprovePromotion(candidate.id, candidate.suggestedTier!)} className="px-6 py-3 rounded-2xl bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/10">Verify & Promote</button>
                   </div>
                 ))}
              </div>
              <div className="p-6 border-t border-slate-50 bg-slate-50/50 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">System identifies candidates based on verified field impact and community trust scores.</div>
           </div>
        </div>
      )}
    </div>
  );
};
