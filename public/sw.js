self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Focusly",
    body: "عندك تذكير جديد للمذاكرة.",
    url: "/app/schedule",
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Focusly", {
      body: data.body || "عندك تذكير جديد.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "focusly-study-reminder",
      renotify: true,
      data: {
        url: data.url || "/app/schedule",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || "/app/schedule";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});