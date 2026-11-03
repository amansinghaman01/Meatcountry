const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = requireUser(req); if (!session) return sendJson(res, 401, { error: 'Please sign in.' });
    const id = String(req.query?.id || '').trim(), orderNumber = String(req.query?.orderNumber || '').trim();
    if (!id && !orderNumber) return sendJson(res, 400, { error: 'Provide an order ID or order number.' });
    const selector = id && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderNumber };
    const order = await (await getDb()).collection('orders').findOne({ ...selector, userId: new ObjectId(session.sub) });
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });
    return sendJson(res, 200, { order: { id: order._id.toString(), orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, deliverySlot: order.deliverySlot || null, deliveryPartner: order.deliveryPartner || null, statusHistory: order.statusHistory || [], updatedAt: order.updatedAt } });
  } catch (error) { return errorResponse(res, error); }
};
