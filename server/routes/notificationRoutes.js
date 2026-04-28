import express from 'express';
import { db } from '../config/firebase-admin.js';
import {
  calculateDistance,
  findNearbyVolunteers,
  handleVolunteerResponse,
  listNotificationsForUser,
  processReportNotifications,
  sendVolunteerNotification,
} from '../services/notificationService.js';

const router = express.Router();

router.post('/process-report', async (req, res) => {
  try {
    const { report } = req.body ?? {};
    if (!report?.id || !report?.location?.lat || !report?.location?.lng) {
      return res.status(400).json({ error: 'A report with lat/lng coordinates is required.' });
    }

    const notificationCount = await processReportNotifications(report);
    return res.status(200).json({
      success: true,
      notificationCount,
    });
  } catch (error) {
    console.error('process-report failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to process report notifications.' });
  }
});

router.post('/dispatch', async (req, res) => {
  try {
    const { reportId, location, volunteerId } = req.body ?? {};
    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required.' });
    }

    const reportSnapshot = await db.collection('reports').doc(reportId).get();
    if (!reportSnapshot.exists) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = {
      id: reportSnapshot.id,
      ...reportSnapshot.data(),
      location: reportSnapshot.data()?.location || location,
    };

    if (volunteerId) {
      const volunteerSnapshot = await db.collection('volunteers').doc(volunteerId).get();
      if (!volunteerSnapshot.exists) {
        return res.status(404).json({ error: 'Volunteer not found.' });
      }

      const volunteer = {
        id: volunteerSnapshot.id,
        ...volunteerSnapshot.data(),
      };

      const distance = calculateDistance(
        Number(report.location?.lat || 0),
        Number(report.location?.lng || 0),
        Number(volunteer.location?.lat || 0),
        Number(volunteer.location?.lng || 0),
      );

      const notification = await sendVolunteerNotification(
        volunteerId,
        report,
        distance,
        { status: 'pending', dispatchOrder: 0 }
      );

      await db.collection('reports').doc(reportId).set(
        {
          notificationsSent: (Number(report.notificationsSent) || 0) + 1,
          status: 'notifying',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({
        success: true,
        notified: 1,
        notification,
      });
    }

    const notificationCount = await processReportNotifications(report);
    return res.status(200).json({
      success: true,
      notified: notificationCount,
    });
  } catch (error) {
    console.error('dispatch failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch notifications.' });
  }
});

router.post('/volunteers/update-location', async (req, res) => {
  try {
    const { volunteerId, location } = req.body ?? {};
    if (!volunteerId || !location?.lat || !location?.lng || !location?.address) {
      return res.status(400).json({ error: 'volunteerId and full location details are required.' });
    }

    const payload = {
      location: {
        address: location.address,
        lat: Number(location.lat),
        lng: Number(location.lng),
        area: location.area || '',
        updatedAt: new Date().toISOString(),
      },
      coverageRadius: Number(location.coverageRadius || process.env.NOTIFICATION_RADIUS_KM || 10),
      isAvailable: true,
      status: 'available',
    };

    await db.collection('volunteers').doc(volunteerId).set(payload, { merge: true });
    await db.collection('users').doc(volunteerId).set({ location: payload.location }, { merge: true });

    return res.status(200).json({
      success: true,
      volunteer: {
        id: volunteerId,
        ...payload,
      },
    });
  } catch (error) {
    console.error('update-location failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to update volunteer location.' });
  }
});

router.get('/volunteers/nearby', async (req, res) => {
  try {
    const { lat, lng, radius, skillsNeeded, reportType } = req.query;
    const volunteers = await findNearbyVolunteers(
      { lat: Number(lat), lng: Number(lng) },
      Number(radius || process.env.NOTIFICATION_RADIUS_KM || 10),
      typeof reportType === 'string' ? reportType : '',
      typeof skillsNeeded === 'string' ? skillsNeeded.split(',') : []
    );
    return res.status(200).json({ volunteers });
  } catch (error) {
    console.error('nearby volunteers failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to find nearby volunteers.' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status, limit } = req.query;
    const result = await listNotificationsForUser(userId, {
      role: typeof role === 'string' ? role : undefined,
      status: typeof status === 'string' ? status : undefined,
      limit: typeof limit === 'string' ? Number(limit) : 50,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('list notifications failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to load notifications.' });
  }
});

router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    await db.collection('notifications').doc(notificationId).set(
      {
        isRead: true,
        read: true,
      },
      { merge: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('mark read failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to mark notification as read.' });
  }
});

router.put('/:notificationId/respond', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { response, volunteerId, reportId } = req.body ?? {};
    const result = await handleVolunteerResponse({
      notificationId,
      volunteerId,
      reportId,
      response,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('notification respond failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to respond to notification.' });
  }
});

router.get('/unread-count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;
    const result = await listNotificationsForUser(userId, {
      role: typeof role === 'string' ? role : undefined,
      limit: 200,
    });
    return res.status(200).json({ unreadCount: result.unreadCount });
  } catch (error) {
    console.error('unread-count failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to load unread count.' });
  }
});

router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    await db.collection('notifications').doc(notificationId).delete();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('delete notification failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete notification.' });
  }
});


export default router;
