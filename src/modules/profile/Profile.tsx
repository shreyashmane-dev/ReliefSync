import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, updateProfile, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { 
  computeImpactPoints, 
  getLeague
} from '../../core/utils/impact';
import { getInitials } from '../../core/utils/user';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartLocationPicker } from '../../components/SmartLocationPicker';

export const Profile = () => {
  const { user, setUser } = useStore();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  
  // Component States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editLocation, setEditLocation] = useState(user?.location_text || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Phone Verification Flow (Firebase Real)
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings States
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'reports'), where('userId', '==', user.id));
    
    if (user.responderActive === undefined) {
      updateDoc(doc(db, 'users', user.id), { responderActive: true });
      setUser({ ...user, responderActive: true });
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [user?.id, setUser, user?.responderActive]);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

  const resetRecaptcha = () => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
    setRecaptchaKey((value) => value + 1);
  };

  const impactPoints = computeImpactPoints({ 
    reports: reports, 
    phoneVerified: user?.phoneVerified 
  });
  const leagueData = getLeague(impactPoints);

  const toggleStatus = async () => {
    if (!user?.id) return;
    const newStatus = !user.responderActive;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { responderActive: newStatus });
      setUser({ ...user, responderActive: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !user?.id) return;
    
    if (phoneNumber && phoneNumber !== user?.phoneNumber && !user?.phoneVerified) {
      setIsVerifyingPhone(true);
      initiateSms();
      return;
    }

    setIsUpdating(true);
    try {
      await updateProfile(auth.currentUser, { displayName: editName });
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        name: editName,
        location_text: editLocation,
        phoneNumber: phoneNumber
      });
      setUser({ ...user, name: editName, location_text: editLocation, phoneNumber: phoneNumber });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser || !user?.id) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size too large. Please upload an image under 5MB.');
      return;
    }

    setIsUpdating(true);
    try {
      const storageRef = ref(storage, `profiles/${user.id}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload error:', error);
          alert('Failed to upload image.');
          setIsUpdating(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update Firebase Auth profile
          await updateProfile(auth.currentUser!, { photoURL: downloadURL });
          
          // Update Firestore user document
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { photoURL: downloadURL });
          
          // Update local store
          setUser({ ...user, photoURL: downloadURL });
          setIsUpdating(false);
        }
      );
    } catch (error) {
      console.error('Error in handlePhotoChange:', error);
      setIsUpdating(false);
    }
  };

  // Real Firebase Phone Auth Logic
  const setupRecaptcha = () => {
    if (!recaptchaContainerRef.current) return;

    // Reuse the existing verifier instead of rendering reCAPTCHA repeatedly
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: 'invisible',
      callback: () => {
        console.log('Recaptcha resolved');
      },
      'expired-callback': () => {
        resetRecaptcha();
      }
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const initiateSms = async () => {
    if (!phoneNumber || isUpdating) return;
     
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${digitsOnly}`;
     
    setIsUpdating(true);
    try {
      const appVerifier = setupRecaptcha();
      if (!appVerifier) throw new Error('Recaptcha container missing');
      await appVerifier.render();
       
      const result = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(result);
      setPhoneStep('otp');
    } catch (err: any) {
      console.error('Firebase SMS Error:', err);

      const errorMessage =
        err?.code === 'auth/operation-not-allowed'
          ? 'Phone sign-in is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method > Phone.'
          : err?.message || 'Failed to send verification SMS.';

      // Firebase phone auth failures often invalidate the verifier token.
      // Recreate it on the next attempt instead of reusing a stale instance.
      resetRecaptcha();

      alert(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtpSubmission = async () => {
    if (!user?.id || otp.some(d => d === '') || !confirmationResult) return;
    
    setIsUpdating(true);
    const verificationCode = otp.join('');
    
    try {
      await confirmationResult.confirm(verificationCode);
      
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { 
        phoneVerified: true,
        phoneNumber: phoneNumber 
      });
      
      setUser({ ...user, phoneVerified: true, phoneNumber: phoneNumber });
      setIsVerifyingPhone(false);
      setPhoneStep('phone');
      setConfirmationResult(null);
      alert('Phone Identity Secured Successfully!');
    } catch (err: any) {
      console.error('OTP Verification Error:', err);
      alert('Invalid code. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
  };

  const handleApplyVolunteer = async () => {
    if (!user?.id) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        volunteerApplied: true
      });
      setUser({ ...user, volunteerApplied: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    navigate('/');
  };

  return (
    <div className="bg-[#fcfdfe] dark:bg-slate-950 min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900 antialiased overflow-x-hidden transition-colors duration-500">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8 space-y-8">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <motion.button 
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all font-bold text-sm"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Back
          </motion.button>
          
          <div 
            onClick={toggleStatus}
            className="flex items-center gap-3 cursor-pointer group"
          >
             <div className={`px-4 py-2 rounded-2xl border transition-all flex items-center gap-2 shadow-sm ${user?.responderActive ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800'}`}>
                <div className={`w-2 h-2 rounded-full ${user?.responderActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${user?.responderActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                   Status: {user?.responderActive ? 'Active' : 'Off-Duty'}
                </span>
             </div>
          </div>
        </div>

        {/* Identity Section (Primary focus) */}
        <motion.div 
          layout
          className="bg-white dark:bg-slate-900 rounded-[48px] p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-slate-50 dark:border-slate-800 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
            <div className="relative group">
              <div className="w-40 h-40 rounded-full border-[12px] border-slate-50 dark:border-slate-800 shadow-2xl overflow-hidden bg-slate-100 transition-transform duration-700 group-hover:scale-105 relative">
                {user?.photoURL ? (
                  <img src={user.photoURL} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl font-black text-slate-300 dark:text-slate-600">
                    {getInitials(user?.name)}
                  </div>
                )}
                {isUpdating && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                    <span className="material-symbols-outlined text-white animate-spin">sync</span>
                  </div>
                )}
              </div>
              <button 
                onClick={handlePhotoClick}
                className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 hover:scale-110 transition-all transform"
              >
                <span className="material-symbols-outlined text-xl">add_a_photo</span>
              </button>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>

            <div className="flex-1 space-y-6">
              <AnimatePresence mode="wait">
                {!isEditing ? (
                  <motion.div key="view" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center gap-4 mb-4">
                      <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{user?.name || 'Identity Unknown'}</h2>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 justify-center md:justify-start">
                       <div className="flex items-center gap-1.5 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">
                         <span className="material-symbols-outlined text-blue-600 text-lg">location_on</span>
                         {user?.location_text || 'Active Global Node'}
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 text-slate-900 dark:text-white font-black text-lg outline-none"
                      placeholder="Display Name"
                    />
                    <input 
                      type="text" 
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 text-slate-600 dark:text-slate-300 font-bold text-sm outline-none"
                      placeholder="Operational Sector"
                    />
                    <div className="flex items-center gap-2">
                       <div className="bg-slate-50 dark:bg-slate-800 px-4 py-4 rounded-2xl border border-slate-100 text-sm font-black text-slate-400 uppercase tracking-tighter text-[10px]">+91</div>
                       <div className="relative flex-1">
                         <input 
                           type="tel" 
                           value={phoneNumber}
                           onChange={(e) => setPhoneNumber(e.target.value)}
                           className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 text-slate-900 dark:text-white font-bold text-sm outline-none pr-28"
                           placeholder="Phone Number"
                         />
                         {!user?.phoneVerified && (
                           <button 
                             onClick={initiateSms}
                             className="absolute right-2 top-2 bottom-2 px-4 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                           >
                             Verify Node
                           </button>
                         )}
                       </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={handleUpdateProfile}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20"
                      >
                        {isUpdating ? 'Syncing...' : 'Update Node Identity'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                  <span className="material-symbols-outlined text-base">verified</span>
                  {leagueData.current.name} Responder
                </div>
                {user?.phoneVerified ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    <span className="material-symbols-outlined text-base">phonelink_ring</span>
                    Identity Secured
                  </div>
                ) : (
                  <div className="flex flex-col items-center md:items-start gap-4 w-full">
                    <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-700 text-[10px] font-black uppercase tracking-widest border border-rose-100">
                      <span className="material-symbols-outlined text-base">warning</span>
                      Pending Verification
                    </div>
                    <button 
                      onClick={() => setIsVerifyingPhone(true)}
                      className="px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg"
                    >
                      Verify Now
                    </button>
                  </div>
                )}
                {user?.role !== 'volunteer' && (
                  user?.volunteerApplied ? (
                    <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-100">
                      <span className="material-symbols-outlined text-base">hourglass_top</span>
                      Volunteer Request Pending
                    </div>
                  ) : (
                    <button
                      onClick={handleApplyVolunteer}
                      className="px-4 py-2.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10"
                    >
                      Apply for Volunteer
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Interactive Phone Verification Overlay (Integrated) */}
          <AnimatePresence>
            {isVerifyingPhone && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="mt-12 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-slate-100 dark:border-slate-700 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Phone Verification</h4>
                  <button onClick={() => setIsVerifyingPhone(false)} className="material-symbols-outlined text-slate-300 hover:text-rose-500">close</button>
                </div>

                <AnimatePresence mode="wait">
                  {phoneStep === 'phone' ? (
                    <motion.div key="phone-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <p className="text-[11px] font-bold text-slate-400">Confirm your mobile number to receive a secure link.</p>
                      <div className="flex gap-2">
                         <div className="bg-white dark:bg-slate-900 px-4 py-4 rounded-2xl border border-slate-100 text-sm font-black text-slate-900 dark:text-white">+91</div>
                         <input 
                           type="tel"
                           value={phoneNumber}
                           onChange={(e) => setPhoneNumber(e.target.value)}
                           className="flex-1 px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 text-sm font-black text-slate-900 dark:text-white outline-none"
                           placeholder="Enter Mobile Number"
                         />
                      </div>
                      <button 
                        onClick={initiateSms}
                        className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                      >
                        {isUpdating ? 'Transmitting...' : 'Send Secure Code'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="otp-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <p className="text-[11px] font-bold text-slate-400">Enter the 6-digit code sent to your terminal.</p>
                      <div className="flex justify-between gap-2 max-w-sm mx-auto">
                         {otp.map((d, i) => (
                           <input 
                             key={i}
                             ref={el => { otpInputRefs.current[i] = el; }}
                             type="text"
                             maxLength={1}
                             value={d}
                             onChange={(e) => handleOtpChange(i, e.target.value)}
                             onKeyDown={(e) => handleOtpKeyDown(i, e)}
                             className="w-12 h-16 text-center text-2xl font-black rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-100"
                           />
                         ))}
                      </div>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={verifyOtpSubmission}
                          className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20"
                        >
                          {isUpdating ? 'Verifying Identity...' : 'Confirm Authentication'}
                        </button>
                        <button onClick={() => setPhoneStep('phone')} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-500">Resend Code</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Tactical Performance Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: 'target', val: reports.length, label: 'Missions', color: 'text-blue-600', path: '/my-reports' },
            { icon: 'history', val: reports.length * 8 || 850, label: 'Hours', color: 'text-emerald-500', path: '/impact' },
            { icon: 'emergency_share', val: 12, label: 'Deployments', color: 'text-rose-500', path: '/my-tasks' }
          ].map((stat) => (
            <motion.div key={stat.label} onClick={() => navigate(stat.path)} className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-sm border border-slate-50 dark:border-slate-800 flex flex-col items-center text-center cursor-pointer hover:bg-slate-50 transition-all">
              <span className={`material-symbols-outlined text-4xl mb-4 ${stat.color}`}>{stat.icon}</span>
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.val}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Strategic Coverage (Volunteer Only) */}
        {user?.role === 'volunteer' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[40px] p-10 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
          >
             <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                   <span className="material-symbols-outlined text-blue-600">radar</span>
                </div>
                <div>
                   <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Strategic Coverage</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define your primary operational base</p>
                </div>
             </div>
             
             <SmartLocationPicker
               volunteerId={user.id}
               existingLocation={(user as any)?.location || null}
               onLocationSave={() => {
                 // Update local state if needed
               }}
             />
          </motion.div>
        )}

        {/* Global Control Center */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
          <div onClick={toggleDarkMode} className="px-8 py-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 cursor-pointer hover:bg-slate-50">
             <div className="flex items-center gap-6">
                <span className="material-symbols-outlined text-slate-400 text-2xl">{darkMode ? 'dark_mode' : 'light_mode'}</span>
                <div>
                   <h4 className="text-[15px] font-black text-slate-800 dark:text-white">Interface Theme</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{darkMode ? 'Operational Dark' : 'Strategic Light'}</p>
                </div>
             </div>
             <div className="w-12 h-7 bg-slate-100 dark:bg-slate-800 rounded-full p-1 transition-all">
                <motion.div animate={{ x: darkMode ? 20 : 0 }} className="w-5 h-5 bg-white rounded-full shadow-md" />
             </div>
          </div>
          {[
            { icon: 'phonelink_ring', label: 'Phone Identity', sub: user?.phoneNumber || 'Not Linked', action: () => setIsVerifyingPhone(true) },
            { icon: 'notifications', label: 'Alert Protocol', sub: 'Push Notifications' },
            { icon: 'lock', label: 'Security Core', sub: 'Encryption Standard' },
          ].map((item) => (
            <div key={item.label} onClick={item.action} className="px-8 py-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 cursor-pointer hover:bg-slate-50 group">
               <div className="flex items-center gap-6">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 transition-colors text-2xl">{item.icon}</span>
                <div>
                  <h4 className="text-[15px] font-black text-slate-800 dark:text-white">{item.label}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.sub}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-200">chevron_right</span>
            </div>
          ))}
          <button onClick={handleSignOut} className="w-full px-8 py-10 flex items-center justify-center gap-3 text-rose-500 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-rose-50 transition-all">
            <span className="material-symbols-outlined">logout</span>
            Terminate Authorized Session
          </button>
        </div>
      </div>
      
      {/* Invisible Recaptcha Anchor */}
      <div key={recaptchaKey} ref={recaptchaContainerRef} id="recaptcha-container" />
    </div>
  );
};
