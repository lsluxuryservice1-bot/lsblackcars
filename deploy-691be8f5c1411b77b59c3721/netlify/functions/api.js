exports.handler = async (event) => {
  const path = event.path || '';
  const isPromotions = /\/api\/promotions\b/.test(path) || /\/api\/api\/promotions\b/.test(path);
  if (!isPromotions) {
    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not Found' }) };
  }
  const version = String(Date.now()).slice(0, 10);
  const ifNoneMatch = (event.headers && (event.headers['if-none-match'] || event.headers['If-None-Match'])) || '';
  if (ifNoneMatch === version) {
    return { statusCode: 304, headers: { 'ETag': version } };
  }
  const payload = {
    version,
    items: [
      { title: 'Premium Chauffeur', subtitle: 'Limited time offers', code: 'PREMIUM', image: '/assets/premium_black_luxury_sedan_3e9f8e87-uoahuiu0.png' }
    ]
  };
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'ETag': version }, body: JSON.stringify(payload) };
};
