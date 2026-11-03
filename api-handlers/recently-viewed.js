const { ObjectId } = require('mongodb');
const catalog = require('../catalog');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../lib/http');
module.exports = async function handler(req, res) {
  try {
    const session = requireUser(req); if (!session) return sendJson(res, 401, { error: 'Sign in to sync recently viewed products.' });
    const db = await getDb(), users = db.collection('users'), userId = new ObjectId(session.sub);
    if (req.method === 'GET') {
      const user = await users.findOne({ _id: userId }, { projection: { recentlyViewed: 1 } });
      const ids = user?.recentlyViewed || [];
      const overrides = await db.collection('products').find({ id: { $in: ids }, active: { $ne: false } }).toArray();
      const byId = new Map(catalog.map(p => [p.id, p])); for (const p of overrides) byId.set(p.id, { ...(byId.get(p.id) || {}), ...p });
      return sendJson(res, 200, { products: ids.map(id => byId.get(id)).filter(Boolean) });
    }
    if (req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req), id = String(body.productId || '');
    if (!/^[A-Z0-9-]{3,32}$/.test(id) || !catalog.some(p => p.id === id) && !(await db.collection('products').findOne({ id, active: { $ne: false } }))) return sendJson(res, 400, { error: 'Product is not available.' });
    await users.updateOne({ _id: userId }, [{ $set: { recentlyViewed: { $slice: [{ $concatArrays: [[id], { $filter: { input: { $ifNull: ['$recentlyViewed', []] }, as: 'x', cond: { $ne: ['$$x', id] } } }] }, 12] }, updatedAt: new Date() } }]);
    return sendJson(res, 200, { ok: true });
  } catch (error) { return errorResponse(res, error); }
};
