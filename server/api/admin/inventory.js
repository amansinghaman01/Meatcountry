const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const db = admin.db, products = db.collection('products');
    if (req.method === 'GET') {
      const rows = await products.find({ active: { $ne: false }, stock: { $exists: true } }).sort({ stock: 1 }).limit(500).toArray();
      const lowStock = rows.filter(p => Number(p.stock || 0) <= Number(p.minStock ?? 5));
      return sendJson(res, 200, { products: rows.map(p => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.minStock ?? 5, low: Number(p.stock || 0) <= Number(p.minStock ?? 5) })), lowStockCount: lowStock.length, outOfStockCount: rows.filter(p => Number(p.stock || 0) === 0).length });
    }
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'PATCH']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req), id = String(body.productId || ''), delta = Number(body.delta);
    if (!/^[A-Z0-9-]{3,32}$/.test(id) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return sendJson(res, 400, { error: 'Provide a product ID and a non-zero integer stock adjustment.' });
    const before = await products.findOne({ id, active: { $ne: false } });
    if (!before || !Number.isInteger(Number(before.stock))) return sendJson(res, 404, { error: 'Managed inventory product not found. Initialize catalogue stock first.' });
    const result = await products.updateOne({ _id: before._id, stock: { $gte: Math.max(0, -delta) } }, { $inc: { stock: delta }, $set: { updatedAt: new Date() } });
    if (!result.modifiedCount) return sendJson(res, 409, { error: 'Stock cannot become negative.' });
    const after = await products.findOne({ _id: before._id }, { projection: { stock: 1 } });
    await db.collection('inventory_movements').insertOne({ productId: id, productName: before.name, delta, before: before.stock, after: after.stock, reason: String(body.reason || 'Admin stock adjustment').slice(0, 200), adjustedBy: admin.user._id, createdAt: new Date() });
    return sendJson(res, 200, { ok: true, productId: id, stock: after.stock });
  } catch (error) { return errorResponse(res, error); }
};
