const catalog = require('../catalog');
const { getDb } = require('../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    let available = catalog.map(p => ({ ...p })), source = 'sample';
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      const overrides = await db.collection('products').find({}).toArray();
      const byId = new Map(catalog.map(p => [p.id, p]));
      for (const item of overrides) { if (item.active === false) byId.delete(item.id); else byId.set(item.id, { ...(byId.get(item.id) || {}), ...item, _id: undefined }); }
      available = [...byId.values()]; source = 'database';
      const ids = available.map(p => p.id);
      const reviewStats = await db.collection('reviews').aggregate([{ $match: { productId: { $in: ids }, status: 'approved' } }, { $group: { _id: '$productId', average: { $avg: '$rating' }, count: { $sum: 1 } } }]).toArray();
      const stats = new Map(reviewStats.map(x => [x._id, { averageRating: Math.round(x.average * 10) / 10, reviewCount: x.count }]));
      available = available.map(p => ({ ...p, ...(stats.get(p.id) || { averageRating: 0, reviewCount: 0 }), availability: typeof p.stock === 'number' ? (p.stock > 0 ? 'in_stock' : 'out_of_stock') : 'stock_untracked' }));
    }
    return sendJson(res, 200, { products: available, source, notice: source === 'sample' ? 'Database is not configured; showing sample catalogue. Stock is not live.' : undefined });
  } catch (error) { return errorResponse(res, error); }
};
