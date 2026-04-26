import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

const libraries: ("places" | "geometry" | "visualization")[] = ['places', 'visualization'];

import { BackupRequestModal } from './BackupRequestModal';

export const TaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'reports', taskId), 
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            setTask({ id: snapshot.id, ...snapshot.data() });
          } else {
            console.warn(`Task ${taskId} not found`);
          }
        } catch (err) {
          console.error('Error processing TaskDetail snapshot:', err);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('TaskDetail Firestore query failed:', error);
        setLoading(false);
      }
    );

    // Real-time updates thread
    const q = query(
      collection(db, 'taskUpdates'),
      where('taskId', '==', taskId),
      orderBy('createdAt', 'desc')
    );
    const unsubUpdates = onSnapshot(
      q, 
      (snap) => {
        try {
          setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error('Error processing taskUpdates snapshot:', err);
        }
      },
      (error) => {
        console.error('taskUpdates Firestore query failed:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubUpdates();
    };
  }, [taskId]);

  const postUpdate = async () => {
    if (!newUpdate.trim() || !taskId || !user?.id) return;
    const msg = newUpdate;
    setNewUpdate('');
    try {
      await addDoc(collection(db, 'taskUpdates'), {
        taskId,
        message: msg,
        userId: user.id,
        userName: user.name,
        type: 'field_note',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setNewUpdate(msg);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!taskId) return;
    setStatusUpdating(true);
    try {
      await updateDoc(doc(db, 'reports', taskId), {
        missionStatus: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Log update
      await addDoc(collection(db, 'taskUpdates'), {
        taskId,
        volunteerId: user?.id,
        type: 'status_update',
        status: newStatus,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) return (
     <div className="py-20 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
        <p className="text-sm font-bold uppercase tracking-widest">Hydrating mission data...</p>
     </div>
  );

  if (!task) return <div className="p-8 text-center">Task not found.</div>;

  const missionStatus = task.missionStatus || 'assigned';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-on-surface leading-tight">Mission Detail</h1>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">#{task.id.slice(-6)}</span>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
               <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider">{task.category}</span>
               <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${task.severity === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{task.severity}</span>
            </div>
            <h2 className="text-2xl font-black text-on-surface">{task.title}</h2>
          </div>
          
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {task.description}
          </p>
        </div>

        {/* Map Section */}
        <div className="h-48 bg-slate-100 relative">
          {isLoaded && task.location?.lat && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: task.location.lat, lng: task.location.lng }}
              zoom={15}
              options={{ disableDefaultUI: true, gestureHandling: 'none' }}
            >
              <MarkerF position={{ lat: task.location.lat, lng: task.location.lng }} />
            </GoogleMap>
          )}
          <div className="absolute top-4 right-4 flex gap-2">
             <button className="bg-white shadow-md p-2 rounded-lg flex items-center gap-2 text-xs font-bold text-blue-700 active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-sm">navigation</span>
                Navigate
             </button>
          </div>
        </div>
      </div>

      {/* Checklist / Supplies placeholder */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm">
         <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-700 text-[20px]">checklist</span>
            Field Checklist
         </h3>
         <div className="flex flex-col gap-3">
            {['Arrive at location', 'Assess immediate risk', 'Stableize casualties', 'Distribute supplies', 'Document evidence'].map((step, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                 <div className="w-5 h-5 rounded border-2 border-slate-200 flex items-center justify-center">
                    {i === 0 && <span className="material-symbols-outlined text-[14px] text-green-600 font-bold">check</span>}
                 </div>
                 <span className={`text-sm ${i === 0 ? 'text-slate-400 line-through' : 'text-on-surface'}`}>{step}</span>
              </div>
            ))}
         </div>
      </div>
      {/* Field Updates / Discussion */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm">
         <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-700 text-[20px]">forum</span>
            Field Updates
         </h3>
         
         <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto no-scrollbar">
            {updates.length === 0 ? (
               <p className="text-xs text-slate-400 italic text-center py-4">No field updates yet. Start documenting your progress.</p>
            ) : (
               updates.map((update: any) => (
                  <div key={update.id} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-blue-700 uppercase">{update.userName || 'Responder'}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(update.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                     <p className="text-sm text-slate-700 font-medium leading-relaxed">{update.message}</p>
                  </div>
               ))
            )}
         </div>

         <div className="flex gap-2 mt-2">
            <input 
              value={newUpdate}
              onChange={e => setNewUpdate(e.target.value)}
              placeholder="Post a field note..."
              className="flex-1 h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-medium focus:border-blue-500 outline-none"
              onKeyDown={e => e.key === 'Enter' && postUpdate()}
            />
            <button 
              onClick={postUpdate}
              disabled={!newUpdate.trim()}
              className="w-11 h-11 rounded-xl bg-blue-700 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            >
               <span className="material-symbols-outlined text-base">send</span>
            </button>
         </div>
      </div>

      {/* Persistence Action Bar */}
      <div className="fixed bottom-24 left-0 w-full px-4 safe-pb z-40">
         <div className="max-w-[500px] mx-auto bg-white/80 backdrop-blur rounded-2xl border border-white shadow-xl p-3 flex gap-2">
            {missionStatus === 'assigned' && (
              <button 
                onClick={() => updateStatus('in_progress')}
                disabled={statusUpdating}
                className="flex-1 h-12 rounded-xl bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-700/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                {statusUpdating ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-base">play_arrow</span>}
                Start Task
              </button>
            )}
            {missionStatus === 'in_progress' && (
              <button 
                onClick={() => navigate(`/my-tasks/${taskId}/complete`)}
                className="flex-1 h-12 rounded-xl bg-green-700 text-white font-bold text-sm shadow-lg shadow-green-700/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Complete Mission
              </button>
            )}
            <button 
              onClick={() => setShowBackupModal(true)}
              className="h-12 w-12 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center active:scale-95 transition-transform"
            >
               <span className="material-symbols-outlined text-base">emergency_share</span>
            </button>
         </div>
      </div>

      {showBackupModal && taskId && (
        <BackupRequestModal taskId={taskId} onClose={() => setShowBackupModal(false)} />
      )}
    </div>
  );
};
