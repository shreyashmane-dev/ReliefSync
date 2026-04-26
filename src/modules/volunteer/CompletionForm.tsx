import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, storage } from '../../core/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStore } from '../../core/store/useStore';

export const CompletionForm = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [form, setForm] = useState({
    description: '',
    peopleAssisted: 0,
    resourcesDelivered: '',
    issuesEncountered: '',
    impactNotes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !user?.id) return;
    setSubmitting(true);

    try {
      // 1. Upload evidence photos
      const photoURLs = [];
      for (const file of images) {
        const sRef = ref(storage, `completions/${taskId}/${Date.now()}_${file.name}`);
        const result = await uploadBytes(sRef, file);
        const url = await getDownloadURL(result.ref);
        photoURLs.push(url);
      }

      // 2. Add completion record
      const completionRef = await addDoc(collection(db, 'completionSubmissions'), {
        taskId,
        volunteerId: user.id,
        ...form,
        evidencePhotos: photoURLs,
        createdAt: serverTimestamp(),
      });

      // 3. Update task status to resolved
      await updateDoc(doc(db, 'reports', taskId), {
        status: 'completed',
        missionStatus: 'completed',
        completedAt: serverTimestamp(),
        completionId: completionRef.id,
      });

      // 4. Update impact points
      const pointsEarned = 100 + (form.peopleAssisted * 10);
      const newScore = (user.impactScore || 0) + pointsEarned;
      await updateDoc(doc(db, 'users', user.id), {
        impactScore: newScore,
      });
      setUser({ ...user, impactScore: newScore });

      alert(`Mission accomplished! You earned ${pointsEarned} impact points.`);
      navigate('/impact');
    } catch (err) {
      console.error(err);
      alert('Failed to submit completion. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-on-surface">arrow_back</span>
        </button>
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-on-surface leading-tight">Impact Reporting</h1>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Evidence Submission</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm">
           <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Completion Summary *</label>
              <textarea 
                required
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Describe what was achieved..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500 min-h-[100px]"
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">People Assisted *</label>
                <input 
                  type="number"
                  required
                  min="0"
                  value={form.peopleAssisted}
                  onChange={e => setForm({...form, peopleAssisted: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Resources Delivered</label>
                <input 
                  type="text"
                  value={form.resourcesDelivered}
                  onChange={e => setForm({...form, resourcesDelivered: e.target.value})}
                  placeholder="e.g. 5 Food Kits, 2 Blankets"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500"
                />
              </div>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm">
           <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Evidence Photos (Recommended)</label>
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                 {images.map((img, i) => (
                    <div key={i} className="w-20 h-20 rounded-xl bg-slate-100 relative shrink-0 overflow-hidden border border-slate-200">
                       <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" alt="Evidence" />
                       <button 
                        type="button"
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"
                       >
                          <span className="material-symbols-outlined text-[12px]">close</span>
                       </button>
                    </div>
                 ))}
                 <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-slate-400 text-lg">add_a_photo</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Upload</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={e => e.target.files && setImages([...images, ...Array.from(e.target.files)])} />
                 </label>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm">
           <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Private Field Notes</label>
              <textarea 
                value={form.impactNotes}
                onChange={e => setForm({...form, impactNotes: e.target.value})}
                placeholder="Internal feedback for coordinators..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500 min-h-[80px]"
              />
           </div>
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full h-14 rounded-2xl bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-700/30 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? (
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-xl">verified</span>
          )}
          Verify Completion
        </button>
      </form>
    </div>
  );
};
