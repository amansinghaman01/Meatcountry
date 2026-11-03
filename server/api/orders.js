const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
const { calculateOrder, validateAddress, newOrderNumber, ObjectId, serializeOrder, reserveStock, redeemPoints, restoreStock, reserveCoupon, releaseCoupon } = require('../../lib/order-utils');
const { serviceability, reserveDeliverySlot, releaseDeliverySlot } = require('../../lib/delivery');

module.exports = async function handler(req, res) {
  try {
    const session = requireUser(req);
    if (!session) return sendJson(res, 401, { error: 'Please sign in to access your orders.' });
    const db = await getDb();
    const orders = db.collection('orders');
    if (req.method === 'GET') {
      const rows = await orders.find({ userId: new ObjectId(session.sub) }).sort({ createdAt: -1 }).limit(50).toArray();
      return sendJson(res, 200, { orders: rows.map(serializeOrder) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    const address = validateAddress(body);
    const deliveryCheck = await serviceability(db, address.pincode);
    if (deliveryCheck.configured && !deliveryCheck.serviceable) throw Object.assign(new Error(deliveryCheck.notice), { status: 400 });
    const price = await calculateOrder(db, session.sub, body.items, body.coupon, body.pointsToRedeem, deliveryCheck.configured ? Number(deliveryCheck.zone?.deliveryFee || 0) : null);
    if (deliveryCheck.configured && price.subtotal < Number(deliveryCheck.zone?.minOrder || 0)) throw Object.assign(new Error(`Minimum order for this delivery area is ₹${deliveryCheck.zone.minOrder}.`), { status: 400 });
    const now = new Date();
    const couponReserved = await reserveCoupon(db, price);
    let reservations;
    try { reservations = await reserveStock(db, price.items); } catch (error) { if (couponReserved) await releaseCoupon(db, price); throw error; }
    let deliverySlot;
    try { deliverySlot = await reserveDeliverySlot(db, address.pincode, body.deliverySlotId); } catch (error) { await restoreStock(db, reservations.map(x => ({ productId: x.id, quantity: x.quantity }))); if (couponReserved) await releaseCoupon(db, price); throw error; }
    const order = {
      ...(deliverySlot ? { deliverySlot } : {}), orderNumber: newOrderNumber(), userId: new ObjectId(session.sub), email: session.email,
      ...address, ...price, stockReservations: reservations, paymentMethod: 'COD', paymentStatus: 'pending', status: 'placed',
      statusHistory: [{ status: 'placed', at: now, note: 'Order received' }], loyaltyPointsEarned: 0,
      loyaltyCredited: false, createdAt: now, updatedAt: now
    };
    let result;
    try { result = await orders.insertOne(order); if (price.pointsRedeemed) { await redeemPoints(db, session.sub, price.pointsRedeemed, result.insertedId, order.orderNumber); await orders.updateOne({ _id: result.insertedId }, { $set: { pointsRedeemedApplied: true } }); } }
    catch (error) { await restoreStock(db, reservations.map(x => ({ productId: x.id, quantity: x.quantity }))); if (couponReserved) await releaseCoupon(db,price); if (result?.insertedId) await orders.deleteOne({ _id: result.insertedId }); if (deliverySlot) await db.collection('delivery_slots').updateOne({ _id: deliverySlot.slotId, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } }); throw error; }
    await Promise.allSettled([
      db.collection('notifications').insertOne({ userId: new ObjectId(session.sub), orderId: result.insertedId, type: 'order_status', message: `Your order ${order.orderNumber} has been placed.`, createdAt: new Date(), read: false }),
      db.collection('users').updateOne({ _id: new ObjectId(session.sub) }, { $addToSet: { addresses: { label: 'Recent delivery', address: address.address, pincode: address.pincode, phone: address.phone } } })
    ]);
    return sendJson(res, 201, { orderId: result.insertedId.toString(), orderNumber: order.orderNumber, total: order.total, status: order.status, paymentMethod: 'COD' });
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message });
    return errorResponse(res, error);
  }
};
