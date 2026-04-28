import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { googleMapsLibraries, googleMapsScriptId } from '../../core/maps/googleMaps';
import { useStore } from '../../core/store/useStore';
import { getSocket } from '../../core/services/socketClient';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { AdvancedMarker } from '../../components/AdvancedMarker';
import { googleMapsMapId } from '../../config/googleMaps';

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
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: googleMapsScriptId,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
  });

  const getTimestampValue = (value: any) => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

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
      where('taskId', '==', taskId)
    );
    const unsubUpdates = onSnapshot(
      q, 
      (snap) => {
        try {
          const sortedUpdates = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));

          setUpdates(sortedUpdates);
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
    const responderName = user?.name || 'Responder';
    const statusContent: Record<string, { progressNote: string; etaText: string; title: string; message: string }> = {
      assigned: {
        progressNote: `${responderName} has accepted your report and is preparing for dispatch.`,
        etaText: 'Dispatch in progress',
        title: 'Responder assigned',
        message: `${responderName} is reviewing the situation and preparing to move.`,
      },
      in_progress: {
        progressNote: `${responderName} is actively responding and heading toward the reported location.`,
        etaText: 'Responder en route',
        title: 'Responder started field response',
        message: `${responderName} started the mission and is now moving toward the incident location.`,
      },
      completed: {
        progressNote: `${responderName} marked the mission complete.`,
        etaText: 'Mission complete',
        title: 'Mission completed',
        message: `${responderName} finished the response work for this incident.`,
      },
    };

    const statusUpdate = statusContent[newStatus];
    try {
      await updateDoc(doc(db, 'reports', taskId), {
        missionStatus: newStatus,
        ...(statusUpdate ? {
          progressNote: statusUpdate.progressNote,
          etaText: statusUpdate.etaText,
          assignedResponderName: responderName,
        } : {}),
        updatedAt: serverTimestamp(),
      });

      // Log update
      await addDoc(collection(db, 'taskUpdates'), {
        taskId,
        volunteerId: user?.id,
        userName: responderName,
        type: 'status_update',
        status: newStatus,
        title: statusUpdate?.title || 'Mission status updated',
        message: statusUpdate?.message || `${responderName} updated the mission status to ${newStatus.replace('_', ' ')}.`,
        createdAt: serverTimestamp(),
      });

      const socket = getSocket();
      socket?.emit('task_status_update', {
        taskId,
        status: newStatus,
        volunteerId: user?.id,
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
  const destinationLat = Number(task.location?.lat);
  const destinationLng = Number(task.location?.lng);
  const hasDestinationCoordinates = Number.isFinite(destinationLat) && Number.isFinite(destinationLng);
  const destinationAddress =
    typeof task.location === 'string' ? task.location : task.location?.address?.trim();

  const handleNavigate = () => {
    const destination = hasDestinationCoordinates
      ? `${destinationLat},${destinationLng}`
      : destinationAddress;

    if (!destination) {
      alert('User location is unavailable for this task.');
      return;
    }

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(navigationUrl, '_blank', 'noopener,noreferrer');
  };

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
          {isLoaded && hasDestinationCoordinates && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: destinationLat, lng: destinationLng }}
              zoom={15}
              onLoad={(map) => {
                setMapInstance(map);
              }}
              options={{ disableDefaultUI: true, gestureHandling: 'none', mapId: googleMapsMapId }}
            >
              <AdvancedMarker
                map={mapInstance}
                position={{ lat: destinationLat, lng: destinationLng }}
                title={task.title || 'Incident location'}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    background: '#2563eb',
                    border: '2px solid white',
                    borderRadius: '50%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                />
              </AdvancedMarker>
            </GoogleMap>
          )}
          <div className="absolute top-4 right-4 flex gap-2">
             <button
                onClick={handleNavigate}
                className="bg-white shadow-md p-2 rounded-lg flex items-center gap-2 text-xs font-bold text-blue-700 active:scale-95 transition-transform"
             >
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
