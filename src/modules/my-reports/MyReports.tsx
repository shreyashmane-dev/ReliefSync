import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useIsMobile } from '../../core/hooks/useIsMobile';
import { useStore } from '../../core/store/useStore';

const severityColor: Record<string, string> = { Critical: '#ba1a1a', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
const severityBg: Record<string, string> = { Critical: '#ffdad6', High: '#ffedd5', Medium: '#fef9c3', Low: '#dcfce7' };
const statusBar: Record<string, number> = { pending: 15, active: 55, resolved: 100 };
const statusColor: Record<string, string> = { pending: '#737685', active: '#0052cc', resolved: '#15803d' };

interface FeedbackDraft {
  comment: string;
  rating: number;
}

const getLocationLabel = (location: unknown) => {
  if (typeof location === 'string') return location;
  if (typeof location === 'object' && location !== null) {
    const nextLocation = location as Record<string, unknown>;
    if (typeof nextLocation.address === 'string') return nextLocation.address;
  }
  return '';
};

export const MyReports = () => {
  const { user } = useStore();
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null);
  const [reopeningReportId, setReopeningReportId] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});

  useEffect(() => {
    if (!user?.id) return;

    const reportsQuery = query(collection(db, 'reports'), where('userId', '==', user.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const nextReports: any[] = snapshot.docs.map((reportDoc) => ({ ...reportDoc.data(), id: reportDoc.id }));
        setReports(nextReports);
        setFeedbackDrafts((current) => {
          const nextDrafts = { ...current };
          nextReports.forEach((report) => {
            if (!nextDrafts[report.id]) {
              nextDrafts[report.id] = {
                rating: report.feedbackRating ?? 0,
                comment: report.feedbackComment ?? '',
              };
            }
          });
          return nextDrafts;
        });
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsubscribe();
  }, [user?.id]);

  const handleDelete = async (reportId: string) => {
    if (!confirm('Delete this unresolved report?')) return;

    setDeleting(reportId);
    try {
      await deleteDoc(doc(db, 'reports', reportId));
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(null);
    }
  };

  const handleReopen = async (reportId: string) => {
    setReopeningReportId(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'pending',
        updatedAt: serverTimestamp(),
        reopenedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error reopening report:', error);
    } finally {
      setReopeningReportId(null);
    }
  };

  const handleFeedbackSave = async (reportId: string) => {
    const feedback = feedbackDrafts[reportId];
    if (!feedback?.rating) return;

    setSavingFeedback(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        feedbackRating: feedback.rating,
        feedbackComment: feedback.comment,
        feedbackSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
    } finally {
      setSavingFeedback(null);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '-';
    return timestamp.toDate().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filtered = statusFilter === 'all' ? reports : reports.filter((report) => report.status === statusFilter);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 28 : 30, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            My Reports
          </h1>
          <p style={{ fontSize: 15, color: '#737685', margin: '4px 0 0', lineHeight: 1.55 }}>
            Track live status, reopen resolved cases, and submit response feedback.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e1e2e4',
            fontWeight: 600,
            fontSize: 13,
            color: '#191c1e',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'center' : 'flex-start',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            assignment
          </span>
          {reports.length} Total
        </div>
      </div>

      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: 8,
          background: '#f1f5f9',
          borderRadius: 14,
          padding: 4,
          overflowX: isMobile ? 'auto' : 'visible',
        }}
      >
        {[
          { key: 'all', label: 'All', count: reports.length },
          { key: 'pending', label: 'Pending', count: reports.filter((report) => report.status === 'pending').length },
          { key: 'active', label: 'Active', count: reports.filter((report) => report.status === 'active').length },
          { key: 'resolved', label: 'Resolved', count: reports.filter((report) => report.status === 'resolved').length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              flex: isMobile ? '0 0 auto' : 1,
              minWidth: isMobile ? 112 : 0,
              padding: '10px 10px',
              borderRadius: 10,
              border: 'none',
              background: statusFilter === tab.key ? '#fff' : 'transparent',
              fontWeight: 700,
              fontSize: 13,
              color: statusFilter === tab.key ? '#191c1e' : '#737685',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: statusFilter === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label} {tab.count > 0 && <span style={{ opacity: 0.6 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#737685' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          Loading your reports...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1.5px dashed #e1e2e4' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 52, display: 'block', marginBottom: 12, color: '#c3c6d6' }}>
            assignment_late
          </span>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0, color: '#191c1e' }}>No {statusFilter !== 'all' ? statusFilter : ''} reports yet</p>
          <p style={{ fontSize: 14, color: '#737685', margin: '6px 0 0' }}>Go to Reports and use the + button to file your first report.</p>
        </div>
      )}

      {filtered.map((report) => {
        const progressValue = statusBar[report.status] ?? 0;
        const currentSeverityColor = severityColor[report.severity] || '#737685';
        const currentSeverityBg = severityBg[report.severity] || '#f1f5f9';
        const currentStatusColor = statusColor[report.status] || '#737685';
        const timeline = Array.isArray(report.timeline)
          ? report.timeline
          : [
              { key: 'submitted', label: 'Report submitted', at: report.createdAt },
              { key: report.status ?? 'pending', label: `Current status: ${report.status ?? 'pending'}`, at: report.updatedAt || report.createdAt },
            ];
        const draft = feedbackDrafts[report.id] ?? { rating: 0, comment: '' };
        const canDelete = report.status !== 'resolved';
        const locationLabel = getLocationLabel(report.location);

        return (
          <article
            key={report.id}
            style={{
              background: '#fff',
              borderRadius: 18,
              border: '1px solid #f1f5f9',
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: currentSeverityColor }} />

            <div style={{ padding: isMobile ? '18px 16px 18px 20px' : '20px 20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, background: currentSeverityBg, color: currentSeverityColor, fontSize: 11, fontWeight: 700 }}>
                      {report.severity}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, background: '#f1f5f9', color: '#434654', fontSize: 11, fontWeight: 600 }}>
                      {report.category}
                    </span>
                    <span style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        calendar_today
                      </span>
                      {formatTime(report.createdAt)}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#191c1e', lineHeight: 1.35 }}>{report.title}</h2>
                  {locationLabel && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 6, fontSize: 13, color: '#737685' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>
                        location_on
                      </span>
                      <span style={{ wordBreak: 'break-word' }}>{locationLabel}</span>
                    </div>
                  )}
                  {report.description && (
                    <p style={{ fontSize: 13, color: '#434654', margin: '6px 0 0', lineHeight: 1.55, wordBreak: 'break-word' }}>
                      {report.description}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: isMobile ? 'center' : 'flex-end',
                    gap: 8,
                    flexShrink: 0,
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ padding: '5px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: `${currentStatusColor}18`, color: currentStatusColor }}>
                    {report.status === 'pending' ? 'Pending' : report.status === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  {canDelete ? (
                    <button
                      onClick={() => handleDelete(report.id)}
                      disabled={deleting === report.id}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: deleting === report.id ? 0.5 : 1,
                        width: isMobile ? 'auto' : undefined,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        delete
                      </span>
                      {deleting === report.id ? '...' : 'Delete'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReopen(report.id)}
                      disabled={reopeningReportId === report.id}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #bfdbfe',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        opacity: reopeningReportId === report.id ? 0.6 : 1,
                      }}
                    >
                      {reopeningReportId === report.id ? 'Reopening...' : 'Reopen'}
                    </button>
                  )}
                </div>
              </div>

              {Array.isArray(report.imageUrls) && report.imageUrls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: report.imageUrls.length > 1 && !isMobile ? 'repeat(2, 1fr)' : '1fr', gap: 10 }}>
                  {report.imageUrls.slice(0, 4).map((imageUrl: string) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt="Report evidence"
                      style={{ width: '100%', height: isMobile ? 180 : 124, objectFit: 'cover', borderRadius: 14, border: '1px solid #e5e7eb' }}
                    />
                  ))}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: '#737685', fontWeight: 500 }}>Response Progress</span>
                  <span style={{ color: currentStatusColor, fontWeight: 700 }}>
                    {report.status === 'pending' ? 'Under Review' : report.status === 'active' ? 'Team responding' : 'Completed'}
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressValue}%`, background: currentStatusColor, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                </div>
              </div>

              <section style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Status Timeline
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {timeline.map((event: any) => (
                    <div key={`${report.id}-${event.key}-${event.label}`} style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 10, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0052cc', marginTop: 6 }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>{event.label}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>{formatTime(event.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {(report.assignedResponderName || report.etaText || report.progressNote) && (
                <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  {report.assignedResponderName && (
                    <div style={{ background: '#fff7ed', borderRadius: 12, padding: '12px 14px', border: '1px solid #fed7aa' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Responder</p>
                      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: '#7c2d12', wordBreak: 'break-word' }}>{report.assignedResponderName}</p>
                    </div>
                  )}
                  {report.etaText && (
                    <div style={{ background: '#eff6ff', borderRadius: 12, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ETA</p>
                      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: '#1e3a8a', wordBreak: 'break-word' }}>{report.etaText}</p>
                    </div>
                  )}
                  {report.progressNote && (
                    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Update</p>
                      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: '#166534', wordBreak: 'break-word' }}>{report.progressNote}</p>
                    </div>
                  )}
                </section>
              )}

              {report.status === 'resolved' && (
                <section style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Rate the response</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Your feedback is stored with the resolved report.</p>
                    </div>
                    {report.feedbackSubmittedAt && <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Feedback saved</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() =>
                          setFeedbackDrafts((current) => ({
                            ...current,
                            [report.id]: {
                              ...(current[report.id] ?? { rating: 0, comment: '' }),
                              rating,
                            },
                          }))
                        }
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          border: draft.rating === rating ? 'none' : '1px solid #cbd5e1',
                          background: draft.rating === rating ? '#0052cc' : '#fff',
                          color: draft.rating === rating ? '#fff' : '#334155',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={draft.comment}
                    onChange={(event) =>
                      setFeedbackDrafts((current) => ({
                        ...current,
                        [report.id]: {
                          ...(current[report.id] ?? { rating: 0, comment: '' }),
                          comment: event.target.value,
                        },
                      }))
                    }
                    rows={3}
                    placeholder="How was the response? What could improve?"
                    style={{ width: '100%', marginTop: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                  />

                  <button
                    onClick={() => handleFeedbackSave(report.id)}
                    disabled={savingFeedback === report.id || !draft.rating}
                    style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#0052cc',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: draft.rating ? 'pointer' : 'not-allowed',
                      opacity: savingFeedback === report.id || !draft.rating ? 0.7 : 1,
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    {savingFeedback === report.id ? 'Saving feedback...' : 'Submit Feedback'}
                  </button>
                </section>
              )}
            </div>
          </article>
        );
      })}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
