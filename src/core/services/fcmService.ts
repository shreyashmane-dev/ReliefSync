import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from '../firebase/config';

const messaging = getMessaging(app);
const FCM_SW_PATH = '/firebase-messaging-sw.js';
const FCM_VAPID_KEY = 'BHzRkVYmaJYOIFZ86GSEDbe20UfDlsLPYmRdBE7WXM-cRvFImuo3Vuo8JuUW5benfJSq7DYO3FWyYmkeqev6a1E';

export const requestFirebaseNotificationPermission = async (userId: string) => {
  try {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return null;
    }

    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      console.warn('Firebase messaging is not supported in this browser context.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not available; skipping FCM registration.');
      return null;
    }

    const registration = await navigator.serviceWorker.register(FCM_SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

      if (token) {
        // Save FCM token to the user document with setDoc to handle missing documents
        await setDoc(doc(db, 'users', userId), {
          fcmToken: token
        }, { merge: true });
        
        // Also save to volunteers if they are one
        await setDoc(doc(db, 'volunteers', userId), {
          fcmToken: token
        }, { merge: true }).catch(() => {});

      console.log('FCM Token secured:', token);
      return token;
    }

    return null;
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
