const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
const { calculateOrder, validateAddress, newOrderNumber, ObjectId, reserveStock, redeemPoints, restoreStock, reserveCoupon, releaseCoupon, restoreOrderInventory } = require('../../lib/order-utils');
const { serviceability, reserveDeliverySlot } = require('../../lib/delivery');

module.exports = async function handler(req,res) {
  if (req.method !== 'POST') return methodNotAllowed(res,['POST']);
  if (!assertSameOrigin(req,res)) return;
  try {
    const session = requireUser(req);
    if (!session) return sendJson(res,401,{error:'Please sign in before payment.'});
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    const paymentMode = String(process.env.RAZORPAY_MODE || 'test').toLowerCase() === 'live' ? 'live' : 'test';
    const keyMatchesMode = paymentMode === 'test' ? String(keyId || '').startsWith('rzp_test_') : String(keyId || '').startsWith('rzp_live_');
    if (!keyId || !keySecret || !keyMatchesMode) return sendJson(res,503,{error:paymentMode === 'test' ? 'Razorpay Test Mode keys are not configured. Add rzp_test_ Key ID and Test Key Secret in Vercel.' : 'Razorpay Live Mode keys are not configured correctly.'});
    const body = await readBody(req);
    const address = validateAddress(body);
    const db = await getDb();
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
    const order = { ...(deliverySlot ? { deliverySlot } : {}), orderNumber:newOrderNumber(), userId:new ObjectId(session.sub), email:session.email, ...address, ...price, stockReservations:reservations,
      paymentMethod:'Razorpay', paymentStatus:'created', status:'payment_pending', razorpayOrderId:null,
      statusHistory:[{status:'payment_pending',at:now,note:'Awaiting online payment'}], loyaltyPointsEarned:0,loyaltyCredited:false,createdAt:now,updatedAt:now };
    let inserted;
    try { inserted = await db.collection('orders').insertOne(order); if (price.pointsRedeemed) { await redeemPoints(db, session.sub, price.pointsRedeemed, inserted.insertedId, order.orderNumber); await db.collection('orders').updateOne({ _id: inserted.insertedId }, { $set: { pointsRedeemedApplied: true } }); }
      const response = await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(`${keyId}:${keySecret}`).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify({amount:price.total*100,currency:'INR',receipt:order.orderNumber,notes:{freshcartOrderId:inserted.insertedId.toString(),customerEmail:session.email}})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.description || 'Razorpay could not create the payment order.');
      await db.collection('orders').updateOne({_id:inserted.insertedId},{$set:{razorpayOrderId:data.id,updatedAt:new Date()}});
      return sendJson(res,201,{orderId:inserted.insertedId.toString(),orderNumber:order.orderNumber,amount:data.amount,currency:data.currency,razorpayOrderId:data.id,keyId});
    } catch(error) {
      if (inserted?.insertedId) await db.collection('orders').updateOne({_id:inserted.insertedId},{$set:{paymentStatus:'failed',status:'payment_failed',updatedAt:new Date()},$push:{statusHistory:{status:'payment_failed',at:new Date(),note:'Payment order setup failed'}}});
      await restoreStock(db, reservations.map(x => ({ productId: x.id, quantity: x.quantity })));
      if (deliverySlot) await db.collection('delivery_slots').updateOne({ _id: deliverySlot.slotId, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
      if (couponReserved) await releaseCoupon(db,price);
      if (inserted?.insertedId) { const failedOrder = await db.collection('orders').findOne({_id:inserted.insertedId}); if (failedOrder) { const { restorePoints: giveBack } = require('../../lib/order-utils'); await giveBack(db, failedOrder); } }
      else { if (price.pointsRedeemedApplied) { /* points are applied only after an order record exists */ } }
      throw error;
    }
  } catch(error) { return errorResponse(res,error); }
};
