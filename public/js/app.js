const API_BASE = "";
const player = document.getElementById("playerVideo");

let mode = "music";
let results = [];
let currentItem = null;
let library = [];

const $ = id => document.getElementById(id);

const DB_NAME = "tubeplay";
const DB_STORE = "library";
const OFFLINE_CACHE = "tubeplay-offline";

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(DB_STORE)) {
                req.result.createObjectStore(DB_STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function videoIdFromUrl(url) {
    const m = (url || "").match(/[?&]v=([\w-]{11})/);
    return m ? m[1] : null;
}

function switchTab(tab) {
    mode = tab;
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.mode === tab));
    $("resultsSection").classList.add("hidden");
    $("librarySection").classList.add("hidden");
    if (tab === "library") {
        renderLibrary();
    } else {
        $("resultsSection").classList.remove("hidden");
    }
}

function performSearch() {
    const q = $("searchInput").value.trim();
    if (!q || mode === "library") return;
    hide("error");
    hide("resultsSection");
    show("loading");
    fetch(`${API_BASE}/youtube/search?video=${encodeURIComponent(q)}`)
        .then(response => response.json())
        .then(data => {
            hide("loading");
            if (data.result && data.result.video && data.result.video.length > 0) {
                results = data.result.video;
                renderResults();
            } else {
                showError("No results found. Try a different search query.");
            }
        })
        .catch(err => {
            hide("loading");
            showError("Search failed. Check your connection and try again.");
            console.error("Search error:", err);
        });
}

function renderResults() {
    const list = $("resultsList");
    list.innerHTML = "";
    $("resultsTitle").textContent = mode === "video" ? "Video Results" : "Music Results";

    results.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const thumb = document.createElement("img");
        thumb.className = "result-thumbnail";
        thumb.src = item.thumbnail || "";
        thumb.alt = item.title || "Thumbnail";
        thumb.onerror = function() { this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68' viewBox='0 0 120 68'%3E%3Crect fill='%232a2a2a' width='120' height='68'/%3E%3C/svg%3E"; };

        const info = document.createElement("div");
        info.className = "result-info";

        const title = document.createElement("div");
        title.className = "result-title";
        title.textContent = item.title || "Unknown Title";

        const meta = document.createElement("div");
        meta.className = "result-meta";
        meta.textContent = item.duration?.human || "";

        const author = document.createElement("div");
        author.className = "result-author";
        author.textContent = item.author?.name || "";

        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(author);

        const actions = document.createElement("div");
        actions.className = "result-actions";

        const playBtn = document.createElement("button");
        playBtn.className = "action-btn play-btn";
        playBtn.textContent = mode === "video" ? "▶ Play" : "▶";
        playBtn.onclick = (e) => { e.stopPropagation(); playItem(item); };

        actions.appendChild(playBtn);

        if (mode === "music") {
            const lyricsBtn = document.createElement("button");
            lyricsBtn.className = "action-btn lyrics-btn";
            lyricsBtn.textContent = "Lyrics";
            lyricsBtn.onclick = (e) => { e.stopPropagation(); showLyrics(item); };
            actions.appendChild(lyricsBtn);

            const mp3Btn = document.createElement("button");
            mp3Btn.className = "action-btn mp3-btn";
            mp3Btn.textContent = "MP3";
            mp3Btn.onclick = (e) => { e.stopPropagation(); downloadMp3(item.url); };
            actions.appendChild(mp3Btn);

            const saveBtn = document.createElement("button");
            saveBtn.className = "action-btn save-btn";
            saveBtn.textContent = "Save";
            saveBtn.onclick = (e) => { e.stopPropagation(); saveOffline(item); };
            actions.appendChild(saveBtn);
        }

        if (mode === "video") {
            const mp4Btn = document.createElement("button");
            mp4Btn.className = "action-btn mp4-btn";
            mp4Btn.textContent = "MP4";
            mp4Btn.onclick = (e) => { e.stopPropagation(); downloadMp4(item.url); };
            actions.appendChild(mp4Btn);
        }

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(actions);
        card.onclick = () => playItem(item);
        list.appendChild(card);
    });

    $("resultsSection").classList.remove("hidden");
}

function playItem(item) {
    currentItem = item;
    $("playerTitle").textContent = item.title || "Unknown";
    $("playerAuthor").textContent = item.author?.name || "Unknown";
    $("playerThumb").src = item.thumbnail || "";
    player.poster = item.thumbnail || "";

    const quality = mode === "video" ? "720" : "audio";
    const endpoint = `${API_BASE}/youtube/stream?url=${encodeURIComponent(item.url)}&quality=${quality}`;

    show("playerBar");
    player.src = "";
    player.load();

    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (!data.result || !data.result.streamUrl) throw new Error("no stream");
            player.src = data.result.streamUrl;
            player.load();
            player.play().catch(() => {});
        })
        .catch(() => showError("Playback failed. Try again."));
}

function togglePlay() {
    if (!player.src) return;
    if (player.paused) {
        player.play().catch(() => {});
    } else {
        player.pause();
    }
}

function showLyrics(item) {
    const q = encodeURIComponent(`${item.title} ${item.author?.name || ""}`.trim());
    $("lyricsTitle").textContent = "Loading lyrics...";
    $("lyricsBody").textContent = "Searching...";
    show("lyricsModal");
    fetch(`${API_BASE}/youtube/lyrics?q=${q}`)
        .then(response => response.json())
        .then(data => {
            if (data.result && data.result.lyrics) {
                $("lyricsTitle").textContent = `${data.result.title} - ${data.result.artist}`;
                $("lyricsBody").textContent = data.result.lyrics;
            } else {
                $("lyricsTitle").textContent = "Lyrics";
                $("lyricsBody").textContent = "No lyrics found for this song.";
            }
        })
        .catch(() => { $("lyricsBody").textContent = "Failed to load lyrics."; });
}

function downloadMp3(url) {
    window.open(`${API_BASE}/youtube/download/mp3?url=${encodeURIComponent(url)}`, "_blank");
}

function downloadMp4(url) {
    const q = prompt("Quality (360, 480, 720, 1080):", "720");
    if (!q) return;
    window.open(`${API_BASE}/youtube/download/video?url=${encodeURIComponent(url)}&quality=${q}`, "_blank");
}

async function saveOffline(item) {
    if (!item) return;
    const id = videoIdFromUrl(item.url);
    if (!id) return showError("Cannot save this item.");
    showError("Saving offline...");
    try {
        let streamUrl = item.streamUrl;
        if (!streamUrl) {
            const res = await fetch(`${API_BASE}/youtube/stream?url=${encodeURIComponent(item.url)}&quality=audio`);
            const data = await res.json();
            if (!data.result || !data.result.streamUrl) throw new Error("no stream");
            streamUrl = data.result.streamUrl;
            item.streamUrl = streamUrl;
        }
        const resp = await fetch(streamUrl);
        if (!resp.ok) throw new Error("download failed");
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.put(streamUrl, resp);
        await dbPut({ id, title: item.title, author: item.author?.name, thumbnail: item.thumbnail, url: item.url, streamUrl, savedAt: Date.now() });
        showError("Saved offline successfully.");
    } catch (e) {
        console.error("Save offline error:", e);
        showError("Failed to save offline.");
    }
}

async function renderLibrary() {
    library = await dbGetAll();
    const list = $("libraryList");
    list.innerHTML = "";
    const empty = $("libraryEmpty");
    if (!library.length) {
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");
    library.forEach(item => {
        const card = document.createElement("div");
        card.className = "result-card";

        const thumb = document.createElement("img");
        thumb.className = "result-thumbnail";
        thumb.src = item.thumbnail || "";
        thumb.alt = item.title || "";
        thumb.onerror = function() { this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68' viewBox='0 0 120 68'%3E%3Crect fill='%232a2a2a' width='120' height='68'/%3E%3C/svg%3E"; };

        const info = document.createElement("div");
        info.className = "result-info";
        const title = document.createElement("div");
        title.className = "result-title";
        title.textContent = item.title || "Unknown";
        const author = document.createElement("div");
        author.className = "result-author";
        author.textContent = item.author || "";
        info.appendChild(title);
        info.appendChild(author);

        const actions = document.createElement("div");
        actions.className = "result-actions";

        const playBtn = document.createElement("button");
        playBtn.className = "action-btn play-btn";
        playBtn.textContent = "▶";
        playBtn.onclick = (e) => { e.stopPropagation(); playSaved(item); };

        const delBtn = document.createElement("button");
        delBtn.className = "action-btn delete-btn";
        delBtn.textContent = "Delete";
        delBtn.onclick = (e) => { e.stopPropagation(); removeFromLibrary(item); };

        actions.appendChild(playBtn);
        actions.appendChild(delBtn);

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(actions);
        list.appendChild(card);
    });
}

function playSaved(item) {
    currentItem = item;
    $("playerTitle").textContent = item.title || "Unknown";
    $("playerAuthor").textContent = item.author || "Unknown";
    $("playerThumb").src = item.thumbnail || "";
    player.poster = item.thumbnail || "";
    show("playerBar");
    player.src = item.streamUrl;
    player.load();
    player.play().catch(() => {});
}

async function removeFromLibrary(item) {
    await dbDelete(item.id);
    if (item.streamUrl) {
        try {
            const c = await caches.open(OFFLINE_CACHE);
            await c.delete(item.streamUrl);
        } catch (e) {}
    }
    renderLibrary();
}

function formatLyrics(text) {
    return text.split("\n")
        .map(line => line.replace(/^\[\d{2}:\d{2}(?:\.\d+)?\]/, "").trim())
        .filter(Boolean)
        .join("\n");
}

function showError(message) {
    const errorDiv = $("error");
    errorDiv.textContent = message;
    errorDiv.classList.remove("hidden");
    setTimeout(() => hide("error"), 5000);
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

$("searchBtn").addEventListener("click", performSearch);
$("searchInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") performSearch();
});

document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.mode));
});

$("lyricsBtn").addEventListener("click", () => { if (currentItem) showLyrics(currentItem); });
$("downloadMp3Btn").addEventListener("click", () => { if (currentItem) downloadMp3(currentItem.url); });
$("downloadMp4Btn").addEventListener("click", () => { if (currentItem) downloadMp4(currentItem.url); });
$("saveOfflineBtn").addEventListener("click", () => { if (currentItem) saveOffline(currentItem); });

$("lyricsClose").addEventListener("click", () => hide("lyricsModal"));
document.querySelector(".modal-backdrop").addEventListener("click", () => hide("lyricsModal"));

player.addEventListener("click", togglePlay);

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(e => console.warn("SW registration failed", e));
}