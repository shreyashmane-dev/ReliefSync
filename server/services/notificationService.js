import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase-admin.js';
import { emitToUser } from './socketService.js';

const DEFAULT_RADIUS_KM = Number(process.env.NOTIFICATION_RADIUS_KM || 50);
const NOTIFICATION_EXPIRY_MINUTES = Number(process.env.NOTIFICATION_EXPIRY_MINUTES || 30);

const severityToUrgency = (severity) => {
  if (typeof severity === 'number') return severity;
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 10;
    case 'high':
      return 8;
    case 'medium':
      return 5;
    case 'low':
      return 2;
    default:
      return 4;
  }
};

const getNotificationExpiry = () =>
  new Date(Date.now() + NOTIFICATION_EXPIRY_MINUTES * 60 * 1000).toISOString();

const estimateArrivalWindow = (distanceKm) => {
  const minutes = Math.max(5, Math.round((distanceKm / 35) * 60));
  return `${minutes} min`;
};

const buildReportLocation = (reportLocation = {}) => ({
  address: reportLocation.address || 'Location shared in report',
  area: reportLocation.area || '',
  lat: Number(reportLocation.lat || 0),
  lng: Number(reportLocation.lng || 0),
});

const safeSkills = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];

const hasMatchingSkills = (volunteerData, reportType, skillsNeeded) => {
  const volunteerSkills = safeSkills(volunteerData.skills);
  const requiredSkills = safeSkills(skillsNeeded);
  const normalizedType = String(reportType || '').trim().toLowerCase();

  if (volunteerSkills.length === 0) return true;
  if (requiredSkills.length === 0 && !normalizedType) return true;

  const matchesNeeded = requiredSkills.some((skill) => volunteerSkills.includes(skill));
  const matchesType = normalizedType ? volunteerSkills.includes(normalizedType) : false;
  return matchesNeeded || matchesType;
};

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const findNearbyVolunteers = async (
  reportLocation,
  radiusKm = DEFAULT_RADIUS_KM,
  reportType = '',
  skillsNeeded = []
) => {
  const reportLat = Number(reportLocation?.lat);
  const reportLng = Number(reportLocation?.lng);

  if (!Number.isFinite(reportLat) || !Number.isFinite(reportLng)) {
    return [];
  }

  const volunteersSnapshot = await db.collection('volunteers').get();
  const volunteers = [];

  volunteersSnapshot.forEach((snapshot) => {
    const volunteerData = snapshot.data() || {};
    const volunteerLocation = volunteerData.location || {};
    const volunteerLat = Number(volunteerLocation.lat);
    const volunteerLng = Number(volunteerLocation.lng);
    const isAvailable =
      volunteerData.approved === true &&
      volunteerData.isAvailable !== false &&
      !volunteerData.currentTaskId &&
      !['on_task', 'offline'].includes(String(volunteerData.status || '').toLowerCase());

    if (!isAvailable || !Number.isFinite(volunteerLat) || !Number.isFinite(volunteerLng)) {
      return;
    }

    if (!hasMatchingSkills(volunteerData, reportType, skillsNeeded)) {
      return;
    }

    const distance = calculateDistance(reportLat, reportLng, volunteerLat, volunteerLng);
    if (distance > radiusKm) return;

    volunteers.push({
      id: snapshot.id,
      ...volunteerData,
      distance,
    });
  });

  return volunteers.sort((a, b) => a.distance - b.distance);
};

const createAdminNotification = async ({ title, message, reportId, reportDetails = {} }) => {
  const notificationId = db.collection('notifications').doc().id;
  const payload = {
    notificationId,
    recipientId: 'admin',
    recipientRole: 'admin',
    role: 'admin',
    receiverId: 'admin',
    reportId,
    type: 'admin_alert',
    title,
    message,
    reportDetails,
    status: 'pending',
    isRead: false,
    read: false,
    createdAt: new Date().toISOString(),
  };

  await db.collection('notifications').doc(notificationId).set(payload);
  return payload;
};

export const sendVolunteerNotification = async (
  volunteerId,
  reportDetails,
  distance,
  options = {}
) => {
  const notificationId = options.notificationId || db.collection('notifications').doc().id;
  const createdAt = new Date().toISOString();
  const location = buildReportLocation(reportDetails.location);
  const notificationPayload = {
    notificationId,
    recipientId: volunteerId,
    recipientRole: 'volunteer',
    receiverId: volunteerId,
    role: 'volunteer',
    volunteerId,
    reportId: reportDetails.id || reportDetails.reportId,
    type: 'new_report',
    title: reportDetails.title || 'New report nearby',
    message: `${reportDetails.title || 'New request'} needs attention ${distance.toFixed(1)} km away.`,
    reportDetails: {
      title: reportDetails.title || '',
      description: reportDetails.description || '',
      type: reportDetails.category || reportDetails.type || 'other',
      urgency: severityToUrgency(reportDetails.severity || reportDetails.urgency),
      urgencyLabel: reportDetails.severity || reportDetails.urgency || 'Medium',
      location,
      peopleAffected: Number(reportDetails.peopleAffected || 0),
    },
    reportTitle: reportDetails.title || '',
    reportLocation: location,
    reportUrgency: severityToUrgency(reportDetails.severity || reportDetails.urgency),
    reportType: reportDetails.category || reportDetails.type || 'other',
    distance,
    status: options.status || 'pending',
    dispatchOrder: options.dispatchOrder || 0,
    isRead: false,
    read: false,
    expiresAt: getNotificationExpiry(),
    createdAt,
    respondedAt: null,
  };

  await db.collection('notifications').doc(notificationId).set(notificationPayload);

  if (notificationPayload.status === 'pending') {
    emitToUser(volunteerId, 'new_report_nearby', notificationPayload);
  }

  return notificationPayload;
};

export const notifyUserVolunteerAccepted = async (
  userId,
  volunteerData,
  reportId,
  estimatedArrival
) => {
  const reportSnapshot = await db.collection('reports').doc(reportId).get();
  const reportData = reportSnapshot.exists ? reportSnapshot.data() : {};
  const notificationId = db.collection('notifications').doc().id;
  const payload = {
    notificationId,
    recipientId: userId,
    recipientRole: 'user',
    receiverId: userId,
    role: 'user',
    reportId,
    volunteerId: volunteerData.id,
    volunteerName: volunteerData.name || 'Volunteer',
    volunteerPhone: volunteerData.phoneNumber || volunteerData.phone || '',
    estimatedArrival,
    type: 'volunteer_accepted',
    title: 'Volunteer accepted your request',
    message: `${volunteerData.name || 'A volunteer'} is on the way to help you.`,
    reportDetails: {
      title: reportData?.title || '',
      type: reportData?.category || '',
      urgency: severityToUrgency(reportData?.severity),
      location: buildReportLocation(reportData?.location),
      peopleAffected: Number(reportData?.peopleAffected || 0),
    },
    status: 'volunteer_accepted',
    isRead: false,
    read: false,
    createdAt: new Date().toISOString(),
  };

  await db.collection('notifications').doc(notificationId).set(payload);
  emitToUser(userId, 'volunteer_accepted', payload);
  return payload;
};

const notifyUserTaskUpdate = async (userId, reportId, status, volunteerData = {}) => {
  const reportSnapshot = await db.collection('reports').doc(reportId).get();
  const reportData = reportSnapshot.exists ? reportSnapshot.data() : {};
  const typeMap = {
    started: 'task_started',
    in_progress: 'task_started',
    completed: 'task_completed',
  };
  const messageMap = {
    started: `${volunteerData.name || 'Your volunteer'} has started the task.`,
    in_progress: `${volunteerData.name || 'Your volunteer'} is actively working on the request.`,
    completed: `${volunteerData.name || 'Your volunteer'} marked the task as completed.`,
  };
  const notificationId = db.collection('notifications').doc().id;
  const payload = {
    notificationId,
    recipientId: userId,
    recipientRole: 'user',
    receiverId: userId,
    role: 'user',
    reportId,
    volunteerId: volunteerData.id || '',
    volunteerName: volunteerData.name || 'Volunteer',
    type: typeMap[status] || 'task_update',
    title: 'Task status updated',
    message: messageMap[status] || 'A volunteer updated your task.',
    status,
    isRead: false,
    read: false,
    createdAt: new Date().toISOString(),
    reportDetails: {
      title: reportData?.title || '',
      type: reportData?.category || '',
      urgency: severityToUrgency(reportData?.severity),
      location: buildReportLocation(reportData?.location),
      peopleAffected: Number(reportData?.peopleAffected || 0),
    },
  };

  await db.collection('notifications').doc(notificationId).set(payload);
  emitToUser(userId, 'task_update', payload);
  return payload;
};

const activateNextQueuedNotification = async (reportId) => {
  const notificationsSnapshot = await db.collection('notifications').where('reportId', '==', reportId).get();
  const queuedNotification = notificationsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((notification) => notification.type === 'new_report' && notification.status === 'queued')
    .sort((a, b) => (a.dispatchOrder || 0) - (b.dispatchOrder || 0))[0];

  if (!queuedNotification) {
    return null;
  }

  await db.collection('notifications').doc(queuedNotification.notificationId).set(
    {
      status: 'pending',
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const pendingPayload = {
    ...queuedNotification,
    status: 'pending',
  };
  emitToUser(queuedNotification.recipientId, 'new_report_nearby', pendingPayload);
  return pendingPayload;
};

export const handleVolunteerResponse = async ({
  notificationId,
  volunteerId,
  reportId,
  response,
}) => {
  if (!notificationId || !volunteerId || !reportId || !response) {
    throw new Error('Missing volunteer response fields.');
  }

  const notificationRef = db.collection('notifications').doc(notificationId);
  const reportRef = db.collection('reports').doc(reportId);
  const volunteerRef = db.collection('volunteers').doc(volunteerId);

  const [notificationSnapshot, reportSnapshot, volunteerSnapshot] = await Promise.all([
    notificationRef.get(),
    reportRef.get(),
    volunteerRef.get(),
  ]);

  if (!notificationSnapshot.exists || !reportSnapshot.exists || !volunteerSnapshot.exists) {
    throw new Error('Notification, report, or volunteer record was not found.');
  }

  const notificationData = notificationSnapshot.data();
  const reportData = reportSnapshot.data();
  const volunteerData = { id: volunteerId, ...volunteerSnapshot.data() };

  if (response === 'accepted') {
    const estimatedArrival = estimateArrivalWindow(notificationData.distance || 0);
    const batch = db.batch();

    batch.set(
      notificationRef,
      {
        status: 'accepted',
        respondedAt: new Date().toISOString(),
        isRead: true,
        read: true,
      },
      { merge: true }
    );

    batch.set(
      volunteerRef,
      {
        currentTaskId: reportId,
        isAvailable: false,
        status: 'on_task',
        lastAssignedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    batch.set(
      reportRef,
      {
        status: 'assigned',
        missionStatus: 'assigned',
        assignedTo: volunteerId,
        assignedVolunteerId: volunteerId,
        assignedResponderName: volunteerData.name || 'Volunteer',
        assignedAt: new Date().toISOString(),
        etaText: estimatedArrival,
        progressNote: `${volunteerData.name || 'A volunteer'} accepted the request and is on the way.`,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const relatedNotifications = await db.collection('notifications').where('reportId', '==', reportId).get();
    relatedNotifications.forEach((doc) => {
      if (doc.id !== notificationId && ['pending', 'queued'].includes(doc.data().status)) {
        batch.set(
          doc.ref,
          {
            status: 'expired',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    });

    await batch.commit();

    await db.collection('taskUpdates').add({
      taskId: reportId,
      volunteerId,
      userName: volunteerData.name || 'Volunteer',
      type: 'claim',
      title: 'Volunteer accepted the task',
      message: `${volunteerData.name || 'A volunteer'} accepted the request and is moving toward the location.`,
      createdAt: new Date().toISOString(),
    });

    await notifyUserVolunteerAccepted(reportData.userId, volunteerData, reportId, estimatedArrival);
    emitToUser(volunteerId, 'task_confirmed', {
      reportId,
      taskId: reportId,
      estimatedArrival,
      reportTitle: reportData.title,
      location: reportData.location,
    });

    return {
      reportId,
      response: 'accepted',
      estimatedArrival,
    };
  }

  await notificationRef.set(
    {
      status: 'declined',
      respondedAt: new Date().toISOString(),
      isRead: true,
      read: true,
    },
    { merge: true }
  );

  const nextVolunteerNotification = await activateNextQueuedNotification(reportId);
  if (!nextVolunteerNotification) {
    await createAdminNotification({
      title: 'No volunteer accepted report',
      message: `All notified volunteers declined or timed out for report ${reportData.title || reportId}.`,
      reportId,
      reportDetails: {
        title: reportData.title || '',
        type: reportData.category || '',
        location: buildReportLocation(reportData.location),
      },
    });
  }

  return {
    reportId,
    response: 'declined',
    nextVolunteerId: nextVolunteerNotification?.recipientId || null,
  };
};

export const handleTaskStatusUpdate = async ({ taskId, status, volunteerId }) => {
  if (!taskId || !status || !volunteerId) {
    throw new Error('Missing task status update fields.');
  }

  const reportRef = db.collection('reports').doc(taskId);
  const volunteerRef = db.collection('volunteers').doc(volunteerId);
  const [reportSnapshot, volunteerSnapshot] = await Promise.all([reportRef.get(), volunteerRef.get()]);

  if (!reportSnapshot.exists || !volunteerSnapshot.exists) {
    throw new Error('Task or volunteer record was not found.');
  }

  const reportData = reportSnapshot.data();
  const volunteerData = { id: volunteerId, ...volunteerSnapshot.data() };
  const publicStatus = status === 'started' ? 'in_progress' : status;

  await reportRef.set(
    {
      missionStatus: publicStatus,
      status: publicStatus === 'completed' ? 'completed' : reportData.status || 'assigned',
      updatedAt: new Date().toISOString(),
      progressNote:
        publicStatus === 'completed'
          ? `${volunteerData.name || 'Volunteer'} completed the mission.`
          : `${volunteerData.name || 'Volunteer'} is actively responding.`,
    },
    { merge: true }
  );

  if (publicStatus === 'completed') {
    await volunteerRef.set(
      {
        currentTaskId: null,
        isAvailable: true,
        status: 'available',
      },
      { merge: true }
    );
  }

  await db.collection('taskUpdates').add({
    taskId,
    volunteerId,
    userName: volunteerData.name || 'Volunteer',
    type: 'status_update',
    status: publicStatus,
    title: `Task ${publicStatus.replace('_', ' ')}`,
    message: `${volunteerData.name || 'Volunteer'} updated the task to ${publicStatus.replace('_', ' ')}.`,
    createdAt: new Date().toISOString(),
  });

  await notifyUserTaskUpdate(reportData.userId, taskId, publicStatus, volunteerData);

  if (publicStatus === 'completed') {
    await createAdminNotification({
      title: 'Task completed',
      message: `${volunteerData.name || 'Volunteer'} completed report ${reportData.title || taskId}.`,
      reportId: taskId,
      reportDetails: {
        title: reportData.title || '',
        type: reportData.category || '',
        location: buildReportLocation(reportData.location),
      },
    });
  }

  return {
    taskId,
    status: publicStatus,
  };
};

export const processReportNotifications = async (report) => {
  if (!report?.location?.lat || !report?.location?.lng) {
    throw new Error('Report location must include lat/lng coordinates.');
  }

  const nearbyVolunteers = await findNearbyVolunteers(
    report.location,
    DEFAULT_RADIUS_KM,
    report.category || report.type,
    report.skillsNeeded || []
  );

  const notifications = [];
  for (const [index, volunteer] of nearbyVolunteers.entries()) {
    const notification = await sendVolunteerNotification(
      volunteer.id,
      report,
      volunteer.distance,
      { status: index === 0 ? 'pending' : 'queued', dispatchOrder: index + 1 }
    );
    notifications.push(notification);
  }

  await db.collection('reports').doc(report.id || report.reportId).set(
    {
      notificationsSent: notifications.length,
      notifiedVolunteerIds: nearbyVolunteers.map((volunteer) => volunteer.id),
      status: nearbyVolunteers.length > 0 ? 'notifying' : 'pending',
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (severityToUrgency(report.severity || report.urgency) >= 9) {
    await createAdminNotification({
      title: 'Critical report submitted',
      message: `${report.title || 'A critical report'} was submitted and needs immediate oversight.`,
      reportId: report.id || report.reportId,
      reportDetails: {
        title: report.title || '',
        type: report.category || report.type || '',
        location: buildReportLocation(report.location),
      },
    });
  }

  if (nearbyVolunteers.length === 0) {
    await createAdminNotification({
      title: 'No nearby volunteers found',
      message: `No available volunteers were found within ${DEFAULT_RADIUS_KM} km for ${report.title || 'this report'}.`,
      reportId: report.id || report.reportId,
      reportDetails: {
        title: report.title || '',
        type: report.category || report.type || '',
        location: buildReportLocation(report.location),
      },
    });
  }

  console.log(`Volunteer notification pipeline processed ${notifications.length} potential responders for report ${report.id || report.reportId}.`);
  return notifications.length;
};

export const listNotificationsForUser = async (userId, { role, status, limit = 50 } = {}) => {
  const notificationsSnapshot = await db.collection('notifications').get();
  let notifications = notificationsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((notification) => {
      const matchesRecipient =
        notification.recipientId === userId ||
        notification.receiverId === userId ||
        (role === 'admin' && notification.role === 'admin');

      const matchesRole = !role || notification.recipientRole === role || notification.role === role;
      const matchesStatus = !status || notification.status === status;
      return matchesRecipient && matchesRole && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  notifications = notifications.slice(0, Number(limit) || 50);
  const unreadCount = notifications.filter((notification) => notification.isRead !== true && notification.read !== true).length;

  return {
    notifications,
    unreadCount,
  };
};
