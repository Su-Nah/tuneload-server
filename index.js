const path = require('path');

let ytdlpPath = path.join(__dirname, 'yt-dlp');
// Verifica si existe el binario local, si no intenta el del sistema
const fs = require('fs');
if (!fs.existsSync(ytdlpPath)) {
  ytdlpPath = 'yt-dlp'; // fallback al sistema
}
console.log(`Usando yt-dlp en: ${ytdlpPath}`);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'TuneLoad API', ytdlp: ytdlpPath });
});

app.get('/audio', (req, res) => {
  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }
  const cmd = `${ytdlpPath} --no-playlist -f "bestaudio[ext=m4a]/bestaudio/best" --get-url "https://www.youtube.com/watch?v=${videoId}"`;
  exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: 'yt-dlp failed', detail: stderr });
    const url = stdout.trim().split('\n')[0];
    if (!url) return res.status(500).json({ error: 'Empty URL' });
    res.json({ url, videoId });
  });
});

app.get('/info', (req, res) => {
  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }
  const cmd = `${ytdlpPath} --no-playlist --dump-json "https://www.youtube.com/watch?v=${videoId}"`;
  exec(cmd, { timeout: 20000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Could not get info' });
    try {
      const info = JSON.parse(stdout);
      res.json({ title: info.title, author: info.uploader || info.channel, duration: info.duration, thumbnail: info.thumbnail });
    } catch { res.status(500).json({ error: 'Parse error' }); }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TuneLoad API running on port ${PORT}`));