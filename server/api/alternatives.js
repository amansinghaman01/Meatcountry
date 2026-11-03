const catalog = require('../../catalog');
const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = String(req.query?.productId || '').trim();
    if (!id) return sendJson(res, 400, { error: 'productId is required.' });
    let base = catalog.find(p => p.id === id) || null;
    let items = catalog;
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      const [storedBase, storedProducts] = await Promise.all([
        db.collection('products').findOne({ id, active: { $ne: false } }),
        db.collection('products').find({ active: { $ne: false }, stock: { $gt: 0 } }).toArray()
      ]);
      if (storedBase) base = { ...(base || {}), ...storedBase };
      const map = new Map(catalog.map(p => [p.id, p]));
      for (const product of storedProducts) map.set(product.id, { ...(map.get(product.id) || {}), ...product });
      items = [...map.values()];
    }
    if (!base) return sendJson(res, 404, { error: 'Product not found.' });
    const preferred = Array.isArray(base.alternatives) ? new Set(base.alternatives.map(String)) : null;
    let alternatives = items.filter(p => p.id !== id && (p.stock === undefined || Number(p.stock) > 0) &&
      (preferred?.size ? preferred.has(String(p.id)) : p.category === base.category));
    if (!alternatives.length && preferred?.size) alternatives = items.filter(p => p.id !== id && (p.stock === undefined || Number(p.stock) > 0) && p.category === base.category);
    return sendJson(res, 200, { alternatives: alternatives.slice(0, 5), source: process.env.MONGODB_URI ? 'database' : 'sample' });
  } catch (error) { return errorResponse(res, error); }
};
