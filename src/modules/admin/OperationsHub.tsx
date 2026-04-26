import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../core/firebase/config';

export const OperationsHub = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setIsBroadcasting(true);
    try {
      await addDoc(collection(db, 'broadcasts'), {
        message: broadcastMsg,
        createdAt: serverTimestamp(),
        type: 'alert'
      });
      setBroadcastMsg('');
      alert('Broadcast sent to all responders!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  useEffect(() => {
    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubVolunteers = onSnapshot(collection(db, 'volunteers'), (snap) => {
      setVolunteerCount(snap.size);
    });

    return () => {
      unsubReports();
      unsubVolunteers();
    };
  }, []);

  const stats = [
    { label: 'Active Incidents', value: reports.filter(r => r.status === 'open' || r.status === 'active').length, trend: 'Live', color: 'blue' },
    { label: 'Unclaimed Urgent', value: reports.filter(r => r.status === 'open' && r.severity === 'Critical').length, trend: 'Critical', color: 'red' },
    { label: 'Verified Responders', value: volunteerCount, trend: 'Total', color: 'slate' },
    { label: 'AI Dispatch Rate', value: '89%', trend: '+5%', color: 'green' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Operations Hub</h2>
          <p className="text-slate-500 font-medium">Real-time crisis orchestration and AI dispatch monitoring.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">System Live</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                stat.trend === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Main Section */}
        <div className="col-span-2 flex flex-col gap-8">
           {/* Incident Feed */}
           <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Incident Feed</h4>
              <button className="text-blue-700 text-xs font-bold hover:underline">View All</button>
            </div>
            <div className="p-2">
              {reports.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-bold uppercase text-[10px]">No active incidents</div>
              ) : reports.slice(0, 5).map((report) => (
                <div key={report.id} className="p-4 rounded-2xl hover:bg-slate-50 transition-colors flex items-center gap-4 group">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    report.severity === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <span className="material-symbols-outlined">
                      {report.severity === 'Critical' ? 'fmd_bad' : 'emergency'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        report.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {report.severity}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {report.category} • {report.status}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-slate-900 truncate">{report.title}</h5>
                    <p className="text-xs text-slate-500 font-medium truncate">{report.description}</p>
                  </div>
                </div>
              ))}
            </div>
           </div>

           {/* AI Dispatch Monitor */}
           <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">AI Dispatch Monitor</h4>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Processing</span>
              </div>
            </div>
            <div className="p-8">
               <div className="flex flex-col gap-6">
                 <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
                  </div>
                  <div className="flex-1 p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.1em] mb-2">Operational Intelligence</p>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">Scanning for Tier 3 responders within a 5km radius of Sector 7. Optimization complete. Suggested dispatch units: 3.</p>
                  </div>
                 </div>
               </div>
            </div>
           </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="flex flex-col gap-6">
          {/* Strategic Broadcaster */}
          <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                   <span className="material-symbols-outlined text-white">campaign</span>
                </div>
                <div>
                   <h4 className="text-sm font-black uppercase tracking-widest leading-none">Broadcaster</h4>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Direct Field Push</p>
                </div>
             </div>
             
             <textarea 
               value={broadcastMsg}
               onChange={(e) => setBroadcastMsg(e.target.value)}
               placeholder="Type a critical alert for all responders..."
               className="w-full bg-slate-800 border border-slate-700 rounded-3xl p-5 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 min-h-[120px] mb-4 resize-none"
             />

             <button 
               onClick={handleSendBroadcast}
               disabled={isBroadcasting || !broadcastMsg.trim()}
               className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
               {isBroadcasting ? 'Processing...' : 'Dispatch to Field'}
               <span className="material-symbols-outlined text-sm">send</span>
             </button>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
             <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Resource Snapshot</h4>
             <div className="flex flex-col gap-5">
               {[
                 { label: 'Oxygen Tanks', value: 84, total: 100, color: '#1d4ed8' },
                 { label: 'Ambulances', value: 2, total: 5, color: '#dc2626' },
                 { label: 'Med-Kits', value: 156, total: 200, color: '#15803d' },
               ].map(r => (
                 <div key={r.label} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                       <span className="text-slate-500">{r.label}</span>
                       <span className="text-slate-900">{r.value} / {r.total}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full" 
                         style={{ width: `${(r.value / r.total) * 100}%`, backgroundColor: r.color }}
                       ></div>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
