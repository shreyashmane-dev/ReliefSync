import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { FullMapScreen } from '../../components/FullMapScreen';

export const OperationsHub = () => {
  const { user } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [adminAlerts, setAdminAlerts] = useState<any[]>([]);
  
  // Requested state variables
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assigningToReport, setAssigningToReport] = useState<any>(null);
  const [nearbyVolunteers, setNearbyVolunteers] = useState<any[]>([]);
  const [mapZoomed, setMapZoomed] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const reportRefs = useRef<any>({});

  const [assignmentSuccess, setAssignmentSuccess] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  useEffect(() => {
    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubVolunteers = onSnapshot(collection(db, 'volunteers'), (snap) => {
      setVolunteers(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    const qAdminAlerts = query(collection(db, 'notifications'), where('role', '==', 'admin'), limit(20));
    const unsubAdminAlerts = onSnapshot(qAdminAlerts, (snap) => {
      const nextAlerts = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAdminAlerts(nextAlerts);
    });

    return () => { unsubReports(); unsubVolunteers(); unsubAdminAlerts(); };
  }, []);

  const handleReportClick = (report: any) => {
    setSelectedReport(report);
    setActiveMarkerId(report.id);
    setAssigningToReport(report); // Show detail panel on map click too
    if (report.location?.lat && report.location?.lng) {
      setMapFocus({ lat: Number(report.location.lat), lng: Number(report.location.lng) });
    }
    
    // Smooth scroll list
    if (reportRefs.current[report.id]) {
      reportRefs.current[report.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleOpenAssign = (report: any) => {
    setAssigningToReport(report);
    setShowAssignPanel(true);
    setAssignmentSuccess(false);
  };

  const handleFinalAssign = async (v: any) => {
    if (!assigningToReport) return;
    setAssignmentLoading(true);
    try {
      // 1. Update report status
      await updateDoc(doc(db, 'reports', assigningToReport.id), {
        status: 'notifying',
        assignedVolunteerId: v.id,
        updatedAt: serverTimestamp()
      });

      // 2. Add notification for volunteer
      await addDoc(collection(db, 'notifications'), {
        userId: v.id,
        title: 'New Assignment Request',
        message: `Emergency: ${assigningToReport.title} in ${assigningToReport.location.area}. Please respond immediately.`,
        type: 'assignment',
        reportId: assigningToReport.id,
        status: 'sent',
        createdAt: serverTimestamp()
      });

      setAssignmentSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to send assignment request.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sortedVolunteers = useMemo(() => {
    if (!assigningToReport) return volunteers;
    return [...volunteers].map(v => ({
      ...v,
      distance: calculateDistance(
        Number(assigningToReport.location.lat), Number(assigningToReport.location.lng),
        Number(v.location?.lat || 0), Number(v.location?.lng || 0)
      )
    })).sort((a, b) => a.distance - b.distance);
  }, [volunteers, assigningToReport]);

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setIsBroadcasting(true);
    try {
      await addDoc(collection(db, 'broadcasts'), {
        message: broadcastMsg,
        createdAt: serverTimestamp(),
        type: 'alert'
      });
      setBroadcastMsg('');
      alert('Broadcast sent to all responders!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const activeNeedsCount = useMemo(
    () => reports.filter(r => ['open', 'active', 'pending', 'notifying', 'assigned', 'in_progress'].includes(r.status)).length,
    [reports]
  );
  const availableVolunteersCount = useMemo(
    () => volunteers.filter(v => v.approved === true && v.isAvailable !== false && !['on_task', 'offline'].includes(String(v.status || '').toLowerCase())).length,
    [volunteers]
  );
  const criticalAlertsCount = useMemo(
    () => reports.filter(r => r.severity === 'Critical' && r.status !== 'resolved').length,
    [reports]
  );

  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSeverity, setActiveSeverity] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchCategory = activeFilter === 'All' || r.category === activeFilter;
      const matchSeverity = activeSeverity === 'All' || r.severity === activeSeverity;
      const matchStatus = activeStatus === 'All' || 
        (activeStatus === 'Active' && ['open', 'notifying', 'assigned', 'in_progress'].includes(r.status)) ||
        (activeStatus === 'Resolved' && r.status === 'resolved');
      return matchCategory && matchSeverity && matchStatus;
    });
  }, [reports, activeFilter, activeSeverity, activeStatus]);

  const categories = ['All', 'Medical', 'Fire', 'Flood', 'Supply', 'Rescue'];
  const severities = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const statuses = ['All', 'Active', 'Resolved'];

  return (
    <div className="flex flex-col gap-8 relative overflow-x-hidden">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Operations Hub</h2>
          <p className="text-slate-500 font-medium">Real-time crisis orchestration and AI dispatch monitoring.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        {[
           { label: 'Active Needs', value: activeNeedsCount, color: 'blue' },
           { label: 'Available Volunteers', value: availableVolunteersCount, color: 'green' },
           { label: 'Ongoing Tasks', value: reports.filter(r => ['assigned', 'in_progress'].includes(r.status)).length, color: 'slate' },
           { label: 'Critical Alerts', value: criticalAlertsCount, color: 'red' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
             <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Main Section */}
        <div className="col-span-2 flex flex-col gap-8">
           <FullMapScreen
             currentUser={user}
             reports={filteredReports}
             volunteers={volunteers}
             onAssignVolunteer={handleOpenAssign}
             onReportSelect={handleReportClick}
             isFullScreen={false}
             focusLocation={mapFocus}
             selectedReportId={activeMarkerId}
           />

           {/* Incident Feed */}
           <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Incident Feed</h4>
                <div className="flex gap-2">
                  {statuses.map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveStatus(s)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeStatus === s ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  {categories.map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveFilter(c)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeFilter === c ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  {severities.map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSeverity(s)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeSeverity === s ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto flex flex-col gap-3 bg-white">
              {filteredReports.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase text-[10px] flex flex-col items-center gap-3">
                   <span className="material-symbols-outlined text-4xl opacity-20">search_off</span>
                   No incidents match filters
                </div>
              ) : filteredReports.map((report) => (
                <div 
                  key={report.id} 
                  ref={el => reportRefs.current[report.id] = el}
                  onClick={() => {
                    handleReportClick(report);
                    setAssigningToReport(report);
                  }}
                  className={`p-4 rounded-3xl transition-all flex items-center gap-4 group cursor-pointer border-2 ${
                    activeMarkerId === report.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    report.severity === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{report.severity === 'Critical' ? 'fmd_bad' : 'emergency'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h5 className="text-sm font-black text-slate-900 truncate">{report.title}</h5>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                        report.severity === 'Critical' ? 'bg-red-100 text-red-700' : 
                        report.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {report.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{report.category} • {report.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold truncate opacity-80">{report.location?.area || 'Location Area'}</p>
                  </div>
                </div>
              ))}
            </div>
           </div>

           {/* Report Quick Details (Selected) */}
           {assigningToReport && !showAssignPanel && (
             <div className="bg-slate-900 rounded-[40px] p-8 text-white border border-slate-800 shadow-xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
                         <span className="material-symbols-outlined text-3xl">emergency_share</span>
                      </div>
                      <div>
                         <h4 className="text-lg font-black tracking-tight">{assigningToReport.title}</h4>
                         <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{assigningToReport.category} • {assigningToReport.status}</p>
                      </div>
                   </div>
                   <button onClick={() => setAssigningToReport(null)} className="text-slate-500 hover:text-white transition-colors">
                      <span className="material-symbols-outlined">close</span>
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="bg-slate-800/50 rounded-3xl p-5 border border-slate-700/50">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Situation Description</p>
                         <p className="text-xs font-medium leading-relaxed line-clamp-4">{assigningToReport.description}</p>
                      </div>
                      {assigningToReport.aiAnalysis && (
                         <div className="bg-blue-600/10 rounded-3xl p-5 border border-blue-600/20">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                               <span className="material-symbols-outlined text-sm">auto_awesome</span>
                               Dispatch Recommendations
                            </p>
                            <p className="text-[11px] font-bold text-blue-100">{assigningToReport.aiAnalysis.actions}</p>
                         </div>
                      )}
                   </div>

                   <div className="space-y-4">
                      {assigningToReport.imageUrls?.[0] ? (
                         <div className="aspect-video rounded-3xl overflow-hidden border border-slate-700">
                            <img src={assigningToReport.imageUrls[0]} className="w-full h-full object-cover" />
                         </div>
                      ) : (
                         <div className="aspect-video rounded-3xl bg-slate-800 flex items-center justify-center border border-slate-700/50">
                            <span className="material-symbols-outlined text-slate-700 text-4xl">image_not_supported</span>
                         </div>
                      )}
                      
                      <button 
                        onClick={() => handleOpenAssign(assigningToReport)}
                        className="w-full py-5 rounded-3xl bg-white text-slate-900 text-xs font-black uppercase tracking-[0.15em] shadow-xl shadow-white/5 hover:bg-blue-50 transition-all flex items-center justify-center gap-3"
                      >
                         <span className="material-symbols-outlined">person_add</span>
                         Assign Volunteer
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* Sidebar Widgets */}
        <div className="flex flex-col gap-6">
           {/* Broadcaster */}
           <div className="bg-slate-900 rounded-[40px] p-8 text-white border border-slate-800 shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                   <span className="material-symbols-outlined text-white">campaign</span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest">Broadcaster</h4>
             </div>
             <textarea 
               value={broadcastMsg}
               onChange={(e) => setBroadcastMsg(e.target.value)}
               placeholder="Emergency broadcast to all field responders..."
               className="w-full bg-slate-800 border-none rounded-3xl p-5 text-xs text-white min-h-[140px] mb-4 outline-none placeholder:text-slate-600 resize-none"
             />
             <button 
               onClick={handleSendBroadcast} 
               disabled={isBroadcasting || !broadcastMsg.trim()}
               className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
             >
               {isBroadcasting ? 'Processing...' : 'Dispatch to Field'}
               <span className="material-symbols-outlined text-sm">send</span>
             </button>
           </div>

           {/* Admin Alerts */}
           <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
             <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Admin Alerts</h4>
             <div className="flex flex-col gap-3">
               {adminAlerts.length === 0 ? (
                 <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                   No critical alerts
                 </div>
               ) : adminAlerts.slice(0, 4).map(alert => (
                 <div key={alert.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                   <div className="text-[10px] font-black text-red-600 uppercase mb-1">Critical</div>
                   <p className="text-xs font-bold text-slate-700 leading-relaxed">{alert.message}</p>
                 </div>
               ))}
             </div>
           </div>

           {/* Resource Snapshot */}
           <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
             <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Resource Snapshot</h4>
             <div className="flex flex-col gap-5">
               {[
                 { label: 'Oxygen Tanks', value: 84, total: 100, color: '#1d4ed8' },
                 { label: 'Volunteers', value: availableVolunteersCount, total: volunteers.length, color: '#15803d' },
                 { label: 'Critical Cases', value: criticalAlertsCount, total: activeNeedsCount, color: '#dc2626' },
               ].map(r => (
                 <div key={r.label} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                       <span className="text-slate-500">{r.label}</span>
                       <span className="text-slate-900 font-black">{r.value} / {r.total}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full rounded-full" style={{ width: `${(r.value / (r.total || 1)) * 100}%`, backgroundColor: r.color }} />
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* ASSIGN VOLUNTEER PANEL */}
      {showAssignPanel && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAssignPanel(false)} />
          <div className="relative w-[420px] bg-white h-full shadow-2xl flex flex-col animate-slide-in">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Assign Volunteer</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 truncate max-w-[280px]">For: {assigningToReport?.title}</p>
              </div>
              <button onClick={() => setShowAssignPanel(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-400 text-sm">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
              {assignmentSuccess ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                   <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-4xl">check_circle</span>
                   </div>
                   <h5 className="text-xl font-black text-slate-900 mb-2">Request Sent Successfully!</h5>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed px-10">The responder has been notified and has 30 minutes to accept the mission. Status: Awaiting Response.</p>
                   <button onClick={() => setShowAssignPanel(false)} className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20">Close Panel</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4">
                    {sortedVolunteers.map(v => (
                       <div key={v.id} className={`p-5 rounded-3xl border-2 transition-all group ${
                         v.distance < 5 ? 'border-green-100 bg-green-50/30' : 'border-slate-100 bg-white'
                       }`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-3 items-center">
                              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">
                                {v.name?.[0] || 'V'}
                              </div>
                              <div>
                                <h6 className="text-sm font-black text-slate-900">{v.name}</h6>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">{v.distance.toFixed(1)} km away</p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              !v.status || v.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {v.status || 'available'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-6">
                             {v.skills && v.skills.slice(0, 3).map((s: string) => (
                               <span key={s} className="text-[9px] font-bold text-slate-500 bg-white border border-slate-100 px-2.5 py-1 rounded-full">{s}</span>
                             ))}
                          </div>

                          <div className="flex gap-2">
                             <button 
                               onClick={() => setMapFocus({ lat: v.location.lat, lng: v.location.lng })}
                               className="flex-1 py-3 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                             >
                               View on Map
                             </button>
                             <button 
                               onClick={() => handleFinalAssign(v)}
                               disabled={assignmentLoading}
                               className="flex-[2] py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                             >
                               {assignmentLoading ? 'Sending...' : 'Send Request'}
                             </button>
                          </div>
                       </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
