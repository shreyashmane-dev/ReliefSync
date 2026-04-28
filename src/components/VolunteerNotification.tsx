import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connectSocket, getSocket } from '../core/services/socketClient';

interface VolunteerNotificationProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    location?: { lat?: number; lng?: number; address?: string };
  };
}

const urgencyPalette = (urgency: number) => {
  if (urgency >= 9) return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', badge: 'Critical' };
  if (urgency >= 6) return { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', badge: 'High' };
  if (urgency >= 4) return { bg: '#fefce8', border: '#fde68a', text: '#a16207', badge: 'Moderate' };
  return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'Low' };
};

const typeIcon = (reportType: string) => {
  const normalized = String(reportType || '').toLowerCase();
  if (normalized.includes('medical')) return 'medical_services';
  if (normalized.includes('fire')) return 'local_fire_department';
  if (normalized.includes('flood')) return 'water';
  if (normalized.includes('shelter')) return 'home_work';
  return 'emergency';
};

const timeAgo = (dateString: string) => {
  const delta = Math.max(0, Date.now() - new Date(dateString || Date.now()).getTime());
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hr ago`;
};

const formatCountdown = (expiresAt: string, now: number) => {
  const diff = Math.max(0, new Date(expiresAt).getTime() - now);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const playSoftNotification = () => {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 740;
    gain.gain.value = 0.03;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch (error) {
    console.warn('Notification audio unavailable:', error);
  }
};

export const VolunteerNotification: React.FC<VolunteerNotificationProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  const [fullScreenAlert, setFullScreenAlert] = useState<any | null>(null);
  const [taskConfirmed, setTaskConfirmed] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    connectSocket(currentUser.id, currentUser.role || 'volunteer');

    const normalizeNotification = (notification: any) => ({
      notificationId: notification.notificationId || notification.id,
      ...notification,
      reportTitle: notification.reportTitle || notification.title,
      reportDetails: notification.reportDetails || {
        description: notification.message,
        title: notification.title,
      },
      createdAt: notification.createdAt || new Date().toISOString(),
      expiresAt: notification.expiresAt || new Date(Date.now() + 30 * 60000).toISOString(),
    });

    const fetchNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications/${currentUser.id}?role=volunteer&limit=20`);
        if (!response.ok) {
          throw new Error('Unable to load volunteer notifications.');
        }

        const data = await response.json();
        setNotifications((data.notifications || []).map(normalizeNotification));
        setLoadError(null);
      } catch (error) {
        console.warn('Failed to load volunteer notifications:', error);
        setLoadError('Live alert history is temporarily unavailable. New socket alerts will still appear here.');
      }
    };

    fetchNotifications();

    const socket = getSocket();
    if (!socket) return;

    const handleNewNearby = (notification: any) => {
      setNotifications((current) => {
        const normalized = normalizeNotification(notification);
        const next = [normalized, ...current.filter((item) => item.notificationId !== normalized.notificationId)];
        return next;
      });
      setToast(`New report nearby! ${Number(notification.distance || 0).toFixed(1)} km away`);
      playSoftNotification();
      if (Number(notification.reportUrgency || notification.reportDetails?.urgency || 0) >= 9) {
        setFullScreenAlert(notification);
      }
    };

    const handleConfirmed = (payload: any) => {
      setTaskConfirmed(payload);
      setNotifications((current) =>
        current.map((notification) =>
          notification.reportId === payload.reportId
            ? { ...notification, status: 'accepted', isRead: true, read: true }
            : notification
        )
      );
      setToast('Task accepted! The requester has been notified.');
      setBusyId(null);
      setConfirmTarget(null);
    };

    socket.on('new_report_nearby', handleNewNearby);
    socket.on('task_confirmed', handleConfirmed);

    return () => {
      socket.off('new_report_nearby', handleNewNearby);
      socket.off('task_confirmed', handleConfirmed);
    };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (notification.status === 'expired' || notification.status === 'declined') return false;
        return new Date(notification.expiresAt || Date.now()).getTime() > now;
      }),
    [notifications, now]
  );

  const expiredNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification.status === 'expired' ||
          new Date(notification.expiresAt || Date.now()).getTime() <= now
      ),
    [notifications, now]
  );

  const unreadCount = activeNotifications.filter((notification) => notification.isRead !== true && notification.read !== true).length;

  const respondToNotification = async (notification: any, response: 'accepted' | 'declined') => {
    setBusyId(notification.notificationId);
    const socket = getSocket();

    if (socket?.connected) {
      socket.emit('volunteer_response', {
        notificationId: notification.notificationId,
        volunteerId: currentUser.id,
        reportId: notification.reportId,
        response,
      });
    } else {
      await fetch(`/api/notifications/${notification.notificationId}/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response,
          volunteerId: currentUser.id,
          reportId: notification.reportId,
        }),
      });
    }

    if (response === 'declined') {
      setNotifications((current) =>
        current.map((item) =>
          item.notificationId === notification.notificationId ? { ...item, status: 'declined' } : item
        )
      );
      setToast('Declined. Next nearest volunteer will be notified.');
      setBusyId(null);
    }
  };

  return (
    <>
      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setIsOpen((value) => !value)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            border: '1px solid #dcfce7',
            background: isOpen ? '#ecfdf5' : '#f8fafc',
            color: '#15803d',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                background: '#dc2626',
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 56,
              right: 0,
              width: 420,
              maxHeight: 620,
              overflow: 'hidden',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 28,
              boxShadow: '0 24px 60px rgba(15,23,42,0.16)',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: '#166534' }}>
                Volunteer Alerts
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#475569', fontWeight: 700 }}>
                Nearby reports waiting for response
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadError && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: '1px solid #fde68a',
                    background: '#fefce8',
                    color: '#854d0e',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {loadError}
                </div>
              )}

              {activeNotifications.length === 0 && (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 22,
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    textAlign: 'center',
                    color: '#64748b',
                    fontWeight: 700,
                  }}
                >
                  No active volunteer alerts right now.
                </div>
              )}

              {activeNotifications.map((notification) => {
                const urgency = Number(notification.reportUrgency || notification.reportDetails?.urgency || 0);
                const palette = urgencyPalette(urgency);
                return (
                  <div
                    key={notification.notificationId}
                    style={{
                      borderRadius: 24,
                      border: `1px solid ${palette.border}`,
                      background: palette.bg,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            background: '#fff',
                            color: palette.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span className="material-symbols-outlined">{typeIcon(notification.reportType)}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: palette.text, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {palette.badge}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                            {notification.reportTitle || notification.reportDetails?.title || 'Nearby report'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>{timeAgo(notification.createdAt)}</div>
                    </div>

                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                      {notification.reportDetails?.description || 'A community request needs volunteer attention.'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Location</div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                          {notification.reportLocation?.address || 'Shared in report'}
                        </div>
                      </div>
                      <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Distance</div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                          {Number(notification.distance || 0).toFixed(1)} km away
                        </div>
                      </div>
                      <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>People Affected</div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                          {notification.reportDetails?.peopleAffected || 0}
                        </div>
                      </div>
                      <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Expires In</div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                          {formatCountdown(notification.expiresAt, now)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setConfirmTarget(notification)}
                        disabled={busyId === notification.notificationId}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 16,
                          border: 'none',
                          background: '#16a34a',
                          color: '#fff',
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        {busyId === notification.notificationId ? 'Working...' : 'ACCEPT TASK'}
                      </button>
                      <button
                        onClick={() => respondToNotification(notification, 'declined')}
                        disabled={busyId === notification.notificationId}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 16,
                          border: '1px solid #ef4444',
                          background: '#fff',
                          color: '#ef4444',
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                );
              })}

              {expiredNotifications.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    Expired
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {expiredNotifications.slice(0, 3).map((notification) => (
                      <div
                        key={notification.notificationId}
                        style={{
                          borderRadius: 20,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          padding: 14,
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {notification.reportTitle || notification.reportDetails?.title || 'Nearby report'} expired.
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskConfirmed && (
                <div
                  style={{
                    borderRadius: 24,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    padding: 16,
                    color: '#166534',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Task Confirmed
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                    Estimated arrival: {taskConfirmed.estimatedArrival}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      taskConfirmed.location?.address || `${taskConfirmed.location?.lat},${taskConfirmed.location?.lng}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 10, color: '#166534', fontWeight: 800 }}
                  >
                    Open route in Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 500,
            background: '#0f172a',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: 18,
            boxShadow: '0 18px 40px rgba(15,23,42,0.22)',
            fontWeight: 800,
            maxWidth: 320,
          }}
        >
          {toast}
        </div>
      )}

      {confirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            zIndex: 550,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 460, borderRadius: 28, background: '#fff', padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Confirm task acceptance</div>
            <div style={{ marginTop: 10, color: '#475569', lineHeight: 1.6, fontWeight: 700 }}>
              Are you sure you want to accept this task?
              <br />
              Location: {confirmTarget.reportLocation?.address || 'Shared in report'}
              <br />
              Distance: {Number(confirmTarget.distance || 0).toFixed(1)} km away
              <br />
              Urgency: {urgencyPalette(Number(confirmTarget.reportUrgency || confirmTarget.reportDetails?.urgency || 0)).badge}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => respondToNotification(confirmTarget, 'accepted')}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Confirm Accept
              </button>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {fullScreenAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(127,29,29,0.72)',
            zIndex: 560,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              borderRadius: 28,
              background: '#fff',
              padding: 28,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 42 }}>🚨</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: '#7f1d1d' }}>Critical report nearby</div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: '#475569', lineHeight: 1.7 }}>
              {fullScreenAlert.reportTitle || fullScreenAlert.reportDetails?.title}
              <br />
              {Number(fullScreenAlert.distance || 0).toFixed(1)} km away
            </div>
            <button
              onClick={() => {
                setFullScreenAlert(null);
                setIsOpen(true);
              }}
              style={{
                marginTop: 20,
                height: 48,
                padding: '0 20px',
                borderRadius: 16,
                border: 'none',
                background: '#7f1d1d',
                color: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              View Alert
            </button>
          </div>
        </div>
      )}
    </>
  );
};
