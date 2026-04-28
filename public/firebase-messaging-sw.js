importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

// Basic config for service worker (matches .env values)
firebase.initializeApp({
  apiKey: "AIzaSyD8DUwc6eguTkVS-ZGrWlBv6Kgkqlx1AeY",
  authDomain: "reliefsync-25c7a.firebaseapp.com",
  projectId: "reliefsync-25c7a",
  storageBucket: "reliefsync-25c7a.firebasestorage.app",
  messagingSenderId: "256951955607",
  appId: "1:256951955607:web:e546bd3d23d7b147e979d2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
