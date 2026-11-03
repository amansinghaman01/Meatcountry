const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const user = requireUser(req); if (!user) return sendJson(res, 401, { error: 'Please sign in.' });
    const db = await getDb();
    const rows = await db.collection('orders').find({ userId: new ObjectId(user.sub) }).sort({ createdAt: -1 }).limit(100).toArray();
    return sendJson(res, 200, { payments: rows.map(o => ({ orderId: o._id.toString(), orderNumber: o.orderNumber, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, amount: o.total, paymentId: o.razorpayPaymentId || null, refundId: o.razorpayRefundId || null, refundStatus: o.refundStatus || null, createdAt: o.createdAt })) });
  } catch (error) { return errorResponse(res, error); }
};
