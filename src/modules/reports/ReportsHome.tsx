import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../core/firebase/config';
import { useIsMobile } from '../../core/hooks/useIsMobile';
import { useStore } from '../../core/store/useStore';
import { getInitials } from '../../core/utils/user';
import { SmartLocationField, type LocationData } from './SmartLocationField';

const CATEGORIES = [
  { label: 'Medical', icon: 'medical_services', color: '#dc2626', bg: '#fef2f2' },
  { label: 'Fire', icon: 'local_fire_department', color: '#f97316', bg: '#fff7ed' },
  { label: 'Flood', icon: 'water_drop', color: '#2563eb', bg: '#eff6ff' },
  { label: 'Shelter', icon: 'home_work', color: '#059669', bg: '#ecfdf5' },
  { label: 'Earthquake', icon: 'crisis_alert', color: '#7c3aed', bg: '#f5f3ff' },
  { label: 'Other', icon: 'more_horiz', color: '#4b5563', bg: '#f9fafb' },
];

const SEVERITY = ['Critical', 'High', 'Medium', 'Low'];

const severityColors: Record<string, { main: string; bg: string }> = {
  Critical: { main: '#dc2626', bg: '#fef2f2' },
  High: { main: '#ea580c', bg: '#fff7ed' },
  Medium: { main: '#ca8a04', bg: '#fefce8' },
  Low: { main: '#16a34a', bg: '#f0fdf4' },
};

export const ReportsHome = () => {
  const { user } = useStore();
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  
  const [form, setForm] = useState<{
    title: string;
    category: string;
    severity: string;
    location: LocationData | null;
    description: string;
    isAnonymous: boolean;
  }>({
    title: '',
    category: 'Medical',
    severity: 'Medium',
    location: null,
    description: '',
    isAnonymous: false,
  });

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const myReports = useMemo(() => reports.filter(r => r.userId === user?.id), [reports, user]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchCat = activeCategory === 'All' || r.category === activeCategory;
      const matchSearch = !search || 
        r.title?.toLowerCase().includes(search.toLowerCase()) || 
        r.description?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [reports, activeCategory, search]);

  const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files].slice(0, 4));
  };

  const uploadImages = async () => {
    const urls: string[] = [];
    for (const file of selectedImages) {
      const path = `report_media/${user?.id}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      urls.push(await getDownloadURL(fileRef));
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const imageUrls = await uploadImages();
      await addDoc(collection(db, 'reports'), {
        ...form,
        userId: user.id,
        userName: form.isAnonymous ? 'Anonymous' : user.name,
        userPhotoURL: form.isAnonymous ? null : user.photoURL,
        imageUrls,
        status: 'open',
        verifiedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowModal(false);
      setForm({ title: '', category: 'Medical', severity: 'Medium', location: null, description: '', isAnonymous: false });
      setSelectedImages([]);
    } catch (err) {
      console.error(err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Dynamic Header */}
      <div className="relative overflow-hidden rounded-[40px] bg-blue-700 p-8 md:p-12 text-white shadow-2xl shadow-blue-700/20">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
            Help is One <span className="text-blue-200">Report</span> Away.
          </h1>
          <p className="text-blue-100 font-medium md:text-lg mb-8 leading-relaxed">
            ReliefSync connects your field observations with emergency responders and AI coordination in real-time.
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className="px-8 py-4 rounded-2xl bg-white text-blue-700 font-black uppercase tracking-[0.1em] hover:bg-blue-50 transition-all shadow-xl active:scale-95 flex items-center gap-3"
          >
            <span className="material-symbols-outlined font-bold">add_circle</span>
            File Incident Report
          </button>
        </div>
        
        {/* Abstract Shapes */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-blue-400/20 blur-[60px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Quick Stats & My Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Incident Radius Analysis</h4>
            <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
               {['All', ...CATEGORIES.map(c => c.label)].map(cat => (
                 <button 
                   key={cat}
                   onClick={() => setActiveCategory(cat)}
                   className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                     activeCategory === cat ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
            </div>
         </div>
         <div className="bg-slate-900 rounded-[32px] p-6 text-white flex flex-col justify-between">
            <div>
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">My Reports</h4>
               <div className="flex items-end gap-3 text-3xl font-black">
                  {myReports.length}
                  <span className="text-[10px] font-bold text-green-400 uppercase mb-2 tracking-tighter">● Live Tracking</span>
               </div>
            </div>
            <div className="flex gap-1 h-1.5 mt-4">
               {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className={`flex-1 rounded-full ${i <= myReports.length ? 'bg-blue-500' : 'bg-white/10'}`} />
               ))}
            </div>
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col gap-8">
         <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Active Community Feed</h2>
            <div className="relative w-64 hidden md:block">
               <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
               <input 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 type="text" 
                 placeholder="Search activity..."
                 className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all"
               />
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              <div className="col-span-2 py-20 flex flex-col items-center justify-center gap-4">
                 <span className="material-symbols-outlined animate-spin text-blue-700">progress_activity</span>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synchronizing satellite data</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="col-span-2 py-20 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-slate-300">
                 <span className="material-symbols-outlined text-4xl mb-2">assignment_late</span>
                 <p className="text-sm font-bold uppercase tracking-widest">No matching incidents</p>
              </div>
            ) : filteredReports.map(report => (
              <div key={report.id} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-xl hover:shadow-blue-700/5 transition-all group flex flex-col gap-6">
                 <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: CATEGORIES.find(c => c.label === report.category)?.bg || '#f1f5f9' }}>
                          <span className="material-symbols-outlined" style={{ color: CATEGORIES.find(c => c.label === report.category)?.color || '#64748b' }}>
                            {CATEGORIES.find(c => c.label === report.category)?.icon || 'emergency'}
                          </span>
                       </div>
                       <div>
                          <h3 className="font-extrabold text-slate-900 leading-tight mb-1 group-hover:text-blue-700 transition-colors">{report.title}</h3>
                          <div className="flex items-center gap-2">
                             <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest" style={{ backgroundColor: severityColors[report.severity]?.bg, color: severityColors[report.severity]?.main }}>
                                {report.severity}
                             </span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase border-l border-slate-200 pl-2">
                                {report.category}
                             </span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest underline underline-offset-4 decoration-blue-700/30">
                          {report.status}
                       </p>
                    </div>
                 </div>

                 {report.imageUrls && report.imageUrls[0] && (
                   <div className="aspect-video rounded-[24px] overflow-hidden bg-slate-100 border border-slate-100">
                      <img src={report.imageUrls[0]} className="w-full h-full object-cover" alt="Evidence" />
                   </div>
                 )}

                 <p className="text-sm text-slate-600 font-medium leading-relaxed line-clamp-3">
                   {report.description}
                 </p>

                 <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm overflow-hidden">
                          {report.userPhotoURL ? <img src={report.userPhotoURL} className="w-full h-full object-cover" /> : getInitials(report.userName)}
                       </div>
                       <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{report.userName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase tracking-widest">
                       <span className="material-symbols-outlined text-base">verified</span>
                       {report.verifiedBy?.length || 0} Confirmed
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] w-full max-w-[600px] max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-500">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                   <h2 className="text-xl font-black text-slate-900 leading-none">New Incident Report</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Satellite-linked field submission</p>
                 </div>
                 <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-slate-400">close</span>
                 </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 hide-scrollbar">
                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incident Category</label>
                    <div className="grid grid-cols-3 gap-3">
                       {CATEGORIES.map(cat => (
                         <button 
                           key={cat.label}
                           type="button"
                           onClick={() => setForm({ ...form, category: cat.label })}
                           className={`p-4 rounded-3xl border transition-all flex flex-col items-center gap-2 ${
                             form.category === cat.label ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                           }`}
                         >
                            <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-tight">{cat.label}</span>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Severity Level</label>
                       <select 
                         value={form.severity}
                         onChange={(e) => setForm({ ...form, severity: e.target.value })}
                         className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all h-14 appearance-none"
                       >
                          {SEVERITY.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                       <input 
                         required
                         value={form.title}
                         onChange={(e) => setForm({ ...form, title: e.target.value })}
                         placeholder="Brief title..."
                         className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all h-14"
                       />
                    </div>
                 </div>

                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precise Location</label>
                    <SmartLocationField 
                      value={form.location}
                      onChange={(loc) => setForm({ ...form, location: loc })}
                    />
                 </div>

                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Situation Description</label>
                    <textarea 
                      required
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Explain the situation and immediate needs..."
                      className="w-full p-6 rounded-[32px] bg-slate-50 border border-slate-100 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all min-h-[120px] resize-none"
                    />
                 </div>

                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Evidence Photos (Max 4)</label>
                    <div className="flex gap-4 flex-wrap">
                       {selectedImages.map((file, i) => (
                         <div key={i} className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-100 relative group">
                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                            >
                               <span className="material-symbols-outlined text-white text-sm">close</span>
                            </button>
                         </div>
                       ))}
                       {selectedImages.length < 4 && (
                         <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                            <input type="file" hidden accept="image/*" multiple onChange={handleImageSelection} />
                            <span className="material-symbols-outlined text-slate-300">add_a_photo</span>
                         </label>
                       )}
                    </div>
                 </div>

                 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input 
                      type="checkbox"
                      checked={form.isAnonymous}
                      onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
                      className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="flex-1">
                       <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Post Anonymously</p>
                       <p className="text-[10px] text-slate-500 font-medium">Your handler ID will be shown instead of your name.</p>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 h-16 rounded-3xl bg-slate-100 text-slate-500 font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                       Cancel
                    </button>
                    <button 
                      disabled={submitting || !form.location}
                      className="flex-[2] h-16 rounded-3xl bg-blue-700 text-white font-black uppercase tracking-[0.1em] shadow-xl shadow-blue-700/30 hover:bg-blue-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                       {submitting ? 'Submitting...' : 'Confirm Submission'}
                       {!submitting && <span className="material-symbols-outlined">rocket_launch</span>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
