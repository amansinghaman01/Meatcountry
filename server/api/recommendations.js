const catalog = require('../../catalog');
const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = requireUser(req);
    let preferred = [];
    if (session && process.env.MONGODB_URI) {
      const db = await getDb();
      const orders = await db.collection('orders').find({ userId: new ObjectId(session.sub) }).sort({ createdAt: -1 }).limit(10).toArray();
      preferred = orders.flatMap((o) => (o.items || []).map((i) => i.category));
    }
    let available = catalog;
    if (process.env.MONGODB_URI) { const db=await getDb(); const overrides=await db.collection('products').find({}).toArray(); const byId=new Map(catalog.map(p=>[p.id,p])); for(const item of overrides){if(item.active===false)byId.delete(item.id);else byId.set(item.id,{...(byId.get(item.id)||{}),...item});} available=[...byId.values()]; }
    const top = preferred.length ? preferred.sort((a,b) => preferred.filter(x=>x===b).length - preferred.filter(x=>x===a).length)[0] : 'Chicken';
    const products = [...available].sort((a,b) => Number(b.category === top) - Number(a.category === top) || Number(/best|popular/i.test(b.badge)) - Number(/best|popular/i.test(a.badge))).slice(0, 6);
    return sendJson(res, 200, { products, strategy: preferred.length ? 'purchase-history' : 'popular-picks' });
  } catch (error) { return errorResponse(res, error); }
};
