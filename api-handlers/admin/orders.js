const { ObjectId } = require('mongodb');
const { restoreOrderInventory, restorePoints, releaseCoupon } = require('../../lib/order-utils');
const { releaseDeliverySlot } = require('../../lib/delivery');
const { notifyUser } = require('../../lib/push');
const { requireAdmin } = require('../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');

const allowed = new Set(['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']);
const transitions = { placed: ['confirmed','cancelled'], confirmed: ['preparing','cancelled'], preparing: ['shipped','cancelled'], shipped: ['delivered','cancelled'], delivered: [], cancelled: [], payment_pending: ['cancelled'], payment_failed: ['cancelled'] };

async function initiateFullRefund(db, order, adminUserId) {
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !order.razorpayPaymentId) throw Object.assign(new Error('Razorpay refund keys or captured payment reference are missing.'), { status: 503 });
  const orders = db.collection('orders');
  const lock = await orders.updateOne({ _id: order._id, status: order.status, paymentStatus: 'paid', refundInitiationState: { $nin: ['processing', 'submitted', 'processed'] } }, { $set: { refundInitiationState: 'processing', refundStatus: 'processing', paymentStatus: 'refund_pending', refundInitiatedAt: new Date() } });
  if (!lock.modifiedCount) throw Object.assign(new Error('A refund is already being processed for this order. Refresh the order list.'), { status: 409 });

  const refunds = db.collection('refund_requests');
  let request = await refunds.findOne({ orderId: order._id, status: { $in: ['requested', 'failed'] } });
  if (request) {
    await refunds.updateOne({ _id: request._id, status: { $in: ['requested', 'failed'] } }, { $set: { status: 'processing', paymentId: order.razorpayPaymentId, amount: Number(order.total), reason: request.reason || 'Order cancelled by store admin', reviewedBy: adminUserId, updatedAt: new Date() }, $unset: { providerError: '' } });
  } else {
    const result = await refunds.insertOne({ orderId: order._id, userId: order.userId, orderNumber: order.orderNumber, paymentId: order.razorpayPaymentId, amount: Number(order.total), reason: 'Order cancelled by store admin', status: 'processing', reviewedBy: adminUserId, createdAt: new Date(), updatedAt: new Date() });
    request = { _id: result.insertedId };
  }

  let response, data;
  try {
    response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(Number(order.total) * 100), notes: { freshcartOrderId: order._id.toString(), freshcartRefundRequestId: request._id.toString() } })
    });
    data = await response.json();
  } catch (error) {
    await refunds.updateOne({ _id: request._id }, { $set: { status: 'failed', providerError: String(error.message || 'Razorpay request failed').slice(0, 300), updatedAt: new Date() } });
    await orders.updateOne({ _id: order._id }, { $set: { refundInitiationState: 'failed', refundStatus: 'failed', paymentStatus: 'paid' } });
    throw Object.assign(new Error('Razorpay could not be reached. The order was not cancelled; retry after checking the payment gateway.'), { status: 502 });
  }
  if (!response.ok || !data?.id || data.status === 'failed') {
    const message = data?.error?.description || 'Razorpay refund request failed.';
    await refunds.updateOne({ _id: request._id }, { $set: { status: 'failed', providerError: String(message).slice(0, 300), updatedAt: new Date() } });
    await orders.updateOne({ _id: order._id }, { $set: { refundInitiationState: 'failed', refundStatus: 'failed', paymentStatus: 'paid' } });
    throw Object.assign(new Error(message), { status: 502 });
  }
  const providerStatus = String(data.status || 'pending');
  const mapped = providerStatus === 'processed' ? 'processed' : 'pending';
  const now = new Date();
  await refunds.updateOne({ _id: request._id, status: 'processing' }, { $set: { status: mapped, refundId: data.id, paymentId: order.razorpayPaymentId, providerStatus, providerCreatedAt: data.created_at ? new Date(data.created_at * 1000) : now, updatedAt: now } });
  const latestRequest = await refunds.findOne({ _id: request._id });
  const finalStatus = latestRequest?.status || mapped;
  await orders.updateOne({ _id: order._id, refundStatus: { $in: ['processing', 'pending', 'processed', null] } }, { $set: { status: 'cancelled', paymentStatus: finalStatus === 'processed' ? 'refunded' : finalStatus === 'failed' ? 'refund_failed' : 'refund_pending', refundStatus: finalStatus, razorpayRefundId: data.id, refundInitiationState: finalStatus, updatedAt: now }, $push: { statusHistory: { status: 'cancelled', at: now, note: `Order cancelled; Razorpay refund ${data.id} is ${finalStatus}.` } } });
  // Once Razorpay accepts the refund request, the cancelled order must not remain in fulfilment.
  await restoreOrderInventory(db, order);
  await restorePoints(db, order);
  await releaseCoupon(db, order);
  await releaseDeliverySlot(db, order);
  await db.collection('notifications').insertOne({ userId: order.userId, orderId: order._id, type: 'refund', message: `Order ${order.orderNumber} was cancelled. Refund status: ${finalStatus}.`, createdAt: now, read: false });
  await notifyUser(db, order.userId, { title: 'FreshCart refund update', body: `Order ${order.orderNumber} was cancelled. Refund status: ${finalStatus}.`, url: '/#customerHub', tag: `refund-${order._id}` }).catch(() => {});
  return { status: 'cancelled', refundStatus: finalStatus, refundId: data.id };
}

module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const { db } = admin;
    if (req.method === 'GET') {
      const rows = await db.collection('orders').find({}).sort({ createdAt: -1 }).limit(200).toArray();
      return sendJson(res, 200, { orders: rows.map(o => ({ ...o, _id: undefined, id: o._id.toString(), userId: o.userId?.toString() })) });
    }
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'PATCH']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    if (!ObjectId.isValid(String(body.id || '')) || !allowed.has(body.status)) return sendJson(res, 400, { error: 'Invalid order or status.' });
    const orders = db.collection('orders');
    const order = await orders.findOne({ _id: new ObjectId(body.id) });
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });
    if (!transitions[order.status]?.includes(body.status)) return sendJson(res, 409, { error: `Cannot change order from ${order.status} to ${body.status}.` });
    if (['confirmed','preparing','shipped','delivered'].includes(body.status) && order.paymentMethod === 'Razorpay' && order.paymentStatus !== 'paid') return sendJson(res, 409, { error: 'Payment must be verified before fulfilment.' });

    if (body.status === 'cancelled' && order.paymentMethod === 'Razorpay' && order.paymentStatus === 'paid') {
      const existing = await db.collection('refund_requests').findOne({ orderId: order._id, status: { $in: ['processing', 'pending', 'processed'] } });
      if (existing) return sendJson(res, 409, { error: `A refund is already ${existing.status}. Do not submit another refund.`, refundStatus: existing.status });
      const result = await initiateFullRefund(db, order, admin.user._id);
      return sendJson(res, 200, { ok: true, ...result, message: result.refundStatus === 'processed' ? 'Order cancelled and refund processed.' : 'Order cancelled. Refund is pending with Razorpay; webhook will confirm the final status.' });
    }

    const now = new Date();
    const result = await orders.updateOne({ _id: order._id, status: order.status }, { $set: { status: body.status, ...(body.status === 'delivered' && order.paymentMethod === 'COD' ? { paymentStatus: 'paid' } : {}), ...(order.refundStatus === 'processed' ? { paymentStatus: 'refunded' } : {}), updatedAt: now }, $push: { statusHistory: { status: body.status, at: now, note: String(body.note || `Status changed to ${body.status}`).slice(0,160) } } });
    if (!result.modifiedCount) return sendJson(res, 409, { error: 'This order cannot be updated from its current state.' });
    if (body.status === 'cancelled' && !order.inventoryRestored) {
      await restoreOrderInventory(db, order);
      await restorePoints(db, order);
      await releaseCoupon(db, order);
      await releaseDeliverySlot(db, order);
    }
    if (body.status === 'delivered') {
      const fresh = await orders.findOne({ _id: order._id });
      if (fresh && !fresh.loyaltyCredited) {
        const earned = Math.floor(Number(fresh.subtotal || 0) / 100);
        const credited = await orders.updateOne({ _id: order._id, loyaltyCredited: { $ne: true } }, { $set: { loyaltyCredited: true, loyaltyPointsEarned: earned } });
        if (credited.modifiedCount && earned > 0) {
          await db.collection('users').updateOne({ _id: fresh.userId }, { $inc: { loyaltyPoints: earned } });
          await db.collection('loyalty_ledger').insertOne({ userId: fresh.userId, orderId: fresh._id, points: earned, type: 'earned', note: `Points for order ${fresh.orderNumber}`, createdAt: now });
        }
      }
      // Referral credit is one-time and only after the referred customer's first delivered order.
      const referral = await db.collection('referrals').findOneAndUpdate({ referredUserId: order.userId, status: 'pending' }, { $set: { status: 'completed', completedOrderId: order._id, completedAt: now, updatedAt: now } }, { returnDocument: 'after' });
      const referralRow = referral?.value || referral;
      if (referralRow) {
        const rewardPoints = 100;
        await db.collection('users').updateOne({ _id: referralRow.referrerId }, { $inc: { loyaltyPoints: rewardPoints } });
        await db.collection('users').updateOne({ _id: referralRow.referredUserId }, { $inc: { loyaltyPoints: rewardPoints } });
        await db.collection('loyalty_ledger').insertMany([
          { userId: referralRow.referrerId, orderId: order._id, points: rewardPoints, type: 'referral', note: `Referral reward for ${order.orderNumber}`, createdAt: now },
          { userId: referralRow.referredUserId, orderId: order._id, points: rewardPoints, type: 'referral', note: `Welcome referral reward for ${order.orderNumber}`, createdAt: now }
        ]);
        await db.collection('notifications').insertMany([
          { userId: referralRow.referrerId, type: 'referral', message: 'You earned 100 FreshPerks referral points.', createdAt: now, read: false },
          { userId: referralRow.referredUserId, type: 'referral', message: 'You earned 100 FreshPerks welcome points.', createdAt: now, read: false }
        ]);
      }
    }
    await db.collection('notifications').insertOne({ userId: order.userId, orderId: order._id, type: 'order_status', message: `Your order ${order.orderNumber} is now ${body.status}.`, createdAt: now, read: false });
    await notifyUser(db, order.userId, { title: 'FreshCart order update', body: `Your order ${order.orderNumber} is now ${body.status}.`, url: '/#customerHub', tag: `order-${order._id}` }).catch(() => {});
    return sendJson(res, 200, { ok: true, status: body.status });
  } catch (error) { return errorResponse(res, error); }
};
