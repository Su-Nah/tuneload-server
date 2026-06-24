const express = require('express');
const https   = require('https');
const http    = require('http');
const app     = express();

// Instancias públicas de Invidious — si una cae, prueba la siguiente
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space',
  'https://invidious.fdn.fr',
  'https://invidious.nerdvpn.de',
  'https://invidious.io.lol',
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { error: 'parse_error', raw: data.slice(0, 200) } }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
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

  const errors = [];

  for (const base of INVIDIOUS) {
    try {
      console.log(`▶ Probando ${base}`);
      const { status, body } = await fetchJson(`${base}/api/v1/videos/${videoId}`);
      console.log(`  status: ${status}, keys: ${Object.keys(body).join(',')}`);

      if (status !== 200) {
        errors.push(`${base}: HTTP ${status}`);
        continue;
      }

      const streams = (body.adaptiveFormats || [])
        .filter(f => f.type && f.type.startsWith('audio/'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      console.log(`  streams de audio encontrados: ${streams.length}`);

      if (streams.length === 0) {
        errors.push(`${base}: sin streams de audio`);
        continue;
      }

      const url = streams[0].url;
      if (!url) { errors.push(`${base}: url vacía`); continue; }

      console.log(`✅ URL obtenida de ${base}`);
      return res.json({ url, videoId });
    } catch (e) {
      console.log(`  error: ${e.message}`);
      errors.push(`${base}: ${e.message}`);
      continue;
    }
  }

  res.status(500).json({ error: 'No se pudo obtener audio', details: errors });
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
        title:     body.title         || `Video ${videoId}`,
        author:    body.author        || 'YouTube',
        duration:  body.lengthSeconds || 0,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      });
    } catch { continue; }
  }

  res.status(500).json({ error: 'Could not get info' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TuneLoad API running on port ${PORT}`));