import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, updateProfile } from 'firebase/auth';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { getLeague } from '../../core/utils/impact';
import { getInitials } from '../../core/utils/user';

export const Profile = () => {
  const { user, setUser } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    location_text: user?.location_text || '',
    anonymousHandle: user?.anonymousHandle || '',
  });

  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'reports'), where('userId', '==', user.id));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user?.id]);

  const league = getLeague(user?.impactScore || 0);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const path = `profile_photos/${user.id}/avatar-${Date.now()}`;
      const sRef = ref(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateDoc(doc(db, 'users', user.id), { photoURL: url });
      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: url });
      setUser({ ...user, photoURL: url });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { ...form, updatedAt: serverTimestamp() });
      setUser({ ...user, ...form });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 pb-20">
      {/* Identity Command Center */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[48px] p-10 md:p-14 text-white shadow-2xl">
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="relative">
              <div className="w-44 h-44 rounded-[56px] overflow-hidden border-4 border-white/10 shadow-2xl relative bg-slate-800">
                {user?.photoURL ? (
                  <img src={user.photoURL} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl font-black text-blue-500">
                    {getInitials(user?.name)}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-white animate-spin mb-2">progress_activity</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Uploading</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center border-4 border-slate-900 shadow-xl hover:scale-110 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
              <input ref={fileRef} type="file" hidden onChange={handlePhotoUpload} />
            </div>

            <div className="flex-1 text-center md:text-left">
               <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight">{user?.name}</h1>
                  <div className="inline-flex items-center gap-3 px-5 py-1.5 rounded-full border border-white/10 bg-white/5 self-center md:self-auto">
                     <span className="material-symbols-outlined text-blue-400">{league.current.icon}</span>
                     <span className="text-[10px] font-black uppercase tracking-widest">{league.current.name}</span>
                  </div>
               </div>
               <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-xl mb-8">
                 {user?.bio || 'Strategic operative ready for primary response and community coordination.'}
               </p>
               
               <div className="flex items-center justify-center md:justify-start gap-8">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Impact XP</span>
                     <span className="text-3xl font-black text-blue-500">{user?.impactScore || 0}</span>
                  </div>
                  <div className="w-[1px] h-12 bg-white/10" />
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Missions</span>
                     <span className="text-3xl font-black text-white">{reports.length}</span>
                  </div>
                  <div className="w-[1px] h-12 bg-white/10" />
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Trust</span>
                     <span className="text-3xl font-black text-green-500">{Math.min(100, (user?.impactScore || 0) * 2 + 50)}%</span>
                  </div>
               </div>
            </div>
         </div>
         {/* Background Visuals */}
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
         <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
         {/* Detailed Activity Feed */}
         <div className="md:col-span-8 flex flex-col gap-8">
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xl font-black uppercase tracking-tight">Recent Operational Activity</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last 5 Events</span>
               </div>

               {reports.length === 0 ? (
                 <div className="py-20 text-center text-slate-300">
                    <span className="material-symbols-outlined text-4xl mb-2">history</span>
                    <p className="text-xs font-bold uppercase tracking-widest">No activity logged yet</p>
                 </div>
               ) : (
                 <div className="flex flex-col gap-6">
                    {reports.slice(0, 5).map(report => (
                      <div key={report.id} className="flex gap-6 p-6 rounded-[32px] bg-slate-50/50 border border-slate-100 hover:border-blue-200 transition-all group">
                         <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <span className="material-symbols-outlined">assignment</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                               <h4 className="text-sm font-black text-slate-900 truncate">{report.title}</h4>
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{formatDate(report.createdAt)}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium line-clamp-1 mb-3">{report.description}</p>
                            <div className="flex items-center gap-3">
                               <span className="px-2 py-0.5 rounded-md bg-white border border-slate-100 text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                  {report.status}
                               </span>
                               <span className="text-[9px] font-bold text-blue-600 uppercase">
                                  {report.category}
                               </span>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Comprehensive Meta Box */}
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-black uppercase tracking-tight mb-8">Account Meta Records</h3>
               <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-[28px] bg-slate-50 border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member Since</p>
                     <p className="text-sm font-bold text-slate-900">{formatDate(user?.createdAt || new Date())}</p>
                  </div>
                  <div className="p-6 rounded-[28px] bg-slate-50 border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Verified Identity</p>
                     <p className="text-sm font-bold text-slate-900">{user?.phoneVerified ? 'Legally Authenticated' : 'Pending Verification'}</p>
                  </div>
                  <div className="p-1.5 rounded-[28px] bg-slate-900 text-white col-span-2 flex items-center gap-4 px-8 py-5">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                         <span className="material-symbols-outlined text-white">fingerprint</span>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Global Secure ID</p>
                         <p className="text-xs font-mono font-bold text-blue-200">{user?.id}</p>
                      </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Settings & Credentials */}
         <div className="md:col-span-4 flex flex-col gap-8">
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-black uppercase tracking-tight mb-8">Personal Details</h3>
               <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Responder Handle</label>
                     <input 
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all"
                     />
                  </div>
                  <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Sector</label>
                     <input 
                        value={form.location_text}
                        onChange={e => setForm({...form, location_text: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-700/5 transition-all"
                     />
                  </div>
                  <button 
                     onClick={handleSave}
                     disabled={saving}
                     className="w-full py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                     {saving ? 'Syncing...' : 'Update Directives'}
                  </button>
               </div>
            </div>

            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-black uppercase tracking-tight mb-8">Operational Controls</h3>
               <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[28px] border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${user?.isAnonymous ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                           <span className="material-symbols-outlined text-sm">visibility_off</span>
                        </div>
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stealth Mode</p>
                           <p className="text-xs font-bold text-slate-900">{user?.isAnonymous ? 'Active' : 'Offline'}</p>
                        </div>
                     </div>
                     <button 
                        onClick={async () => {
                           const next = !user.isAnonymous;
                           await updateDoc(doc(db, 'users', user.id), { isAnonymous: next });
                           setUser({...user, isAnonymous: next});
                        }}
                        className={`w-10 h-6 rounded-full relative transition-all ${user?.isAnonymous ? 'bg-indigo-600' : 'bg-slate-200'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${user?.isAnonymous ? 'right-1' : 'left-1'}`} />
                     </button>
                  </div>

                  <button 
                    onClick={async () => { await signOut(auth); setUser(null); navigate('/'); }}
                    className="w-full py-4 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all mt-4"
                  >
                     Terminate Session
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
