import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Включаем CORS с более широкими настройками
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false
}));

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Обработка preflight запросов
app.options('*', (req, res) => {
  res.status(200).end();
});

// Простой прокси для CDN
app.get('/cdn/*', async (req, res) => {
  try {
    const url = `https://cdn.changes.tg${req.path.replace('/cdn', '')}`;
    console.log(`Proxying CDN request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Local-Proxy/1.0)',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      console.error(`CDN request failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).send(`CDN request failed: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    // Для изображений и бинарных файлов
    if (contentType.startsWith('image/') || contentType.includes('octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      const data = await response.text();
      res.send(data);
    }
  } catch (error) {
    console.error('CDN Proxy error:', error.message);
    res.status(500).json({ error: 'CDN Proxy error', message: error.message });
  }
});

// Простой прокси для API
app.get('*', async (req, res) => {
  try {
    const url = `https://api.changes.tg${req.path}`;
    console.log(`Proxying API request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Local-Proxy/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: 'API request failed', 
        status: response.status,
        statusText: response.statusText 
      });
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error('API Proxy error:', error.message);
    res.status(500).json({ error: 'API Proxy error', message: error.message });
  }
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 API requests will be proxied to: https://api.changes.tg`);
  console.log(`📁 CDN requests will be proxied to: https://cdn.changes.tg`);
  console.log(`🔧 Use this as API_BASE: http://localhost:3001`);
});
