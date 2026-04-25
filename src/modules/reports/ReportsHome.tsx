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
import { useStore } from '../../core/store/useStore';
import { getInitials } from '../../core/utils/user';

const CATEGORIES = [
  { label: 'Medical', icon: 'medical_services', color: '#b81a36' },
  { label: 'Fire', icon: 'local_fire_department', color: '#f97316' },
  { label: 'Flood', icon: 'water_drop', color: '#0052cc' },
  { label: 'Shelter', icon: 'home_work', color: '#004e32' },
  { label: 'Earthquake', icon: 'crisis_alert', color: '#7c3aed' },
  { label: 'Other', icon: 'more_horiz', color: '#737685' },
];

const SEVERITY = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_OPTIONS = ['all', 'pending', 'active', 'resolved'] as const;

const severityColor: Record<string, string> = {
  Critical: '#ba1a1a',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

const severityBg: Record<string, string> = {
  Critical: '#ffdad6',
  High: '#ffedd5',
  Medium: '#fef9c3',
  Low: '#dcfce7',
};

const getFirebaseErrorDetails = (error: unknown) => {
  if (typeof error === 'object' && error !== null) {
    const details = error as Record<string, unknown>;
    return {
      code: typeof details.code === 'string' ? details.code : undefined,
      message: typeof details.message === 'string' ? details.message : undefined,
    };
  }

  return {
    code: undefined,
    message: error instanceof Error ? error.message : undefined,
  };
};

export const ReportsHome = () => {
  const { user } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageUploadWarning, setImageUploadWarning] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [confirmingReportId, setConfirmingReportId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const [form, setForm] = useState({
    title: '',
    category: 'Medical',
    severity: 'Medium',
    location: '',
    description: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map((reportDoc) => ({ ...reportDoc.data(), id: reportDoc.id })));
    });
    return () => unsub();
  }, []);

  const selectedImagePreviews = useMemo(
    () => selectedImages.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [selectedImages],
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [selectedImagePreviews]);

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (incomingFiles.length === 0) return;

    setSelectedImages((current) => [...current, ...incomingFiles].slice(0, 4));
    event.target.value = '';
  };

  const removeSelectedImage = (name: string) => {
    setSelectedImages((current) => current.filter((file) => file.name !== name));
  };

  // Uploads images one-by-one, never throws — returns URLs of whichever uploads succeed.
  const uploadReportImagesSafe = async (): Promise<{ urls: string[]; failed: number }> => {
    if (!user?.id || selectedImages.length === 0) return { urls: [], failed: 0 };

    let failed = 0;
    const urls: string[] = [];

    await Promise.all(
      selectedImages.map(async (file, index) => {
        try {
          const fileRef = ref(storage, `report_media/${user.id}/${Date.now()}-${index}-${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          urls.push(url);
        } catch (err) {
          const { message } = getFirebaseErrorDetails(err);
          console.warn('Image upload skipped:', file.name, message);
          failed += 1;
        }
      }),
    );

    return { urls, failed };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setSubmitError(null);
    setImageUploadWarning(null);
    try {
      // Upload images safely — submission never blocked by photo errors
      const { urls: imageUrls, failed: failedUploads } = await uploadReportImagesSafe();

      await addDoc(collection(db, 'reports'), {
        ...form,
        status: 'pending',
        userId: user.id,
        userName: user.name,
        userPhotoURL: user.photoURL ?? null,
        imageUrls,
        verifiedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        timeline: [
          {
            key: 'submitted',
            label: 'Report submitted',
            at: new Date().toISOString(),
          },
        ],
      });

      setShowModal(false);
      setSelectedImages([]);
      setForm({ title: '', category: 'Medical', severity: 'Medium', location: '', description: '' });

      // Show a warning AFTER modal closes if some photos were skipped
      if (failedUploads > 0) {
        setImageUploadWarning(
          `Report submitted! However, ${failedUploads} photo${failedUploads > 1 ? 's' : ''} could not be uploaded — update Firebase Storage rules to allow report_media uploads.`
        );
        setTimeout(() => setImageUploadWarning(null), 8000);
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      const { code, message } = getFirebaseErrorDetails(error);
      if (code === 'permission-denied' || message?.includes('permission')) {
        setSubmitError('Permission denied. Make sure you are logged in and Firestore rules allow report creation.');
      } else {
        setSubmitError(message || 'Failed to submit report. Please check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReport = async (reportId: string) => {
    if (!user?.id) {
      setConfirmationMessage({ type: 'error', text: 'Please sign in before confirming a report.' });
      return;
    }

    setConfirmingReportId(reportId);
    setConfirmationMessage(null);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        verifiedBy: arrayUnion(user.id),
        updatedAt: serverTimestamp(),
      });
      setReports((currentReports) =>
        currentReports.map((report) => {
          if (report.id !== reportId) return report;

          const verifiedBy = Array.isArray(report.verifiedBy) ? report.verifiedBy : [];
          return {
            ...report,
            verifiedBy: verifiedBy.includes(user.id) ? verifiedBy : [...verifiedBy, user.id],
          };
        }),
      );
      setConfirmationMessage({ type: 'success', text: 'Report confirmed.' });
      window.setTimeout(() => setConfirmationMessage(null), 2600);
    } catch (error) {
      console.error('Error confirming report:', error);
      const { code, message } = getFirebaseErrorDetails(error);
      const isPermissionError =
        code === 'permission-denied' || message?.toLowerCase().includes('permission');
      setConfirmationMessage({
        type: 'error',
        text: isPermissionError
          ? 'Firebase rules blocked the confirmation update. Allow authenticated users to update verifiedBy on reports.'
          : message || 'Could not confirm this report. Please try again.',
      });
    } finally {
      setConfirmingReportId(null);
    }
  };

  const filtered = reports.filter((report) => {
    const matchCategory = filter === 'All' || report.category === filter;
    const matchStatus = statusFilter === 'all' || report.status === statusFilter;
    const searchValue = search.toLowerCase();
    const matchSearch =
      !searchValue ||
      report.title?.toLowerCase().includes(searchValue) ||
      report.location?.toLowerCase().includes(searchValue) ||
      report.description?.toLowerCase().includes(searchValue);

    return matchCategory && matchStatus && matchSearch;
  });

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return 'Just now';

    const date = timestamp.toDate();
    const diff = (Date.now() - date.getTime()) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, marginBottom: 4, letterSpacing: '-0.5px' }}>
          Hello, {user?.name?.split(' ')[0] || 'there'}
        </h1>
        <p style={{ fontSize: 16, color: '#737685', margin: 0 }}>
          Live Firebase reports, community confirmations, and media-backed field updates.
        </p>
      </div>

      {/* Warning banner: shows after modal closes if some images were skipped */}
      {imageUploadWarning && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#d97706', flexShrink: 0, marginTop: 1 }}>warning</span>
          <div>
            <div>{imageUploadWarning}</div>
            <div style={{ marginTop: 6, fontWeight: 500, fontSize: 13 }}>
              Fix in Firebase Console → Storage → Rules: add{' '}
              <code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>report_media/{'{userId}'}/**</code>{' '}
              with write permission for authenticated users.
            </div>
          </div>
        </div>
      )}

      {confirmationMessage && (
        <div
          style={{
            background: confirmationMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${confirmationMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            color: confirmationMessage.type === 'error' ? '#b91c1c' : '#166534',
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {confirmationMessage.type === 'error' ? 'error' : 'check_circle'}
          </span>
          {confirmationMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span
            className="material-symbols-outlined"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#737685', fontSize: 20, pointerEvents: 'none' }}
          >
            search
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search incidents, locations..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              borderRadius: 12,
              border: '1px solid #e1e2e4',
              background: '#fff',
              fontSize: 15,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #e1e2e4',
            background: '#fff',
            fontSize: 14,
            fontWeight: 600,
            color: '#191c1e',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((category) => (
            <option key={category.label} value={category.label}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number])}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #e1e2e4',
            background: '#fff',
            fontSize: 14,
            fontWeight: 600,
            color: '#191c1e',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 28, paddingBottom: 4 }}>
        {[{ label: 'All', icon: 'apps', color: '#0052cc' }, ...CATEGORIES].map((category) => (
          <button
            key={category.label}
            onClick={() => setFilter(category.label)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 9999,
              border: `1px solid ${filter === category.label ? category.color : '#e1e2e4'}`,
              background: filter === category.label ? `${category.color}15` : '#fff',
              color: filter === category.label ? category.color : '#434654',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {category.icon}
            </span>
            {category.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Reports', value: reports.length, icon: 'assignment', color: '#0052cc' },
          {
            label: 'Critical',
            value: reports.filter((report) => report.severity === 'Critical').length,
            icon: 'crisis_alert',
            color: '#ba1a1a',
          },
          {
            label: 'Confirmed',
            value: reports.filter((report) => Array.isArray(report.verifiedBy) && report.verifiedBy.length > 0).length,
            icon: 'fact_check',
            color: '#15803d',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '20px 16px',
              border: '1px solid #f1f5f9',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: stat.color, fontSize: 28, display: 'block', marginBottom: 6, fontVariationSettings: "'FILL' 1" }}
            >
              {stat.icon}
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#191c1e', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#737685', letterSpacing: '0.05em', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Live Incidents ({filtered.length})</h2>
        </div>

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#737685',
              background: '#fff',
              borderRadius: 16,
              border: '1px dashed #e1e2e4',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.4 }}>
              assignment
            </span>
            <p style={{ margin: 0, fontWeight: 600 }}>No incidents found.</p>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>Be the first to report one.</p>
          </div>
        )}

        {filtered.map((report) => {
          const verificationCount = Array.isArray(report.verifiedBy) ? report.verifiedBy.length : 0;
          const alreadyVerified = Boolean(user?.id && Array.isArray(report.verifiedBy) && report.verifiedBy.includes(user.id));
          const canConfirm = Boolean(user?.id && report.userId !== user.id && !alreadyVerified);

          return (
            <div
              key={report.id}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: '20px 20px 20px 24px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: severityColor[report.severity] || '#737685', borderRadius: '4px 0 0 4px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 9999,
                        background: severityBg[report.severity] || '#f1f5f9',
                        color: severityColor[report.severity] || '#737685',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {report.severity}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, background: '#f1f5f9', color: '#434654', fontSize: 11, fontWeight: 700 }}>
                      {report.category}
                    </span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatTime(report.createdAt)}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4, color: '#191c1e' }}>{report.title}</h3>
                  {report.description && <p style={{ fontSize: 13, color: '#434654', margin: 0, lineHeight: 1.5 }}>{report.description}</p>}
                  {report.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 13, color: '#737685' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        location_on
                      </span>
                      {report.location}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: report.status === 'pending' ? '#f1f5f9' : report.status === 'active' ? '#dae2ff' : '#dcfce7',
                      color: report.status === 'pending' ? '#737685' : report.status === 'active' ? '#0052cc' : '#15803d',
                    }}
                  >
                    {report.status === 'pending' ? 'Pending' : report.status === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {report.userPhotoURL ? (
                      <img
                        src={report.userPhotoURL}
                        alt={report.userName || 'Reporter'}
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#0052cc',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {getInitials(report.userName)}
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{report.userName || 'Community user'}</span>
                  </div>
                </div>
              </div>

              {Array.isArray(report.imageUrls) && report.imageUrls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: report.imageUrls.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 10 }}>
                  {report.imageUrls.slice(0, 4).map((imageUrl: string) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt="Report evidence"
                      style={{ width: '100%', height: 148, objectFit: 'cover', borderRadius: 14, border: '1px solid #e5e7eb' }}
                    />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: 13, fontWeight: 600 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  {verificationCount} community confirmation{verificationCount === 1 ? '' : 's'}
                </div>

                {canConfirm && (
                  <button
                    onClick={() => handleConfirmReport(report.id)}
                    disabled={confirmingReportId === report.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#15803d',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      opacity: confirmingReportId === report.id ? 0.7 : 1,
                    }}
                  >
                    {confirmingReportId === report.id ? 'Confirming...' : 'Confirm Report'}
                  </button>
                )}

                {alreadyVerified && (
                  <span
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: '#ecfdf5',
                      color: '#15803d',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    You confirmed this
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowModal(true)}
        style={{
          position: 'fixed',
          bottom: 96,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 16,
          background: '#b81a36',
          border: 'none',
          color: '#fff',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(184,26,54,0.35)',
          zIndex: 40,
        }}
        title="Add Report"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
          add
        </span>
      </button>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(25,28,30,0.6)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: '0 0 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Report an Incident</h2>
                <p style={{ fontSize: 13, color: '#737685', margin: '4px 0 0' }}>
                  Submit a new emergency report with optional evidence photos.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {submitError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, marginTop: 2 }}>error</span>
                  <div style={{ flex: 1 }}>{submitError}</div>
                </div>
              )}
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Incident Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="e.g. Flash Flood on Route 9"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e1e2e4', fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Category *</label>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e1e2e4', fontSize: 15, fontFamily: 'Inter, sans-serif', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.label} value={category.label}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Severity *</label>
                  <select
                    value={form.severity}
                    onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e1e2e4', fontSize: 15, fontFamily: 'Inter, sans-serif', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    {SEVERITY.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Location *</label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#737685', pointerEvents: 'none' }}>
                    location_on
                  </span>
                  <input
                    required
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="Street address or area name"
                    style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1.5px solid #e1e2e4', fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="Describe the situation, number of people affected, resources needed..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e1e2e4', fontSize: 15, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 8 }}>Evidence Photos</label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: 14,
                    padding: '18px 16px',
                    cursor: 'pointer',
                    background: '#f8fafc',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  <span className="material-symbols-outlined">add_a_photo</span>
                  Add up to 4 photos
                  <input type="file" accept="image/*" multiple onChange={handleImageSelection} style={{ display: 'none' }} />
                </label>

                {selectedImagePreviews.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 12 }}>
                    {selectedImagePreviews.map((image) => (
                      <div key={image.name} style={{ position: 'relative' }}>
                        <img src={image.url} alt={image.name} style={{ width: '100%', height: 112, objectFit: 'cover', borderRadius: 12 }} />
                        <button
                          type="button"
                          onClick={() => removeSelectedImage(image.name)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(15,23,42,0.75)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            close
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 14,
                  background: '#b81a36',
                  border: 'none',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: submitting ? 0.7 : 1,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {submitting && <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                  crisis_alert
                </span>
                Submit Report
              </button>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
};
