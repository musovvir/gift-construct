export default async function handler(req, res) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Обрабатываем preflight запросы
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const decodedUrl = decodeURIComponent(url);

    // Делаем запрос к целевому API или CDN
    const response = await fetch(decodedUrl, {
      method: req.method,
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; Vercel-Proxy/1.0)',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch data',
        status: response.status,
        statusText: response.statusText
      });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      const buffer = await response.arrayBuffer();
      res.status(200).send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
