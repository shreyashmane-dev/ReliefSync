import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { useIsMobile } from '../../core/hooks/useIsMobile';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ba1a1a',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

const SEVERITY_BG: Record<string, string> = {
  Critical: '#ffdad6',
  High: '#ffedd5',
  Medium: '#fef9c3',
  Low: '#dcfce7',
};

export const VolunteerJobs = () => {
  const { user } = useStore();
  const isMobile = useIsMobile();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');

  // Fetch only unassigned reports (Jobs)
  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter((doc: any) => !doc.assignedTo); // Double check filter
      
      setJobs(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTakeJob = async (jobId: string) => {
    if (!user?.id) return;
    setClaimingId(jobId);

    try {
      await runTransaction(db, async (transaction) => {
        const jobRef = doc(db, 'reports', jobId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new Error("Job does not exist!");
        }

        const data = jobDoc.data();
        if (data.assignedTo) {
          throw new Error("Job already claimed by another volunteer!");
        }

        // Claim the job
        transaction.update(jobRef, {
          assignedTo: user.id,
          assignedAt: serverTimestamp(),
          status: 'active',
          updatedAt: serverTimestamp(),
          missionStatus: 'assigned', // Initial mission state
        });
        
        // Log update
        const updateRef = doc(collection(db, 'taskUpdates'));
        transaction.set(updateRef, {
          taskId: jobId,
          volunteerId: user.id,
          type: 'claim',
          note: 'Task claimed by volunteer',
          createdAt: serverTimestamp(),
        });
      });
      
      alert('Mission successfully claimed! Check "My Tasks" to start.');
    } catch (error: any) {
      console.error("Transaction failed: ", error);
      alert(error.message || 'Failed to claim mission. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const filteredJobs = useMemo(() => {
    if (filter === 'All') return jobs;
    return jobs.filter(j => j.category === filter);
  }, [jobs, filter]);

  const categories = ['All', ...new Set(jobs.map(j => j.category))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Operations Console</h1>
          <p className="text-on-surface-variant text-sm mt-1">Discover available high-impact missions in your area.</p>
        </div>
        <div className="flex bg-surface-container rounded-lg p-1">
          {['All', 'Critical', 'High'].map(f => (
            <button
              key={f}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                (f === 'All' ? filter === 'All' : jobs.some(j => j.severity === f))
                  ? 'bg-white shadow-sm text-primary' 
                  : 'text-on-surface-variant'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              filter === cat 
                ? 'bg-blue-700 text-white border-blue-700' 
                : 'bg-white text-on-surface-variant border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          <p className="text-sm font-bold uppercase tracking-widest">Scanning for signals...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-slate-400 text-3xl">radar</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">Area Clear</h2>
          <p className="text-on-surface-variant text-sm max-w-xs mt-2">No active missions matching your criteria at this moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: SEVERITY_BG[job.severity], color: SEVERITY_COLORS[job.severity] }}
                      >
                        {job.severity}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{job.category}</span>
                      {job.isAnonymous && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                           <span className="material-symbols-outlined text-[12px]">visibility_off</span>
                           Anonymous
                        </div>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-on-surface truncate">{job.title}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-500">@{job.userName || 'Anonymous'}</span>
                       <div className="w-1 h-1 rounded-full bg-slate-300" />
                       <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-blue-600 font-bold">verified</span>
                          <span className="text-[10px] font-black text-blue-700 uppercase">Confidence: {Math.min(100, 60 + (Array.isArray(job.verifiedBy) ? job.verifiedBy.length : 0) * 10)}%</span>
                       </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-blue-700 font-black text-sm">2.4 km</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Distance</span>
                  </div>
                </div>

                <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  {job.description || 'No description provided for this incident.'}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Est. Effort</span>
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      2-3 Hours
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Affected</span>
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">groups</span>
                      5-10 People
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 mt-auto border-t border-slate-50 bg-slate-50/50 flex gap-2">
                <button 
                  onClick={() => handleTakeJob(job.id)}
                  disabled={!!claimingId}
                  className="flex-1 h-11 rounded-xl bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-700/20 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {claimingId === job.id ? (
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">pan_tool</span>
                  )}
                  Take This Job
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
