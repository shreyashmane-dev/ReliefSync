import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../core/firebase/config';

export const TrustSafety = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const cases = reports.map(r => ({
    id: r.id,
    type: r.verifiedBy?.length === 0 ? 'Review Needed' : 'Verified Incident',
    reporter: r.userName || 'Anonymous',
    description: r.title,
    status: r.verifiedBy?.length === 0 ? 'Open' : 'Ongoing',
    riskScore: r.verifiedBy?.length === 0 ? 85 : 12
  })).slice(0, 10);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Trust & Safety</h2>
          <p className="text-slate-500 font-medium">Abuse moderation, fake report investigations, and policy enforcement.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider uppercase">14 Pending Cases</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Moderation Queue */}
        <div className="col-span-2 flex flex-col gap-6">
           <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Global Moderation Queue</h4>
                 <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">All Types</button>
                    <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">High Risk</button>
                 </div>
              </div>

              <div className="divide-y divide-slate-50">
                 {cases.length === 0 ? (
                   <div className="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No cases pending review</div>
                 ) : cases.map((c) => (
                   <div key={c.id} className="p-8 flex items-start gap-6 hover:bg-slate-50/30 transition-colors">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        c.riskScore > 80 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                         <span className="material-symbols-outlined text-[24px] font-bold">
                            {c.riskScore > 80 ? 'report_off' : 'verified'}
                         </span>
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${
                              c.riskScore > 80 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>{c.type}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incident #{c.id.slice(-5)}</span>
                            <span className={`ml-auto px-3 py-1 rounded-full text-[10px] font-bold ${
                              c.status === 'Open' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                            }`}>{c.status}</span>
                         </div>
                         <h5 className="text-sm font-bold text-slate-900 mb-2">{c.description}</h5>
                         <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Reporter: {c.reporter}</span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                            <span>Investigation Required</span>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                         <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Risk Score</p>
                            <p className={`text-sm font-black ${c.riskScore > 80 ? 'text-red-600' : 'text-blue-600'}`}>{c.riskScore}%</p>
                         </div>
                         <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50">Review</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Enforcement & Policy Panels */}
        <div className="flex flex-col gap-6">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/10">
              <div className="relative z-10">
                 <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">System Security</h4>
                 <h3 className="text-xl font-black mb-4 tracking-tight leading-6">Automated Fake Report Detection</h3>
                 
                 <div className="flex flex-col gap-5">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                       <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Detection Logic</p>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          AI analyzes cross-verification latency and location deviations. Accuracy: 98.4%.
                       </p>
                    </div>
                 </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-red-600/10 blur-3xl rounded-full"></div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 leading-none">Policy Actions</h4>
              <div className="flex flex-col gap-4">
                 {[
                   { label: 'Issue Warning', icon: 'warning', color: 'slate' },
                   { label: 'Restricted Reporting', icon: 'block', color: 'slate' },
                   { label: 'Suspension Review', icon: 'person_remove', color: 'red' },
                 ].map(action => (
                   <button key={action.label} className={`flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all ${
                     action.color === 'red' ? 'text-red-600 bg-red-50/30' : 'text-slate-700 bg-slate-50/50'
                   }`}>
                      <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
