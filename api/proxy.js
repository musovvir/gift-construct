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

    let decodedUrl = decodeURIComponent(url);

    if (decodedUrl.startsWith('https:/') && !decodedUrl.startsWith('https://')) {
      decodedUrl = decodedUrl.replace('https:/', 'https://');
    }

    if (decodedUrl.startsWith('http:/') && !decodedUrl.startsWith('http://')) {
      decodedUrl = decodedUrl.replace('http:/', 'http://');
    }

    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Делаем запрос к целевому API
    const response = await fetch(decodedUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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

    // Определяем тип контента
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(200).json(data);
    } else if (contentType && contentType.includes('image/')) {
      // Для изображений возвращаем blob
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.byteLength);
      res.status(200).send(Buffer.from(buffer));
    } else {
      // Для других типов контента
      const text = await response.text();
      res.setHeader('Content-Type', contentType || 'text/plain');
      res.status(200).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
