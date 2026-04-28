import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '../core/config/api';
import { connectSocket, getSocket } from '../core/services/socketClient';

interface UserNotificationProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

const playHappyNotification = () => {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 540;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
  } catch (error) {
    console.warn('Celebration audio unavailable:', error);
  }
};

const typeAccent = (type: string) => {
  if (type === 'volunteer_accepted') return { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: 'check_circle' };
  if (type === 'task_completed') return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: 'celebration' };
  return { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', icon: 'near_me' };
};

export const UserNotification: React.FC<UserNotificationProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<any | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    connectSocket(currentUser.id, currentUser.role || 'user');

    const fetchNotifications = async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/notifications/${currentUser.id}?role=user&limit=100`));
        if (!response.ok) return;
        const data = await response.json();
        setNotifications(data.notifications || []);
      } catch (error) {
        console.warn('Failed to load user notifications:', error);
      }
    };

    fetchNotifications();
    const socket = getSocket();
    if (!socket) return;

    const handleVolunteerAccepted = (payload: any) => {
      setNotifications((current) => [payload, ...current]);
      setCelebration(payload);
      setToast(`Help is on the way! ${payload.volunteerName || 'A volunteer'} accepted your request.`);
      playHappyNotification();
    };

    const handleTaskUpdate = (payload: any) => {
      setNotifications((current) => [payload, ...current]);
      setToast(payload.message || 'Your task status changed.');
    };

    socket.on('volunteer_accepted', handleVolunteerAccepted);
    socket.on('task_update', handleTaskUpdate);

    return () => {
      socket.off('volunteer_accepted', handleVolunteerAccepted);
      socket.off('task_update', handleTaskUpdate);
    };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 10000);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.isRead !== true && notification.read !== true).length,
    [notifications]
  );

  const markAsRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.notificationId === notificationId || notification.id === notificationId
          ? { ...notification, isRead: true, read: true }
          : notification
      )
    );
    await fetch(buildApiUrl(`/api/notifications/${notificationId}/read`), { method: 'PUT' }).catch(() => undefined);
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
            border: '1px solid #bfdbfe',
            background: isOpen ? '#eff6ff' : '#f8fafc',
            color: '#1d4ed8',
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
                background: '#2563eb',
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
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: '#1d4ed8' }}>
                Community Notifications
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#475569', fontWeight: 700 }}>
                Live updates about volunteers and task progress
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notifications.length === 0 && (
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
                  No updates yet. We’ll notify you as soon as a volunteer responds.
                </div>
              )}

              {notifications.map((notification) => {
                const accent = typeAccent(notification.type || notification.status);
                return (
                  <div
                    key={notification.notificationId || notification.id}
                    style={{
                      borderRadius: 24,
                      border: `1px solid ${accent.border}`,
                      background: accent.bg,
                      padding: 16,
                      display: 'flex',
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        background: '#fff',
                        color: accent.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span className="material-symbols-outlined">{accent.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                        {notification.type === 'volunteer_accepted'
                          ? 'Great news! A volunteer has accepted your request!'
                          : notification.type === 'task_completed'
                            ? 'Your request has been fulfilled!'
                            : notification.title || 'Task update'}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                        {notification.message}
                      </div>
                      {notification.volunteerName && (
                        <div style={{ marginTop: 10, fontSize: 13, color: accent.text, fontWeight: 800 }}>
                          Volunteer: {notification.volunteerName}
                        </div>
                      )}
                      {notification.estimatedArrival && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#475569', fontWeight: 700 }}>
                          Estimated arrival: {notification.estimatedArrival}
                        </div>
                      )}
                      {notification.volunteerPhone && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#475569', fontWeight: 700 }}>
                          Contact: {notification.volunteerPhone}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>
                          Task reference: {(notification.reportId || '').slice(-6).toUpperCase()}
                        </div>
                        {notification.isRead !== true && notification.read !== true && (
                          <button
                            onClick={() => markAsRead(notification.notificationId || notification.id)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              fontWeight: 900,
                            }}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
            maxWidth: 340,
          }}
        >
          {toast}
        </div>
      )}

      {celebration && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
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
            <div style={{ fontSize: 38 }}>🎉</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900, color: '#166534' }}>Help is on the way!</div>
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: '#334155', lineHeight: 1.8 }}>
              {celebration.volunteerName || 'A volunteer'} has accepted your request.
              <br />
              They are heading to you now.
              <br />
              Estimated arrival: {celebration.estimatedArrival || 'Calculating'}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'center' }}>
              <button
                onClick={() => window.open('/my-reports', '_self')}
                style={{
                  height: 46,
                  padding: '0 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                View on Map
              </button>
              <button
                onClick={() => setCelebration(null)}
                style={{
                  height: 46,
                  padding: '0 18px',
                  borderRadius: 14,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
