const express = require('express');
const https   = require('https');
const http    = require('http');
const app     = express();

// Instancias públicas de Invidious ordenadas por estabilidad
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space',
  'https://invidious.fdn.fr',
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'TuneLoad API v2 (Invidious)' });
});

app.get('/audio', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  for (const base of INVIDIOUS) {
    try {
      const { status, body } = await fetchJson(`${base}/api/v1/videos/${videoId}`);
      if (status !== 200) continue;

      const streams = (body.adaptiveFormats || [])
        .filter(f => f.type && f.type.startsWith('audio/'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (streams.length === 0) continue;

      const url = streams[0].url;
      if (!url) continue;

      console.log(`✅ Audio URL obtenida de ${base}`);
      return res.json({ url, videoId });
    } catch (e) {
      console.log(`❌ ${base} falló: ${e.message}`);
      continue;
    }
  }

  res.status(500).json({ error: 'No se pudo obtener audio de ninguna instancia' });
});

app.get('/info', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  for (const base of INVIDIOUS) {
    try {
      const { status, body } = await fetchJson(`${base}/api/v1/videos/${videoId}`);
      if (status !== 200) continue;
      return res.json({
        title:     body.title     || `Video ${videoId}`,
        author:    body.author    || 'YouTube',
        duration:  body.lengthSeconds || 0,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      });
    } catch { continue; }
  }

  res.status(500).json({ error: 'Could not get info' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TuneLoad API running on port ${PORT}`));