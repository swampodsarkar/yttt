# TubePlay - YouTube Music & Video Player

Unofficial YouTube API with a full web player: Music, Video, Download, Offline Save, Lyrics.

<p align="center">
<a href="https://github.com/FatihArridho?tab=followers"><img title="Followers" src="https://img.shields.io/github/followers/FatihArridho?color=red&style=flat-square"></a>
<a href="https://github.com/FatihArridho/Unofficial-YoutubeApi/stargazers/"><img title="Stars" src="https://img.shields.io/github/stars/FatihArridho/Unofficial-YoutubeApi?color=blue&style=flat-square"></a>
<a href="https://github.com/FatihArridho/Unofficial-YoutubeApi/network/members"><img title="Forks" src="https://img.shields.io/github/forks/FatihArridho/Unofficial-YoutubeApi?color=red&style=flat-square"></a>
<a href="https://github.com/FatihArridho/Unofficial-YoutubeApi"><img title="Open Source" src="https://badges.frapsoft.com/os/v2/open-source.svg?v=103"></a>
</p>

## Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Search Music | `GET /youtube/search?video=QUERY` | Search music videos |
| Search Video | `GET /youtube/search?video=QUERY` | Search videos |
| Stream Audio | `GET /youtube/stream?url=URL&quality=audio` | Get audio stream URL |
| Stream Video | `GET /youtube/stream?url=URL&quality=720` | Get video stream URL |
| Download MP3 | `GET /youtube/download/mp3?url=URL` | Download as MP3 (ffmpeg required) |
| Download MP4 | `GET /youtube/download/video?url=URL&quality=720` | Download video file |
| Lyrics | `GET /youtube/lyrics?q=TITLE+ARTIST` | Fetch lyrics from lrclib |

## Web Player Features

- **Music tab** — search and play songs, view lyrics, download MP3, save offline
- **Video tab** — search and watch videos, download MP4
- **Library tab** — view and manage offline saved songs
- **PWA** — installable, works offline for saved content
- **Service Worker** — caches app shell and offline audio streams

## Deploy on Render (Free)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect GitHub repo
3. Set:
   - Build Command: `pip install -U yt-dlp && (apt-get update && apt-get install -y ffmpeg || true)`
   - Start Command: `npm start`
   - Env Var: `YTDLP_CMD=yt-dlp`
4. Deploy!

## Local Setup

```bash
npm install
npm start
```

Open `http://localhost:8080`

**Requirements:** Python + yt-dlp + ffmpeg (for MP3 conversion)

## Want To Contribute?

Pull Request! :)

## Donate

- <a href="https://saweria.co/FatihArridho" target="_blank">Saweria</a>
- <a href="https://trakteer.id/FatihArridho/tip" target="_blank">Trakteer</a>
