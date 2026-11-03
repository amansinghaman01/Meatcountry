const catalog = require('../catalog');
const { ObjectId } = require('mongodb');

async function calculateOrder(db, userId, itemsInput, couponCode, pointsToRedeem = 0, deliveryFeeOverride = null) {
  if (!Array.isArray(itemsInput) || itemsInput.length < 1 || itemsInput.length > 30) {
    const error = new Error('Your cart is empty or too large.'); error.status = 400; throw error;
  }
  const overrides = await db.collection('products').find({}).toArray();
  const byId = new Map(catalog.map((item) => [item.id, item]));
  for (const override of overrides) {
    if (override.active === false) byId.delete(override.id);
    else byId.set(override.id, { ...(byId.get(override.id) || {}), ...override });
  }
  const items = [];
  let subtotal = 0;
  for (const line of itemsInput) {
    const product = byId.get(String(line.productId || ''));
    const quantity = Number(line.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      const error = new Error('One of the cart items is invalid or unavailable. Refresh and try again.'); error.status = 400; throw error;
    }
    subtotal += product.price * quantity;
    items.push({ productId: product.id, name: product.name, category: product.category, weight: product.weight, quantity, unitPrice: product.price, unitCost: Math.max(0, Number(product.costPrice || 0)), lineTotal: product.price * quantity });
  }
  const deliveryFee = deliveryFeeOverride === null ? (subtotal >= 799 ? 0 : 35) : Math.max(0, Number(deliveryFeeOverride || 0));
  let couponDiscount = 0, couponId = null;
  if (couponCode) {
    const code = String(couponCode).trim().toUpperCase();
    if (code === 'FRESH10') {
      const completedOrAcceptedOrders = await db.collection('orders').countDocuments({ userId: new ObjectId(String(userId)), $or: [{ paymentMethod: 'Razorpay', paymentStatus: 'paid' }, { paymentMethod: 'COD', status: { $nin: ['cancelled', 'payment_failed'] } }] });
      if (completedOrAcceptedOrders > 0) throw Object.assign(new Error('FRESH10 is available only on your first eligible order.'), { status: 400 });
      couponDiscount = Math.min(150, Math.round(subtotal * .1));
    } else {
      const coupon = await db.collection('coupons').findOne({ code });
      if (!coupon || coupon.active !== true) throw Object.assign(new Error('This coupon is not active.'), { status: 400 });
      if (subtotal < Number(coupon.minOrder || 0)) throw Object.assign(new Error(`Minimum order value is ₹${coupon.minOrder}.`), { status: 400 });
      if (coupon.maxUses && Number(coupon.usedCount || 0) >= coupon.maxUses) throw Object.assign(new Error('This coupon has reached its usage limit.'), { status: 400 });
      couponDiscount = coupon.type === 'flat' ? Number(coupon.discountValue) : Math.round(subtotal * Number(coupon.discountValue) / 100);
      if (coupon.maxDiscount) couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscount));
      couponDiscount = Math.min(couponDiscount, subtotal); couponId = coupon._id;
    }
  }
  const requestedPoints = Number(pointsToRedeem || 0);
  if (!Number.isInteger(requestedPoints) || requestedPoints < 0 || requestedPoints % 100 !== 0) {
    const error = new Error('Reward redemption must be in multiples of 100 points.'); error.status = 400; throw error;
  }
  const user = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) }, { projection: { loyaltyPoints: 1 } });
  const maxByBill = Math.floor(Math.max(0, subtotal + deliveryFee - couponDiscount) / 20) * 100;
  const pointsRedeemed = Math.min(requestedPoints, user?.loyaltyPoints || 0, maxByBill);
  const loyaltyDiscount = Math.floor(pointsRedeemed / 100) * 20;
  const discount = Math.min(subtotal + deliveryFee, couponDiscount + loyaltyDiscount);
  return { items, subtotal, deliveryFee, discount, couponDiscount, couponId, couponCode: couponCode ? String(couponCode).toUpperCase() : null, pointsRedeemed, loyaltyDiscount, total: Math.max(0, subtotal + deliveryFee - discount), currency: 'INR' };
}

async function redeemPoints(db, userId, points, orderId, orderNumber) {
  if (!points) return;
  const result = await db.collection('users').updateOne({ _id: new ObjectId(String(userId)), loyaltyPoints: { $gte: points } }, { $inc: { loyaltyPoints: -points } });
  if (!result.modifiedCount) throw Object.assign(new Error('Your available reward points changed. Refresh your account and try again.'), { status: 409 });
  await db.collection('loyalty_ledger').insertOne({ userId: new ObjectId(String(userId)), orderId, points: -points, type: 'redeemed', note: `Reward used on order ${orderNumber}`, createdAt: new Date() });
}

async function restorePoints(db, order) {
  if (!order?.pointsRedeemed || !order.pointsRedeemedApplied || order.pointsRestored) return;
  const changed = await db.collection('orders').updateOne({ _id: order._id, pointsRestored: { $ne: true } }, { $set: { pointsRestored: true } });
  if (!changed.modifiedCount) return;
  await db.collection('users').updateOne({ _id: order.userId }, { $inc: { loyaltyPoints: order.pointsRedeemed } });
  await db.collection('loyalty_ledger').insertOne({ userId: order.userId, orderId: order._id, points: order.pointsRedeemed, type: 'refund', note: `Reward points returned for cancelled order ${order.orderNumber}`, createdAt: new Date() });
}

async function reserveCoupon(db, price) {
  if (!price.couponId) return false;
  const filter={_id:price.couponId,active:true};
  const coupon=await db.collection('coupons').findOne({_id:price.couponId});
  if (coupon?.maxUses) filter.usedCount={$lt:coupon.maxUses};
  const result=await db.collection('coupons').updateOne(filter,{$inc:{usedCount:1},$set:{updatedAt:new Date()}});
  if(!result.modifiedCount) throw Object.assign(new Error('This coupon just reached its usage limit. Please try another coupon.'),{status:409});
  return true;
}
async function releaseCoupon(db, orderOrPrice) {
  if(!orderOrPrice?.couponId) return;
  if(orderOrPrice._id) {
    const marked=await db.collection('orders').updateOne({_id:orderOrPrice._id,couponReleased:{$ne:true}},{$set:{couponReleased:true}});
    if(!marked.modifiedCount) return;
  }
  await db.collection('coupons').updateOne({_id:orderOrPrice.couponId,usedCount:{$gt:0}},{$inc:{usedCount:-1}});
}


function validateAddress(body) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  const pincode = String(body.pincode || '').trim();
  if (name.length < 2 || name.length > 80) throw Object.assign(new Error('Enter a valid delivery name.'), { status: 400 });
  if (!/^[6-9]\d{9}$/.test(phone)) throw Object.assign(new Error('Enter a valid 10-digit Indian mobile number.'), { status: 400 });
  if (address.length < 8 || address.length > 300) throw Object.assign(new Error('Enter a complete delivery address.'), { status: 400 });
  if (!/^\d{6}$/.test(pincode)) throw Object.assign(new Error('Enter a valid 6-digit PIN code.'), { status: 400 });
  return { customerName: name, phone, address, pincode };
}

function newOrderNumber() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tail = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FC${day}${tail}`;
}


async function reserveStock(db, items) {
  const products = db.collection('products');
  const reserved = [];
  try {
    for (const item of items) {
      const product = await products.findOne({ id: item.productId, stock: { $exists: true } });
      if (!product || product.active === false) throw Object.assign(new Error(`${item.name} is not available in managed inventory. Ask the store admin to initialize catalogue stock.`), { status: 409 });
      const updated = await products.updateOne({ _id: product._id, active: { $ne: false }, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity }, $set: { updatedAt: new Date() } });
      if (!updated.modifiedCount) throw Object.assign(new Error(`${item.name} is out of stock or has insufficient quantity.`), { status: 409 });
      reserved.push({ id: item.productId, quantity: item.quantity });
    }
    return reserved;
  } catch (error) {
    for (const item of reserved) await products.updateOne({ id: item.id }, { $inc: { stock: item.quantity } });
    throw error;
  }
}
async function restoreStock(db, items) {
  for (const item of items || []) await db.collection('products').updateOne({ id: item.productId }, { $inc: { stock: item.quantity } });
}
async function restoreOrderInventory(db, order) {
  if(!order?._id || order.inventoryRestored) return;
  const marked=await db.collection('orders').updateOne({_id:order._id,inventoryRestored:{$ne:true}},{$set:{inventoryRestored:true}});
  if(!marked.modifiedCount) return;
  try { await restoreStock(db,(order.stockReservations||[]).map(x=>({productId:x.id,quantity:x.quantity}))); }
  catch(error) { await db.collection('orders').updateOne({_id:order._id},{$set:{inventoryRestored:false}}); throw error; }
}

function serializeOrder(order) {
  return { ...order, _id: undefined, id: order._id?.toString(), userId: undefined };
}

module.exports = { calculateOrder, validateAddress, newOrderNumber, serializeOrder, reserveStock, restoreStock, redeemPoints, restorePoints, reserveCoupon, releaseCoupon, restoreOrderInventory, ObjectId };
