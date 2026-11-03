const catalog = require('../catalog');
const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../lib/http');

function buildCategoryFrequency(orders) {
  const frequency = new Map();

  for (const order of orders) {
    for (const item of order.items || []) {
      const category = typeof item.category === 'string' ? item.category.trim() : '';
      if (!category) continue;

      // Weight the preference by units purchased, falling back to one for older orders.
      const rawQuantity = Number(item.quantity);
      const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
      frequency.set(category, (frequency.get(category) || 0) + quantity);
    }
  }

  return frequency;
}

function popularityScore(product) {
  return /best|popular/i.test(String(product.badge || '')) ? 1 : 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = requireUser(req);
    let categoryFrequency = new Map();

    if (session && process.env.MONGODB_URI) {
      const db = await getDb();
      const orders = await db.collection('orders')
        .find({ userId: new ObjectId(session.sub) })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      categoryFrequency = buildCategoryFrequency(orders);
    }

    let available = catalog;
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      const overrides = await db.collection('products').find({}).toArray();
      const byId = new Map(catalog.map((product) => [product.id, product]));

      for (const item of overrides) {
        if (item.active === false) byId.delete(item.id);
        else byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
      }

      available = [...byId.values()];
    }

    // Category counts are built once in O(n); each product score is then an O(1) Map lookup.
    const products = [...available]
      .sort((a, b) =>
        (categoryFrequency.get(b.category) || 0) - (categoryFrequency.get(a.category) || 0) ||
        popularityScore(b) - popularityScore(a)
      )
      .slice(0, 6);

    return sendJson(res, 200, {
      products,
      strategy: categoryFrequency.size ? 'purchase-history' : 'popular-picks'
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
