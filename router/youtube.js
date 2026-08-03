const express = require("express");
const router = express.Router();
const YoutubeSearch = require("../lib/youtube");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const axios = require("axios");
const execAsync = promisify(exec);

const YTDLP_CMD = process.env.YTDLP_CMD || "python -m yt_dlp";

function ytdlpSpawn(args) {
    const parts = YTDLP_CMD.split(/\s+/);
    return spawn(parts[0], [...parts.slice(1), ...args], { windowsHide: true });
}

async function runYtdlp(args) {
    const cmd = `${YTDLP_CMD} ${args}`;
    const { stdout, stderr } = await execAsync(cmd, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        shell: "cmd.exe"
    });
    if (stderr && stderr.includes("ERROR")) {
        throw new Error(stderr.trim());
    }
    return stdout.trim();
}

router.get("/", async(req, res) => {
    res.status(400).json({
        author: "FatihArridho",
        message: "Ooopss, you can go to router /search for more details."
    })
})

router.get("/search", async(req, res) => {
    let channel = req.query.channel
    let video = req.query.video
    let playlist = req.query.playlist
    let all = req.query.all

    if (channel) {
        let result = await YoutubeSearch(channel);
        if (result.channel.length == 0) return res.status(400).json({
            author: "FatihArridho",
            message: "Channel not found."
        });
        res.status(200).json({
            author: "FatihArridho",
            result: result.channel
        });
    } else if (video) {
        let result = await YoutubeSearch(video);
        if (result.video.length == 0) return res.status(400).json({
            author: "FatihArridho",
            message: "Video not found."
        });
        res.status(200).json({
            author: "FatihArridho",
            result: result.video
        });
    } else if (playlist) {
        let result = await YoutubeSearch(playlist);
        if (result.playlist.length == 0) return res.status(400).json({
            author: "FatihArridho",
            message: "Playlist not found."
        });
        res.status(200).json({
            author: "FatihArridho",
            result: result.playlist
        });
    } else if (all) {
        let result = await YoutubeSearch(all);
        res.status(200).json({
            author: "FatihArridho",
            result
        })
    } else {
        res.status(400).json({
            author: "FatihArridho",
            message: "Enter parameters, available parameters: channel, video, playlist, all."
        })
    }
});

router.get("/download", async(req, res) => {
    let videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'url' is required."
        });
    }

    try {
        const infoJson = await runYtdlp(`-j "${videoUrl}"`);
        const info = JSON.parse(infoJson);

        const formats = (info.formats || [])
            .filter(f => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
            .map(f => ({
                quality: f.qualityLabel || `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        const videoOnly = (info.formats || [])
            .filter(f => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"))
            .map(f => ({
                quality: f.qualityLabel || `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        const audioOnly = (info.formats || [])
            .filter(f => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
            .map(f => ({
                quality: f.audioBitrate ? `${f.audioBitrate}kbps` : `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        res.status(200).json({
            author: "FatihArridho",
            result: {
                videoId: info.id,
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration,
                author: info.channel || info.uploader,
                formats,
                videoOnly,
                audioOnly
            }
        });
    } catch (error) {
        console.error("Download info error:", error.message);
        res.status(500).json({
            author: "FatihArridho",
            message: "Failed to fetch video info. The video may be unavailable or yt-dlp is not installed."
        });
    }
});

router.get("/download/mp3", async(req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'url' is required."
        });
    }

    let info;
    try {
        info = JSON.parse(await runYtdlp(`-j "${videoUrl}"`));
    } catch (error) {
        console.error("MP3 download info error:", error.message);
        return res.status(500).json({
            author: "FatihArridho",
            message: "Failed to fetch video info. The video may be unavailable."
        });
    }

    const safeTitle = (info.title || "youtube-audio").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 100);

    const hasFfmpeg = await execAsync("where ffmpeg")
        .then(() => true)
        .catch(() => false);

    const useMp3 = hasFfmpeg;
    const formatArg = useMp3 ? "-x --audio-format mp3 -f bestaudio/best" : "-f bestaudio/best";
    const ext = useMp3 ? "mp3" : (info.ext || "m4a");
    const mime = ext === "mp3" ? "audio/mpeg" : (ext === "webm" ? "audio/webm" : "audio/mp4");

    const child = ytdlpSpawn([...formatArg.split(" "), "-o", "-", videoUrl]);

    res.setHeader("Content-Type", mime);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="youtube-${info.id || "audio"}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.${ext}`)}`
    );

    child.stdout.pipe(res);

    let sentError = false;
    child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.includes("ERROR") && !sentError) {
            sentError = true;
            console.error("MP3 download error:", text.trim());
            if (!res.headersSent) {
                res.status(500).json({
                    author: "FatihArridho",
                    message: "Failed to download audio. The video may be unavailable or ffmpeg is missing."
                });
            } else {
                res.destroy();
            }
        }
    });

    child.on("error", (err) => {
        console.error("MP3 spawn error:", err.message);
        if (!res.headersSent) {
            res.status(500).json({
                author: "FatihArridho",
                message: "Failed to start download process."
            });
        } else {
            res.destroy();
        }
    });
});

router.get("/download/video", async(req, res) => {
    const videoUrl = req.query.url;
    const quality = req.query.quality || "720";

    if (!videoUrl) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'url' is required."
        });
    }

    const q = parseInt(quality);
    const formatArg = isNaN(q)
        ? "-f best"
        : `-f best[ext=mp4][height<=${q}]/best[height<=${q}]/best`;

    let info, ext;
    try {
        info = JSON.parse(await runYtdlp(`-j "${videoUrl}"`));
        const printOut = await runYtdlp(`-f "${formatArg.slice(3)}" --print "%(ext)s" -g "${videoUrl}"`);
        ext = (printOut.split("\n")[0] || "").trim() || "mp4";
    } catch (error) {
        console.error("Video download info error:", error.message);
        return res.status(500).json({
            author: "FatihArridho",
            message: "Failed to fetch video info. The video may be unavailable."
        });
    }

    const safeTitle = (info.title || "youtube-video").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 100);
    const mime = ext === "mp4" ? "video/mp4" : (ext === "webm" ? "video/webm" : "video/mp4");

    const child = ytdlpSpawn([...formatArg.split(" "), "-o", "-", videoUrl]);

    res.setHeader("Content-Type", mime);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="youtube-${info.id || "video"}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.${ext}`)}`
    );

    child.stdout.pipe(res);

    let sentError = false;
    child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.includes("ERROR") && !sentError) {
            sentError = true;
            console.error("Video download error:", text.trim());
            if (!res.headersSent) {
                res.status(500).json({
                    author: "FatihArridho",
                    message: "Failed to download video."
                });
            } else {
                res.destroy();
            }
        }
    });

    child.on("error", (err) => {
        console.error("Video spawn error:", err.message);
        if (!res.headersSent) {
            res.status(500).json({
                author: "FatihArridho",
                message: "Failed to start download process."
            });
        } else {
            res.destroy();
        }
    });
});

router.get("/lyrics", async(req, res) => {
    const query = (req.query.q || req.query.query || "").trim();
    if (!query) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'q' is required."
        });
    }

    try {
        const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
            timeout: 15000,
            headers: { "User-Agent": "TubePlay/1.0" }
        });

        if (Array.isArray(data) && data.length > 0) {
            const song = data[0];
            const lyrics = song.syncedLyrics || song.plainLyrics;
            if (lyrics) {
                return res.status(200).json({
                    author: "FatihArridho",
                    result: {
                        title: song.trackName,
                        artist: song.artistName,
                        album: song.albumName,
                        duration: song.duration,
                        synced: !!song.syncedLyrics,
                        lyrics
                    }
                });
            }
        }

        res.status(404).json({
            author: "FatihArridho",
            message: "Lyrics not found."
        });
    } catch (error) {
        console.error("Lyrics error:", error.message);
        res.status(500).json({
            author: "FatihArridho",
            message: "Failed to fetch lyrics."
        });
    }
});

router.get("/download", async(req, res) => {
    let videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'url' is required."
        });
    }

    try {
        const infoJson = await runYtdlp(`-j "${videoUrl}"`);
        const info = JSON.parse(infoJson);

        const formats = (info.formats || [])
            .filter(f => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
            .map(f => ({
                quality: f.qualityLabel || `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        const videoOnly = (info.formats || [])
            .filter(f => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"))
            .map(f => ({
                quality: f.qualityLabel || `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        const audioOnly = (info.formats || [])
            .filter(f => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
            .map(f => ({
                quality: f.audioBitrate ? `${f.audioBitrate}kbps` : `itag_${f.format_id}`,
                format: f.ext,
                mimeType: f.mime_type,
                contentLength: f.filesize,
                itag: f.format_id
            }));

        res.status(200).json({
            author: "FatihArridho",
            result: {
                videoId: info.id,
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration,
                author: info.channel || info.uploader,
                views: info.view_count,
                formats,
                videoOnly,
                audioOnly
            }
        });
    } catch (error) {
        console.error("Download info error:", error.message);
        res.status(500).json({
            author: "FatihArridho",
            message: "Failed to fetch video info. The video may be unavailable or yt-dlp is not installed."
        });
    }
});

router.get("/stream", async(req, res) => {
    let videoUrl = req.query.url;
    let quality = req.query.quality || "audio";

    if (!videoUrl) {
        return res.status(400).json({
            author: "FatihArridho",
            message: "Parameter 'url' is required."
        });
    }

    try {
        let formatArg;
        if (quality === "audio") {
            formatArg = "bestaudio";
        } else {
            const q = parseInt(quality);
            formatArg = `best[height<=${q}]/best`;
        }

        const directUrl = await runYtdlp(`-f "${formatArg}" -g "${videoUrl}"`);
        const streamUrl = directUrl.split('\n')[0].trim();

        if (!streamUrl) {
            return res.status(400).json({
                author: "FatihArridho",
                message: "No stream URL found for the requested quality."
            });
        }

        const infoJson = await runYtdlp(`-j "${videoUrl}"`);
        const info = JSON.parse(infoJson);

        res.status(200).json({
            author: "FatihArridho",
            result: {
                videoId: info.id,
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration,
                author: info.channel || info.uploader,
                streamUrl,
                downloadUrl: streamUrl
            }
        });
    } catch (error) {
        console.error("Stream error:", error.message);
        res.status(500).json({
            author: "FatihArridho",
            message: "Failed to get stream URL. Make sure yt-dlp is installed."
        });
    }
});

module.exports = router;