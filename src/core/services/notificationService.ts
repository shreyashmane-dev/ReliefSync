import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDistance } from '../utils/location';

export async function createEmergencyNotifications(reportId: string, reportLocation: { lat: number; lng: number }) {
  try {
    // 1. Find active volunteers
    const volunteerSnapshot = await getDocs(query(collection(db, 'volunteers'), where('status', '==', 'active')));
    const nearbyVolunteers = volunteerSnapshot.docs.filter(doc => {
      const v = doc.data();
      if (!v.location?.lat || !v.location?.lng) return false;
      const distance = getDistance(
        reportLocation.lat,
        reportLocation.lng,
        v.location.lat,
        v.location.lng
      );
      return distance <= 5; // 5 km radius
    });

    const notificationsBatch = [];

    // 2. Notifications for nearby volunteers
    for (const v of nearbyVolunteers) {
      notificationsBatch.push({
        receiverId: v.id,
        role: 'volunteer',
        message: '🚨 Emergency nearby! A user requested help.',
        reportId,
        read: false,
        createdAt: serverTimestamp()
      });
    }

    // 3. Notification for admin
    notificationsBatch.push({
      role: 'admin',
      message: '🚨 New emergency report submitted.',
      reportId,
      read: false,
      createdAt: serverTimestamp()
    });

    // 4. Save all to Firestore
    for (const notif of notificationsBatch) {
      await addDoc(collection(db, 'notifications'), notif);
    }
  } catch (error) {
    console.error('Failed to create emergency notifications:', error);
  }
}
