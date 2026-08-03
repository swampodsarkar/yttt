const SHELL_CACHE = "tubeplay-shell-v1";
const OFFLINE_CACHE = "tubeplay-offline";
const APP_SHELL = ["/", "/css/style.css", "/js/app.js", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(SHELL_CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== OFFLINE_CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    const url = new URL(e.request.url);

    if (url.pathname.startsWith("/youtube/")) return;

    if (url.origin !== location.origin) {
        e.respondWith(
            caches.open(OFFLINE_CACHE).then((c) =>
                c.match(e.request).then((hit) => hit || fetch(e.request))
            )
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then((hit) =>
            hit ||
            fetch(e.request).then((res) => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(SHELL_CACHE).then((c) => c.put(e.request, clone));
                }
                return res;
            })
        )
    );
});