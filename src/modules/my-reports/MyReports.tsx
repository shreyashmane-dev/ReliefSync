import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';

const severityColors: Record<string, { main: string; bg: string }> = {
  Critical: { main: '#dc2626', bg: '#fef2f2' },
  High: { main: '#ea580c', bg: '#fff7ed' },
  Medium: { main: '#ca8a04', bg: '#fefce8' },
  Low: { main: '#16a34a', bg: '#f0fdf4' },
};

const statusMap: Record<string, { label: string; color: string; progress: number }> = {
  open: { label: 'Awaiting Action', color: '#64748b', progress: 15 },
  assigned: { label: 'Team Dispatched', color: '#1d4ed8', progress: 55 },
  in_progress: { label: 'Responder En Route', color: '#4338ca', progress: 78 },
  completed: { label: 'Mission Resolved', color: '#059669', progress: 100 },
};

const getReportStatusKey = (report: any) => {
  if (report.status === 'completed' || report.missionStatus === 'completed') return 'completed';
  if (report.missionStatus === 'in_progress') return 'in_progress';
  if (report.status === 'assigned' || report.missionStatus === 'assigned') return 'assigned';
  return 'open';
};

const formatTimestamp = (value: any) => {
  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : value
          ? new Date(value)
          : null;

  if (!date || Number.isNaN(date.getTime())) return 'Live';

  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTimestampValue = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getFallbackActivity = (report: any) => {
  if (report.status === 'completed' || report.missionStatus === 'completed') {
    return [{
      id: `fallback-${report.id}`,
      type: 'completion',
      title: 'Mission closed',
      message: report.progressNote || 'The responder has finished the field mission and closed this incident.',
      createdAt: report.completedAt || report.updatedAt || report.createdAt,
    }];
  }

  if (report.missionStatus === 'in_progress' || report.status === 'assigned') {
    return [{
      id: `fallback-${report.id}`,
      type: 'status_update',
      status: report.missionStatus || report.status,
      title: 'Responder activity in progress',
      message: report.progressNote || 'A responder is currently handling your report.',
      createdAt: report.updatedAt || report.assignedAt || report.createdAt,
    }];
  }

  return [{
    id: `fallback-${report.id}`,
    type: 'system',
    title: 'Report received',
    message: 'Your report is in the dispatch queue and waiting for a responder assignment.',
    createdAt: report.createdAt,
  }];
};

const getActivityMeta = (update: any) => {
  if (update.type === 'claim') {
    return {
      badge: 'Accepted',
      icon: 'support_agent',
      badgeClass: 'bg-blue-100 text-blue-700',
      iconClass: 'bg-blue-600 text-white',
      title: update.title || 'Responder accepted the mission',
      message: update.message || update.note || 'A responder has accepted your report.',
    };
  }

  if (update.type === 'completion' || update.status === 'completed') {
    return {
      badge: 'Completed',
      icon: 'task_alt',
      badgeClass: 'bg-green-100 text-green-700',
      iconClass: 'bg-green-600 text-white',
      title: update.title || 'Mission completed',
      message: update.message || 'The response team has completed this mission.',
    };
  }

  if (update.type === 'field_note') {
    return {
      badge: 'Field Note',
      icon: 'forum',
      badgeClass: 'bg-amber-100 text-amber-700',
      iconClass: 'bg-amber-500 text-white',
      title: update.title || `${update.userName || 'Responder'} sent an update`,
      message: update.message || 'A new field note was posted.',
    };
  }

  if (update.status === 'in_progress') {
    return {
      badge: 'Active',
      icon: 'near_me',
      badgeClass: 'bg-indigo-100 text-indigo-700',
      iconClass: 'bg-indigo-600 text-white',
      title: update.title || 'Responder is moving',
      message: update.message || 'The responder is on the move and working this incident.',
    };
  }

  if (update.type === 'status_update') {
    return {
      badge: 'Status',
      icon: 'update',
      badgeClass: 'bg-sky-100 text-sky-700',
      iconClass: 'bg-sky-600 text-white',
      title: update.title || 'Mission status updated',
      message: update.message || 'The response team updated the mission status.',
    };
  }

  return {
    badge: 'Update',
    icon: 'info',
    badgeClass: 'bg-slate-100 text-slate-700',
    iconClass: 'bg-slate-600 text-white',
    title: update.title || 'Coordination update',
    message: update.message || update.note || 'A coordination update is available for this report.',
  };
};

export const MyReports = () => {
  const { user } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportUpdates, setReportUpdates] = useState<Record<string, any[]>>({});
  const [loadingUpdatesFor, setLoadingUpdatesFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'reports'), where('userId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const sortedReports = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));

        setReports(sortedReports);
        setLoading(false);
      },
      (error) => {
        console.error('MyReports Firestore query failed:', error);
        setLoading(false);
      }
    );
  }, [user?.id]);

  useEffect(() => {
    if (!expandedReportId) return;

    const reportId = expandedReportId;
    setLoadingUpdatesFor(reportId);

    const q = query(
      collection(db, 'taskUpdates'),
      where('taskId', '==', reportId)
    );

    return onSnapshot(
      q,
      (snap) => {
        const sortedUpdates = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));

        setReportUpdates((current) => ({
          ...current,
          [reportId]: sortedUpdates,
        }));
        setLoadingUpdatesFor((current) => (current === reportId ? null : current));
      },
      (error) => {
        console.error('MyReports taskUpdates query failed:', error);
        setLoadingUpdatesFor((current) => (current === reportId ? null : current));
      }
    );
  }, [expandedReportId]);

  const filtered = reports.filter((report) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'assigned') {
      return report.status === 'assigned' || report.missionStatus === 'in_progress';
    }
    return report.status === statusFilter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently remove this report?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'reports', id));
      if (expandedReportId === id) {
        setExpandedReportId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpandedReport = (id: string) => {
    setExpandedReportId((current) => (current === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mission Tracker</h1>
           <p className="text-slate-500 font-medium mt-1">Real-time status of your field reports and responder activity.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
           {['all', 'open', 'assigned', 'completed'].map(s => (
             <button
               key={s}
               onClick={() => setStatusFilter(s)}
               className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 statusFilter === s ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
           <span className="material-symbols-outlined animate-spin text-blue-700">progress_activity</span>
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authenticating feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
           <span className="material-symbols-outlined text-4xl mb-2">assignment_late</span>
           <p className="text-sm font-bold uppercase tracking-widest">No reports in this category</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((report) => {
            const statusKey = getReportStatusKey(report);
            const statusMeta = statusMap[statusKey];
            const isExpanded = expandedReportId === report.id;
            const timeline = (reportUpdates[report.id]?.length ? reportUpdates[report.id] : getFallbackActivity(report));
            const locationLabel = typeof report.location === 'string'
              ? report.location
              : report.location?.address || 'Location captured in dispatch system';

            return (
              <div
                key={report.id}
                className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-700/5 transition-all group overflow-hidden relative cursor-pointer"
                onClick={() => toggleExpandedReport(report.id)}
              >
                 <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: severityColors[report.severity]?.main }} />

                 <div className="flex flex-col gap-8">
                    <div className="flex justify-between items-start gap-4">
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4 mb-3">
                             <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ backgroundColor: severityColors[report.severity]?.bg, color: severityColors[report.severity]?.main }}>
                                {report.severity}
                             </span>
                             <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                ID: {report.id.slice(-6).toUpperCase()}
                             </span>
                             <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusMeta.color }} />
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: statusMeta.color }}>
                                   {statusMeta.label}
                                </span>
                             </div>
                          </div>
                          <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{report.title}</h3>
                          <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-2xl">{report.description}</p>
                       </div>
                       <div className="flex flex-col items-end gap-2 shrink-0">
                          {report.status !== 'completed' && (
                            <button
                              disabled={deletingId === report.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(report.id);
                              }}
                              className="w-10 h-10 rounded-2xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center border border-transparent hover:border-red-100"
                            >
                               <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                            </button>
                          )}
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                             Stored
                          </div>
                       </div>
                    </div>

                    <div className="flex flex-col gap-3">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                          <span className="text-slate-400">Mission Progress</span>
                          <span style={{ color: statusMeta.color }}>{statusMeta.progress}% Complete</span>
                       </div>
                       <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${statusMeta.progress}%`, backgroundColor: statusMeta.color }}
                          />
                       </div>
                    </div>

                    {(statusKey === 'assigned' || statusKey === 'in_progress') && (
                      <div className="flex gap-4 p-6 bg-blue-50/50 rounded-[24px] border border-blue-100 transition-all animate-in slide-in-from-bottom-2">
                         <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                            <span className="material-symbols-outlined">support_agent</span>
                         </div>
                         <div className="flex-1">
                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Responder Unit Active</p>
                            <p className="text-sm text-slate-700 font-bold">
                              {report.assignedResponderName || 'A responder'} is handling this incident
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-1">{report.progressNote || 'A responder has been assigned to your report.'}</p>
                         </div>
                      </div>
                    )}

                    {statusKey === 'completed' && (
                      <div className="flex gap-4 p-6 bg-green-50/50 rounded-[24px] border border-green-100">
                         <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-600/20">
                            <span className="material-symbols-outlined">task_alt</span>
                         </div>
                         <div className="flex-1">
                            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Resolution Achieved</p>
                            <p className="text-sm text-slate-700 font-bold">Status: Successfully Resolved</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">{report.progressNote || 'The assigned responder has completed this mission.'}</p>
                         </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-500 font-medium min-w-0">
                        <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
                        <span className="truncate">{locationLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-700 font-bold shrink-0">
                        <span>{isExpanded ? 'Hide details' : 'Open details'}</span>
                        <span className="material-symbols-outlined text-base">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-6 flex flex-col gap-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Responder Activity Feed</p>
                            <h4 className="text-lg font-black text-slate-900 mt-1">Detailed mission updates for this report</h4>
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            Last dispatch note: {formatTimestamp(report.updatedAt || report.assignedAt || report.createdAt)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Stage</p>
                            <p className="text-sm font-bold" style={{ color: statusMeta.color }}>{statusMeta.label}</p>
                          </div>
                          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Units</p>
                            <p className="text-sm font-bold text-slate-800">{report.assignedResponderName || 'Queueing...'}</p>
                          </div>
                          <div className="bg-white rounded-2xl border border-slate-100 p-4 md:col-span-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Oversight Note</p>
                            <p className="text-sm font-bold text-slate-800 italic">{report.progressNote || 'Waiting for first field update.'}</p>
                          </div>
                        </div>

                        {loadingUpdatesFor === report.id ? (
                          <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <p className="text-xs font-black uppercase tracking-widest">Loading responder timeline...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {timeline.map((update: any) => {
                              const meta = getActivityMeta(update);
                              return (
                                <div key={update.id} className="bg-white rounded-[24px] border border-slate-100 p-4 flex gap-4">
                                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${meta.iconClass}`}>
                                    <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.badgeClass}`}>
                                        {meta.badge}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        {formatTimestamp(update.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">{meta.title}</p>
                                    <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">{meta.message}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                 </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
