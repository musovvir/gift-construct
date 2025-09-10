import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Включаем CORS
app.use(cors());

// Простой прокси для CDN
app.get('/cdn/*', async (req, res) => {
  try {
    const url = `https://cdn.changes.tg${req.path.replace('/cdn', '')}`;
    console.log(`Proxying CDN request to: ${url}`);
    const response = await fetch(url);
    const data = await response.text();
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (error) {
    console.log('CDN Proxy error:', error.message);
    res.status(500).send('CDN Proxy error');
  }
});

// Простой прокси для API
app.get('*', async (req, res) => {
  try {
    const url = `https://api.changes.tg${req.path}`;
    console.log(`Proxying API request to: ${url}`);
    const response = await fetch(url);
    const data = await response.text();
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (error) {
    console.log('API Proxy error:', error.message);
    res.status(500).send('API Proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`CORS Proxy server running on http://localhost:${PORT}`);
  console.log('Use this as API_BASE: http://localhost:3001');
});
