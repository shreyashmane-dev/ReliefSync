import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase/config';

export const BackupCoordination = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'backupRequests'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const handleDispatch = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'backupRequests', reqId), { status: 'dispatched', updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to dispatch backup:', err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
       <div className="flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Backup Coordination</h2>
          <p className="text-slate-500 font-medium">Escalation management and AI-suggested backup dispatching.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
         <div className="col-span-3 flex flex-col gap-8">
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
               <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest text-lg">Active Backup Requests</h4>
               </div>

               <div className="p-2 flex flex-col gap-2">
                  {requests.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No backup requests</div>
                  ) : requests.map(req => (
                    <div key={req.id} className="p-6 rounded-[32px] border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex flex-col gap-6 group">
                       <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined font-bold">sos</span>
                             </div>
                             <div>
                                <h5 className="font-extrabold text-slate-900 mb-1">Backup req from {req.volunteerName || 'Volunteer'}</h5>
                                <div className="flex items-center gap-2">
                                   <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                     req.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                     {req.severity || 'Normal'}
                                   </span>
                                   <span className="text-[10px] font-bold text-slate-400 border-l border-slate-200 pl-2 uppercase">{req.incidentTitle || 'Active Mission'}</span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                               req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                             }`}>
                               {req.status}
                             </span>
                          </div>
                       </div>

                       <div className="flex items-center gap-4">
                          <div className="flex-1 bg-white/60 p-4 rounded-2xl border border-dashed border-slate-200">
                             <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">Incident Context</p>
                             <p className="text-xs text-slate-500 font-medium italic">"{req.reason || 'Additional personnel required for crowd management and safety.'}"</p>
                          </div>
                          {req.status === 'pending' && (
                            <button 
                              onClick={() => handleDispatch(req.id)}
                              className="h-full px-8 py-4 rounded-2xl bg-blue-700 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20"
                            >
                              Dispatch Backup
                            </button>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Escalation Rules Panel */}
         <div className="flex flex-col gap-6">
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
               <h4 className="text-sm font-black tracking-tight text-slate-900 mb-6">Escalation Thresholds</h4>
               <div className="flex flex-col gap-6">
                  {[
                    { label: 'Unanswered Request', value: '15m', desc: 'Expand radius by 5km' },
                    { label: 'Critical Gap', value: '8m', desc: 'Notify Tier 3 Platinum' },
                    { label: 'Multi-Victim', value: 'Auto', desc: 'Dual-responder dispatch' },
                  ].map(rule => (
                    <div key={rule.label} className="flex flex-col gap-1.5">
                       <div className="flex justify-between items-center font-bold">
                          <span className="text-[11px] text-slate-500 uppercase">{rule.label}</span>
                          <span className="text-xs text-blue-700">{rule.value}</span>
                       </div>
                       <p className="text-[11px] font-medium text-slate-400">{rule.desc}</p>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
