const { ObjectId } = require('mongodb');
const { requireAdmin } = require('../../../lib/admin');
const { restoreOrderInventory, restorePoints, releaseCoupon } = require('../../../lib/order-utils');
const { releaseDeliverySlot } = require('../../../lib/delivery');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const db = admin.db, col = db.collection('refund_requests');
    if (req.method === 'GET') {
      const rows = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();
      return sendJson(res, 200, { refunds: rows.map(r => ({ ...r, _id: undefined, id: r._id.toString(), userId: r.userId?.toString(), orderId: r.orderId?.toString() })) });
    }
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'PATCH']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    if (!ObjectId.isValid(String(body.id || '')) || !['approve', 'reject'].includes(body.action)) return sendJson(res, 400, { error: 'Invalid refund action.' });
    const request = await col.findOne({ _id: new ObjectId(body.id) });
    if (!request) return sendJson(res, 404, { error: 'Refund request not found.' });
    if (request.status !== 'requested') return sendJson(res, 409, { error: `This refund is already ${request.status}.` });
    const order = await db.collection('orders').findOne({ _id: request.orderId });
    if (!order || order.paymentMethod !== 'Razorpay' || !order.razorpayPaymentId) return sendJson(res, 409, { error: 'The captured Razorpay payment reference is missing.' });
    if (body.action === 'reject') {
      await col.updateOne({ _id: request._id, status: 'requested' }, { $set: { status: 'rejected', adminNote: String(body.note || '').slice(0, 250), reviewedBy: admin.user._id, updatedAt: new Date() } });
      await db.collection('notifications').insertOne({ userId: request.userId, orderId: order._id, type: 'refund', message: `Your refund request for ${order.orderNumber} was not approved. Contact support for details.`, createdAt: new Date(), read: false });
      return sendJson(res, 200, { ok: true, status: 'rejected' });
    }
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return sendJson(res, 503, { error: 'Razorpay API keys are not configured.' });
    const locked = await col.updateOne({ _id: request._id, status: 'requested' }, { $set: { status: 'processing', paymentId: order.razorpayPaymentId, reviewedBy: admin.user._id, updatedAt: new Date() } });
    if (!locked.modifiedCount) return sendJson(res, 409, { error: 'Refund request is already being processed.' });
    await db.collection('orders').updateOne({ _id: order._id, refundStatus: { $nin: ['processed', 'pending'] } }, { $set: { refundStatus: 'processing', paymentStatus: 'refund_pending', refundInitiationState: 'processing', updatedAt: new Date() } });
    let response, data;
    try {
      response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(Number(request.amount) * 100), notes: { freshcartOrderId: order._id.toString(), freshcartRefundRequestId: request._id.toString() } }) });
      data = await response.json();
    } catch (error) {
      await col.updateOne({ _id: request._id }, { $set: { status: 'failed', paymentId: order.razorpayPaymentId, providerError: String(error.message || 'Razorpay request failed').slice(0, 300), updatedAt: new Date() } });
      await db.collection('orders').updateOne({ _id: order._id, refundStatus: 'processing' }, { $set: { refundStatus: 'failed', refundInitiationState: 'failed', paymentStatus: 'paid', updatedAt: new Date() } });
      return sendJson(res, 502, { error: 'Razorpay could not be reached. Retry the refund after checking the gateway.' });
    }
    if (!response.ok || !data?.id || data.status === 'failed') {
      await col.updateOne({ _id: request._id }, { $set: { status: 'failed', paymentId: order.razorpayPaymentId, providerError: String(data?.error?.description || 'Razorpay refund failed').slice(0, 300), updatedAt: new Date() } });
      await db.collection('orders').updateOne({ _id: order._id, refundStatus: 'processing' }, { $set: { refundStatus: 'failed', refundInitiationState: 'failed', paymentStatus: 'paid', updatedAt: new Date() } });
      return sendJson(res, 502, { error: data?.error?.description || 'Razorpay refund request failed.' });
    }
    const providerStatus = String(data.status || 'pending');
    const mapped = providerStatus === 'processed' ? 'processed' : 'pending';
    await col.updateOne({ _id: request._id, status: 'processing' }, { $set: { status: mapped, refundId: data.id, paymentId: order.razorpayPaymentId, providerStatus, providerCreatedAt: data.created_at ? new Date(data.created_at * 1000) : new Date(), updatedAt: new Date() } });
    const latestRequest = await col.findOne({ _id: request._id });
    const finalStatus = latestRequest?.status || mapped; // Do not overwrite a faster refund webhook result.
    const now = new Date();
    await db.collection('orders').updateOne({ _id: order._id, refundStatus: { $in: ['processing', 'pending', 'processed', null] } }, { $set: { refundStatus: finalStatus, razorpayRefundId: data.id, paymentStatus: finalStatus === 'processed' ? 'refunded' : finalStatus === 'failed' ? 'refund_failed' : 'refund_pending', status: 'cancelled', refundInitiationState: finalStatus, updatedAt: now }, $push: { statusHistory: { status: 'cancelled', at: now, note: `Order cancelled; Razorpay refund ${data.id}: ${finalStatus}` } } });
    await restoreOrderInventory(db, order); await restorePoints(db, order); await releaseCoupon(db, order); await releaseDeliverySlot(db, order);
    await db.collection('notifications').insertOne({ userId: request.userId, orderId: order._id, type: 'refund', message: `Refund for ${order.orderNumber} is ${mapped}.`, createdAt: new Date(), read: false });
    return sendJson(res, 200, { ok: true, status: finalStatus, refundId: data.id, message: finalStatus === 'processed' ? 'Refund processed.' : 'Refund submitted to Razorpay. Final status will be updated by webhook.' });
  } catch (error) { return errorResponse(res, error); }
};
