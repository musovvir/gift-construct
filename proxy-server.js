import express from 'express';
import cors from 'cors';
import { Buffer } from 'buffer';

const app = express();
const PORT = 3001;

// Парсинг JSON и других форматов (только для запросов с телом)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Включаем CORS с более широкими настройками
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
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

// Тестовый эндпоинт для проверки работы прокси
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Proxy server is running',
    timestamp: new Date().toISOString()
  });
});

// Простой прокси для CDN (все методы) - должен быть первым
app.all('/cdn/*', async (req, res) => {
  try {
    // Формируем URL с учетом query параметров
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const path = req.path.replace('/cdn', '');
    const url = `https://cdn.changes.tg${path}${queryString}`;
    console.log(`[CDN] Proxying request: ${req.method} ${req.path} -> ${url}`);
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Local-Proxy/1.0)',
        'Accept': '*/*'
      }
    };

    // Передаем тело запроса для POST/PUT/PATCH
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (Buffer.isBuffer(req.body)) {
        fetchOptions.body = req.body;
      } else if (typeof req.body === 'string') {
        fetchOptions.body = req.body;
      } else if (req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      console.error(`[CDN] Request failed: ${response.status} ${response.statusText} for ${url}`);
      return res.status(response.status).send(`CDN request failed: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

    // Для изображений и бинарных файлов
    if (contentType.startsWith('image/') || contentType.includes('octet-stream') || contentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      const data = await response.text();
      res.send(data);
    }
  } catch (error) {
    console.error('[CDN] Proxy error:', error.message);
    console.error('[CDN] Stack:', error.stack);
    res.status(500).json({ error: 'CDN Proxy error', message: error.message });
  }
});

// Простой прокси для API (все методы) - обрабатывает все остальные запросы
app.all('*', async (req, res) => {
  try {
    // Формируем URL с учетом query параметров
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const path = req.path === '/' ? '' : req.path;
    const url = `https://api.changes.tg${path}${queryString}`;
    console.log(`[API] Proxying request: ${req.method} ${req.path} -> ${url}`);
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Local-Proxy/1.0)',
        'Accept': 'application/json'
      }
    };

    // Передаем заголовки авторизации, если есть
    if (req.headers.authorization) {
      fetchOptions.headers['Authorization'] = req.headers.authorization;
    }

    // Передаем тело запроса для POST/PUT/PATCH/DELETE
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (Buffer.isBuffer(req.body)) {
        fetchOptions.body = req.body;
        fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/octet-stream';
      } else if (typeof req.body === 'string') {
        fetchOptions.body = req.body;
        fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'text/plain';
      } else if (req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      console.error(`[API] Request failed: ${response.status} ${response.statusText} for ${url}`);
      const errorText = await response.text().catch(() => response.statusText);
      return res.status(response.status).json({ 
        error: 'API request failed', 
        status: response.status,
        statusText: response.statusText,
        message: errorText
      });
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error('[API] Proxy error:', error.message);
    console.error('[API] Stack:', error.stack);
    res.status(500).json({ error: 'API Proxy error', message: error.message });
  }
});

// Обработка ошибок
app.use((error, req, res) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 API requests will be proxied to: https://api.changes.tg`);
  console.log(`📁 CDN requests will be proxied to: https://cdn.changes.tg`);
  console.log(`🔧 Use this as API_BASE: http://localhost:${PORT}`);
  console.log(`\nReady to proxy requests!`);
});
