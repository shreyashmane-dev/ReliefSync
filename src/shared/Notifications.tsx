import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../core/firebase/config';
import { useStore } from '../core/store/useStore';

const getCreatedAtMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const Notifications = () => {
  const { user } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Listen to notifications: either directly for this user or for 'admin' role if user is admin
    const q = query(
      collection(db, 'notifications'),
      where('receiverId', '==', user.id),
      limit(50)
    );

    // If admin, also listen to admin notifications
    const adminQ = user.role === 'admin' ? query(
        collection(db, 'notifications'),
        where('role', '==', 'admin'),
        limit(50)
    ) : null;

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onSnapshot(q, (snap) => {
       const userNotifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setNotifications(prev => {
         const combined = [...userNotifs, ...prev.filter(p => p.role === 'admin')];
         // Sort and remove duplicates
         return combined
           .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
           .sort((a: any, b: any) => {
              const timeA = getCreatedAtMillis(a.createdAt);
              const timeB = getCreatedAtMillis(b.createdAt);
              return timeB - timeA;
           });
       });
    }));

    if (adminQ) {
       unsubscribers.push(onSnapshot(adminQ, (snap) => {
          const adminNotifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setNotifications(prev => {
            const combined = [...adminNotifs, ...prev.filter(p => !p.role || p.role !== 'admin')];
            return combined
              .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
              .sort((a: any, b: any) => {
                 const timeA = getCreatedAtMillis(a.createdAt);
                 const timeB = getCreatedAtMillis(b.createdAt);
                 return timeB - timeA;
              });
          });
       }));
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribers.forEach(u => u());
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const playAlert = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => {
        // Silently fail if auto-play is blocked by the browser
        if (e.name !== 'NotAllowedError') {
          console.error('Audio play failed:', e);
        }
      });
    } catch (e) {
      // Background catch for synchronous issues
    }
  };

  // Play sound when new unread notification arrives
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (unreadCount > lastCountRef.current) {
        playAlert();
    }
    lastCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
          isOpen ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        <span className={`material-symbols-outlined ${unreadCount > 0 ? 'fill animate-pulse' : ''}`}>notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
           <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Alert Center</h4>
              {unreadCount > 0 && (
                <span className="text-[9px] font-black text-blue-700 uppercase px-2 py-0.5 bg-blue-50 rounded-md">
                  {unreadCount} New
                </span>
              )}
           </div>

           <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                   <span className="material-symbols-outlined text-slate-200 text-4xl mb-2">notifications_off</span>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active alerts</p>
                </div>
              ) : notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`p-5 flex gap-4 transition-all hover:bg-slate-50/50 ${!notif.read ? 'bg-blue-50/30' : ''}`}
                >
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                     notif.message.includes('🚨') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                   }`}>
                      <span className="material-symbols-outlined text-xl">emergency</span>
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold leading-relaxed mb-1 ${!notif.read ? 'text-slate-900' : 'text-slate-500'}`}>
                        {notif.message}
                      </p>
                      <div className="flex justify-between items-center">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                            {getCreatedAtMillis(notif.createdAt)
                              ? new Date(getCreatedAtMillis(notif.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Just now'}
                         </span>
                         {!notif.read && (
                           <button 
                             onClick={() => markAsRead(notif.id)}
                             className="text-[9px] font-black text-blue-700 uppercase tracking-widest hover:underline"
                           >
                              Mark Read
                           </button>
                         )}
                      </div>
                   </div>
                </div>
              ))}
           </div>

           <div className="p-4 border-t border-slate-50 bg-slate-50/30 text-center">
              <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                View All Notifications
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
