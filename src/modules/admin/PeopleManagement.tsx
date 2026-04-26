import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase/config';

export const PeopleManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'volunteers' | 'applicants'>('volunteers');
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: () => void;
    
    if (activeSubTab === 'users') {
      unsub = onSnapshot(collection(db, 'users'), (snap) => {
        setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    } else if (activeSubTab === 'volunteers') {
      unsub = onSnapshot(collection(db, 'volunteers'), (snap) => {
        setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.approved === true));
        setLoading(false);
      });
    } else {
      // Applicants
      unsub = onSnapshot(collection(db, 'volunteers'), (snap) => {
        setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.approved !== true));
        setLoading(false);
      });
    }

    return () => unsub && unsub();
  }, [activeSubTab]);

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'volunteers', id), { approved: true });
      // Also update user role to volunteer if not set
      await updateDoc(doc(db, 'users', id), { role: 'volunteer' }).catch(() => {});
    } catch (err) {
      console.error('Failed to approve volunteer:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'volunteers', id));
    } catch (err) {
      console.error('Failed to reject volunteer:', err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
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
        {/* Main List */}
        <div className="col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="relative w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder={`Search ${activeSubTab}...`}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-700/10 transition-all"
                  />
               </div>
               <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Filter</button>
                  <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Export</button>
               </div>
            </div>

            <div className="divide-y divide-slate-50">
               {people.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No {activeSubTab} found</div>
               ) : people.map((person: any) => (
                 <div key={person.id} className="px-8 py-5 flex items-center gap-6 hover:bg-slate-50/50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                       {person.photoURL ? (
                         <img src={person.photoURL} className="w-full h-full object-cover" />
                       ) : (
                         <span className="material-symbols-outlined text-slate-400">person</span>
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-0.5">
                          <h5 className="font-extrabold text-slate-900 truncate">{person.name || 'Unknown User'}</h5>
                          {(person.tier || person.role === 'volunteer') && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter shadow-sm ${
                              person.tier === 'Guardian' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {person.tier || 'Volunteer'}
                            </span>
                          )}
                       </div>
                       <p className="text-xs text-slate-500 font-medium truncate">{person.email || person.history || person.id}</p>
                    </div>

                    <div className="flex items-center gap-12 shrink-0">
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Experience</p>
                          <p className="text-sm font-black text-slate-900">
                            {person.impactScore || 0} pts
                          </p>
                       </div>
                       
                       {activeSubTab === 'applicants' ? (
                         <div className="flex gap-2">
                            <button 
                              onClick={() => handleApprove(person.id)}
                              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleReject(person.id)}
                              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </button>
                         </div>
                       ) : (
                         <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-700 hover:border-blue-200 transition-all">
                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                         </button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Analytics & Rankings Sidebar */}
        <div className="flex flex-col gap-8">
           <div className="bg-blue-700 rounded-[32px] p-6 text-white shadow-xl shadow-blue-700/20 relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">League Rankings</h4>
                <h3 className="text-2xl font-black mb-6 tracking-tight">Tier Distribution</h3>
                
                <div className="flex flex-col gap-4">
                   {[
                     { label: 'Guardian', color: '#fff', percentage: 2 },
                     { label: 'Platinum', color: '#fff', percentage: 8 },
                     { label: 'Gold', color: '#fff', percentage: 24 },
                     { label: 'Bronze', color: '#fff', percentage: 66 },
                   ].map(tier => (
                     <div key={tier.label} className="flex flex-col gap-1.5 opacity-90">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span>{tier.label}</span>
                           <span>{tier.percentage}%</span>
                        </div>
                        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                           <div className="h-full bg-white rounded-full" style={{ width: `${tier.percentage}%` }}></div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full"></div>
           </div>

           <div className="bg-amber-50 border border-amber-200 rounded-[32px] p-6">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600">bolt</span>
                 </div>
                 <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest leading-none">Promotion AI</h4>
              </div>
              <p className="text-xs text-amber-800 font-medium leading-relaxed mb-4">
                AI recommends 12 responders for promotion to <strong>Platinum</strong> tier based on reliability and activity.
              </p>
              <button className="w-full py-3 rounded-2xl bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all">
                Review Promotions
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
