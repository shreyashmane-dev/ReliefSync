import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useIsMobile } from '../../core/hooks/useIsMobile';
import { useStore } from '../../core/store/useStore';

const severityColors: Record<string, { main: string; bg: string }> = {
  Critical: { main: '#dc2626', bg: '#fef2f2' },
  High: { main: '#ea580c', bg: '#fff7ed' },
  Medium: { main: '#ca8a04', bg: '#fefce8' },
  Low: { main: '#16a34a', bg: '#f0fdf4' },
};

const statusMap: Record<string, { label: string; color: string; progress: number }> = {
  open: { label: 'Awaiting Action', color: '#64748b', progress: 15 },
  assigned: { label: 'Team Dispatched', color: '#1d4ed8', progress: 55 },
  completed: { label: 'Mission Resolved', color: '#059669', progress: 100 },
};

export const MyReports = () => {
  const { user } = useStore();
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'reports'), where('userId', '==', user.id), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user?.id]);

  const filtered = reports.filter(r => statusFilter === 'all' || r.status === statusFilter);

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently remove this report?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'reports', id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mission Tracker</h1>
           <p className="text-slate-500 font-medium mt-1">Real-time status of your field reports and responder activity.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
           {['all', 'open', 'assigned', 'completed'].map(s => (
             <button 
               key={s}
               onClick={() => setStatusFilter(s)}
               className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 statusFilter === s ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
           <span className="material-symbols-outlined animate-spin text-blue-700">progress_activity</span>
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authenticating feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
           <span className="material-symbols-outlined text-4xl mb-2">assignment_late</span>
           <p className="text-sm font-bold uppercase tracking-widest">No reports in this category</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map(report => (
            <div key={report.id} className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-700/5 transition-all group overflow-hidden relative">
               <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: severityColors[report.severity]?.main }} />
               
               <div className="flex flex-col gap-8">
                  <div className="flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-3 mb-3">
                           <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: severityColors[report.severity]?.bg, color: severityColors[report.severity]?.main }}>
                              {report.severity}
                           </span>
                           <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                              ID: {report.id.slice(-6).toUpperCase()}
                           </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{report.title}</h3>
                        <p className="text-sm text-slate-500 font-medium max-w-xl">{report.description}</p>
                     </div>
                     <div className="flex flex-col items-end gap-3">
                        <span className="px-4 py-2 rounded-2xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-100">
                           {statusMap[report.status]?.label || report.status}
                        </span>
                        {report.status !== 'completed' && (
                          <button 
                            disabled={deletingId === report.id}
                            onClick={() => handleDelete(report.id)}
                            className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center"
                          >
                             <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                     </div>
                  </div>

                  <div className="flex flex-col gap-3">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Mission Progress</span>
                        <span className="text-blue-700">{statusMap[report.status]?.progress}% Complete</span>
                     </div>
                     <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div 
                          className="h-full rounded-full bg-blue-600 transition-all duration-1000" 
                          style={{ width: `${statusMap[report.status]?.progress}%` }}
                        />
                     </div>
                  </div>

                  {report.status === 'assigned' && (
                    <div className="flex gap-4 p-6 bg-blue-50/50 rounded-[24px] border border-blue-100 transition-all animate-in slide-in-from-bottom-2">
                       <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                          <span className="material-symbols-outlined">support_agent</span>
                       </div>
                       <div className="flex-1">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Responder Unit Dispatched</p>
                          <p className="text-sm text-slate-700 font-bold">ETA: {report.etaText || 'Calculating...'}</p>
                          <p className="text-xs text-slate-500 font-medium mt-1">{report.progressNote || 'Unit is moving towards your GPS coordinates.'}</p>
                       </div>
                    </div>
                  )}

                  {report.status === 'completed' && (
                    <div className="flex gap-4 p-6 bg-green-50/50 rounded-[24px] border border-green-100">
                       <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-600/20">
                          <span className="material-symbols-outlined">task_alt</span>
                       </div>
                       <div className="flex-1">
                          <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Resolution Achieved</p>
                          <p className="text-sm text-slate-700 font-bold">Status: Successfully Resolved</p>
                          <p className="text-xs text-slate-500 font-medium mt-1">Thank you for your report. Information has been archived for regional analysis.</p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
