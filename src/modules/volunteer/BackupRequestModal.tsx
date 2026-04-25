import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';

const BACKUP_TYPES = [
  { id: 'volunteers', label: 'More Volunteers', icon: 'groups', description: 'Need extra hands for manual labor or search.' },
  { id: 'medical', label: 'Medical Support', icon: 'medical_services', description: 'Requires professional medical assistance.' },
  { id: 'transport', label: 'Heavy Transport', icon: 'local_shipping', description: 'Need trucks or vehicles for evacuation.' },
  { id: 'escalation', label: 'High Escalation', icon: 'priority_high', description: 'Situation worsening. Security or specialized teams needed.' },
];

export const BackupRequestModal = ({ taskId, onClose }: { taskId: string, onClose: () => void }) => {
  const { user } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState('volunteers');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'backupRequests'), {
        taskId,
        type: selectedType,
        note,
        volunteerId: user.id,
        volunteerName: user.name,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      alert('Backup request sent. Nearby responders and admins have been notified.');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to send backup request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
       <div className="bg-white rounded-[32px] w-full max-w-[450px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <div>
                <h2 className="text-xl font-black text-on-surface">Request Backup</h2>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">Select the type of support needed.</p>
             </div>
             <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface">close</span>
             </button>
          </div>

          <div className="p-6 flex flex-col gap-4">
             <div className="grid grid-cols-1 gap-3">
                {BACKUP_TYPES.map(type => (
                   <button 
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${selectedType === type.id ? 'border-red-600 bg-red-50/50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                   >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${selectedType === type.id ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                         <span className="material-symbols-outlined text-2xl">{type.icon}</span>
                      </div>
                      <div className="flex flex-col">
                         <span className={`text-sm font-black ${selectedType === type.id ? 'text-red-700' : 'text-on-surface'}`}>{type.label}</span>
                         <span className="text-[10px] font-medium text-slate-500">{type.description}</span>
                      </div>
                   </button>
                ))}
             </div>

             <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Additional Details</label>
                <textarea 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. 2 people trapped on 2nd floor, water rising fast."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-red-500 min-h-[80px]"
                />
             </div>

             <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 mt-2"
             >
                {submitting ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span> : <span className="material-symbols-outlined text-xl">emergency_share</span>}
                Send Priority Alert
             </button>
          </div>
       </div>
    </div>
  );
};
