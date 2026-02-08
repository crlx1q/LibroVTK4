importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCRHXd_7p77EH-onhpuRtZskroS7sY_dHc",
  authDomain: "assist-97363.firebaseapp.com",
  projectId: "assist-97363",
  storageBucket: "assist-97363.firebasestorage.app",
  messagingSenderId: "700060547241",
  appId: "1:700060547241:web:d7eb3554e5e8589e0f91b8"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Libro - Новое уведомление';
  const notificationOptions = {
    body: payload.notification?.body || 'У вас новое уведомление',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'libro-notification',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
