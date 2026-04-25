import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { useIsMobile } from '../../core/hooks/useIsMobile';

const MISSION_STATUS = {
  assigned: { label: 'Assigned', color: '#737685', bg: '#f1f5f9', icon: 'bookmark' },
  in_progress: { label: 'In Progress', color: '#0052cc', bg: '#eff6ff', icon: 'navigation' },
  completed: { label: 'Completed', color: '#15803d', bg: '#dcfce7', icon: 'check_circle' },
  archived: { label: 'Archived', color: '#737685', bg: '#f1f5f9', icon: 'archive' },
};

export const VolunteerTasks = () => {
  const { user } = useStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, 'reports'),
      where('assignedTo', '==', user.id),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'active') {
      return tasks.filter(t => t.status !== 'resolved');
    }
    return tasks.filter(t => t.status === 'resolved');
  }, [tasks, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">My Missions</h1>
        <p className="text-on-surface-variant text-sm">Manage your active operations and track completions.</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl w-full">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'active' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          Active Operations
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'completed' ? 'bg-white shadow-sm text-green-700' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          History
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          <p className="text-sm font-bold uppercase tracking-widest">Accessing secure files...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-slate-400 text-3xl">task_alt</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">No {activeTab} missions</h2>
          <p className="text-on-surface-variant text-sm max-w-xs mt-2">
            {activeTab === 'active' 
              ? 'Find new missions in the Jobs tab to start contributing.' 
              : 'Completed missions will appear here once verified.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredTasks.map(task => {
            const mStatus = (MISSION_STATUS as any)[task.missionStatus || 'assigned'];
            return (
              <div key={task.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/my-tasks/${task.id}`)}>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <span 
                          className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: mStatus.bg, color: mStatus.color }}
                        >
                          {mStatus.label}
                        </span>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{task.category}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-on-surface truncate">{task.title}</h3>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                       <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-700 text-xl">map</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface truncate max-w-[150px]">
                          {typeof task.location === 'string' ? task.location : task.location?.address || 'View on map'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Incident Location</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-on-surface">15 mins</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Arrival</span>
                    </div>
                  </div>
                </div>
                
                {activeTab === 'active' && (
                  <div className="px-4 pb-4 flex gap-2">
                     <button className="flex-1 h-11 rounded-xl bg-blue-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-base">near_me</span>
                        Start Mission
                     </button>
                     <button className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 flex items-center justify-center active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-base">emergency_share</span>
                     </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
