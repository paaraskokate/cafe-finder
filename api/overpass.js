const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const TIMEOUT_MS = 12000;

async function fetchEndpoint(endpoint, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const query = req.method === 'POST'
    ? (req.body?.data || '')
    : (req.query?.data || '');

  if (!query) {
    return res.status(400).json({ error: 'Missing "data" parameter' });
  }

  try {
    const data = await Promise.any(
      OVERPASS_ENDPOINTS.map(ep => fetchEndpoint(ep, query))
    );
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).json(data);
  } catch {
    return res.status(503).json({ error: 'All Overpass endpoints failed' });
  }
};
