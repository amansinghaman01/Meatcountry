const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../lib/http');
module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    if (req.method === 'GET') {
      const productId = String(req.query?.productId || '').trim();
      if (!/^[A-Z0-9-]{3,32}$/.test(productId)) return sendJson(res, 400, { error: 'Invalid product ID.' });
      const rows = await db.collection('reviews').find({ productId, status: 'approved' }).sort({ createdAt: -1 }).limit(50).toArray();
      return sendJson(res, 200, { reviews: rows.map(r => ({ rating: r.rating, title: r.title, body: r.body, photoUrl: r.photoUrl || '', createdAt: r.createdAt })) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    if (!assertSameOrigin(req, res)) return;
    const user = requireUser(req); if (!user) return sendJson(res, 401, { error: 'Sign in to write a review.' });
    const body = await readBody(req), productId = String(body.productId || '').trim(), orderId = String(body.orderId || ''), rating = Number(body.rating);
    if (!ObjectId.isValid(orderId) || !/^[A-Z0-9-]{3,32}$/.test(productId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return sendJson(res, 400, { error: 'Choose a purchased product and a 1–5 star rating.' });
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: new ObjectId(user.sub), status: 'delivered', 'items.productId': productId });
    if (!order) return sendJson(res, 403, { error: 'Reviews are available only for products in your delivered orders.' });
    const existing = await db.collection('reviews').findOne({ orderId: order._id, productId, userId: new ObjectId(user.sub) });
    if (existing) return sendJson(res, 409, { error: 'You have already reviewed this product for this order.' });
    const photoUrl = String(body.photoUrl || '').trim();
    if (photoUrl && (!/^https:\/\//i.test(photoUrl) || photoUrl.length > 1200)) return sendJson(res, 400, { error: 'Review photo must be a valid HTTPS image URL.' });
    const title = String(body.title || '').trim(), text = String(body.body || '').trim();
    if (title.length > 100 || text.length < 5 || text.length > 1200) return sendJson(res, 400, { error: 'Add a short title and review (5–1,200 characters).' });
    await db.collection('reviews').insertOne({ orderId: order._id, orderNumber: order.orderNumber, productId, userId: new ObjectId(user.sub), customerName: user.name || 'Customer', rating, title, body: text, photoUrl, status: 'pending', createdAt: new Date() });
    return sendJson(res, 201, { ok: true, status: 'pending_moderation' });
  } catch (error) { return errorResponse(res, error); }
};
