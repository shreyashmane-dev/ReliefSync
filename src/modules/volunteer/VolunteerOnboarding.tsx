import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';

const TOUR_STEPS = [
  {
    title: 'Welcome, Responder',
    description: 'You are now a verified ReliefSync responder. You can accept tasks, coordinate missions, and save lives in your community.',
    icon: 'verified_user',
    color: '#1d4ed8',
    image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=400',
  },
  {
    title: 'Discover Jobs',
    description: 'The Jobs tab is your field radar. View available missions, filter by urgency, and use "Take This Job" to claim assignments.',
    icon: 'dashboard',
    color: '#1d4ed8',
    target: 'jobs-tab',
  },
  {
    title: 'Operational Workspace',
    description: 'In My Tasks, you guide active missions. Use live navigation, update progress, and Request Backup if things get tough.',
    icon: 'task',
    color: '#1d4ed8',
    target: 'tasks-tab',
  },
  {
    title: 'Build Your Impact',
    description: 'Every mission earned points. Grow through leagues from Wood to Guardian and unlock operational merit badges.',
    icon: 'analytics',
    color: '#15803d',
    target: 'impact-tab',
  },
  {
    title: 'Field AI Guidance',
    description: 'Your Assistant is now field-aware. Ask for risk assessments, protocol summaries, or supply checklists anytime.',
    icon: 'smart_toy',
    color: '#7c3aed',
    target: 'assistant-tab',
  },
  {
    title: 'Stay Notified',
    description: 'Watch the top bar for official admin alerts, task updates, and backup responses in real-time.',
    icon: 'notifications',
    color: '#b91c1c',
    target: 'top-bar',
  },
  {
    title: 'Document Success',
    description: 'After every mission, submit evidence and notes. Your completion reports are the heartbeat of our relief accuracy.',
    icon: 'verified',
    color: '#15803d',
  },
  {
    title: 'Ready to Respond',
    description: 'You have the tools, the trust, and the impact. The field is waiting. Good luck out there.',
    icon: 'emergency',
    color: '#b91c1c',
  }
];

export const VolunteerOnboarding = () => {
  const { user, setUser } = useStore();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show only if volunteer but haven't seen tour
    if (user?.role === 'volunteer' && !user?.volunteerTourSeen) {
      setIsVisible(true);
    }
  }, [user]);

  const handleComplete = async () => {
    if (!user?.id) return;
    setIsVisible(false);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        volunteerTourSeen: true
      });
      setUser({ ...user, volunteerTourSeen: true });
    } catch (err) {
      console.error(err);
    }
  };

  if (!isVisible) return null;

  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] w-full max-w-[400px] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        {/* Visual Header */}
        <div className="relative h-48 flex items-center justify-center overflow-hidden">
          {current.image ? (
             <img src={current.image} className="absolute inset-0 w-full h-full object-cover" alt="Welcome" />
          ) : (
             <div className="absolute inset-0 opacity-10" style={{ backgroundColor: current.color }} />
          )}
          <div className="z-10 w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center animate-bounce">
             <span className="material-symbols-outlined text-4xl" style={{ color: current.color }}>{current.icon}</span>
          </div>
          
          {/* Progress Indicator */}
          <div className="absolute top-6 left-0 w-full px-6 flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 flex flex-col gap-4 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {current.title}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">
              {current.description}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
             {isLast ? (
                <button 
                  onClick={handleComplete}
                  className="w-full h-14 rounded-2xl bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-700/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  Start Volunteering
                </button>
             ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={handleComplete}
                    className="flex-1 h-14 rounded-2xl bg-slate-100 text-slate-500 font-bold text-sm active:scale-95 transition-all"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={() => setStep(s => s + 1)}
                    className="flex-[2] h-14 rounded-2xl bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-700/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    Next
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
             )}
             
             {!isLast && !isFirst && (
                <button 
                  onClick={() => setStep(s => s - 1)}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                >
                  Wait, Go Back
                </button>
             )}
          </div>
        </div>
      </div>
      
      {/* Target Highlights (Simplified Spotlight) */}
      {current.target && (
         <div className="fixed inset-0 pointer-events-none border-[100vmax] border-slate-900/40 z-[199] transition-all duration-500" />
      )}
    </div>
  );
};
