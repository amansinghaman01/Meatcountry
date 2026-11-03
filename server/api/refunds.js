const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const session = requireUser(req); if (!session) return sendJson(res, 401, { error: 'Please sign in.' });
    const db = await getDb(), col = db.collection('refund_requests'), userId = new ObjectId(session.sub);
    if (req.method === 'GET') {
      const rows = await col.find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
      return sendJson(res, 200, { refunds: rows.map(r => ({ id: r._id.toString(), orderId: r.orderId.toString(), reason: r.reason, amount: r.amount, status: r.status, providerStatus: r.providerStatus || null, refundId: r.refundId || null, createdAt: r.createdAt, updatedAt: r.updatedAt })) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    if (!ObjectId.isValid(String(body.orderId || ''))) return sendJson(res, 400, { error: 'Invalid order.' });
    const order = await db.collection('orders').findOne({ _id: new ObjectId(body.orderId), userId });
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });
    if (order.paymentMethod !== 'Razorpay' || order.paymentStatus !== 'paid') return sendJson(res, 409, { error: 'Only captured online payments can enter the Razorpay refund workflow. COD returns must be handled by support.' });
    if (['delivered', 'cancelled'].includes(order.status)) return sendJson(res, 409, { error: 'This order is not eligible for a customer cancellation request.' });
    const existing = await col.findOne({ orderId: order._id, userId, status: { $in: ['requested', 'processing', 'pending', 'processed'] } });
    if (existing) return sendJson(res, 200, { ok: true, refundRequestId: existing._id.toString(), status: existing.status, message: 'A refund request already exists for this order.' });
    const reason = String(body.reason || '').trim();
    if (reason.length < 5 || reason.length > 500) return sendJson(res, 400, { error: 'Add a short reason (5–500 characters).' });
    const now = new Date();
    const result = await col.insertOne({ orderId: order._id, userId, orderNumber: order.orderNumber, amount: Number(order.total), reason, status: 'requested', createdAt: now, updatedAt: now });
    await db.collection('notifications').insertOne({ userId, orderId: order._id, type: 'refund', message: `Refund request for ${order.orderNumber} has been submitted for review.`, createdAt: now, read: false });
    return sendJson(res, 201, { ok: true, refundRequestId: result.insertedId.toString(), status: 'requested' });
  } catch (error) { return errorResponse(res, error); }
};
