const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
const catalog = require('../../../catalog');

function clean(body) {
  const name = String(body.name || '').trim();
  const id = String(body.id || '').trim();
  const category = String(body.category || '').trim();
  const price = Number(body.price), mrp = Number(body.mrp), stock = Number(body.stock ?? 100), costPrice = Number(body.costPrice || 0), minStock = Number(body.minStock || 5);
  if (!/^[A-Z0-9-]{3,32}$/.test(id) || name.length < 3 || name.length > 100 || category.length < 2 || !Number.isFinite(price) || price <= 0 || price > 100000 || !Number.isFinite(mrp) || mrp < price || mrp > 150000 || !Number.isInteger(stock) || stock < 0 || stock > 100000 || !Number.isFinite(costPrice) || costPrice < 0 || costPrice > 150000 || !Number.isInteger(minStock) || minStock < 0 || minStock > 100000) throw Object.assign(new Error('Enter a valid product ID, name, category and prices.'), { status: 400 });
  const image = String(body.image || '').trim();
  if (image && !/^https:\/\//i.test(image)) throw Object.assign(new Error('Product image must use HTTPS.'), { status: 400 });
  return { id, name, category, price, mrp, stock, costPrice, minStock, nutrition: String(body.nutrition || '').slice(0, 500), preparation: String(body.preparation || '').slice(0, 500), storage: String(body.storage || '').slice(0, 500), bestBefore: String(body.bestBefore || '').slice(0, 120), combo: body.combo === true, alternatives: Array.isArray(body.alternatives) ? body.alternatives.map(String).slice(0, 10) : [], cut: String(body.cut || '').slice(0,80), weight: String(body.weight || '').slice(0,40), badge: String(body.badge || 'Fresh pick').slice(0,40), desc: String(body.desc || '').slice(0,240), image, active: body.active !== false, updatedAt: new Date() };
}
module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const col = admin.db.collection('products');
    if (req.method === 'GET') {
      const overrides = await col.find({}).toArray(); const byId = new Map(catalog.map(p => [p.id, p]));
      for (const p of overrides) { if (p.active === false) byId.delete(p.id); else byId.set(p.id,{...(byId.get(p.id)||{}),...p,_id:undefined}); }
      return sendJson(res, 200, { products: [...byId.values()] });
    }
    if (!assertSameOrigin(req, res)) return;
    if (!['POST','PATCH','DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET','POST','PATCH','DELETE']);
    const body = await readBody(req);
    if (body.action === 'seedCatalog' && req.method === 'POST') {
      const ops = catalog.map(p => ({ updateOne: { filter: { id: p.id }, update: { $setOnInsert: { ...p, stock: 100, costPrice: 0, minStock: 5, active: true, createdAt: new Date(), updatedAt: new Date() } }, upsert: true } }));
      await col.bulkWrite(ops,{ordered:false});
      return sendJson(res,200,{ok:true,seeded:ops.length});
    }
    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      const base = catalog.find(p => p.id === id);
      const seed = base ? (({ active, updatedAt, ...rest }) => rest)(base) : null;
      const result = await col.updateOne({ id }, { $set: { active: false, updatedAt: new Date() }, ...(seed ? { $setOnInsert: { ...seed, stock: 100, createdAt: new Date() } } : {}) }, { upsert: !!seed });
      return sendJson(res, result.matchedCount || result.upsertedCount ? 200 : 404, { ok: !!(result.matchedCount || result.upsertedCount) });
    }
    const item = clean(body);
    const result = await col.updateOne({ id: item.id }, { $set: item, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return sendJson(res, 200, { ok: true, id: item.id, upserted: !!result.upsertedCount });
  } catch (error) { if (error.status) return sendJson(res,error.status,{error:error.message}); return errorResponse(res,error); }
};
