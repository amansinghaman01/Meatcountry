const { ObjectId } = require('mongodb');

async function serviceability(db, pincode, date) {
  const zones = db.collection('delivery_zones');
  const zoneCount = await zones.countDocuments({});
  if (!zoneCount) return { configured: false, serviceable: true, notice: 'Delivery coverage is not configured yet; checkout is operating in legacy demo mode.', slots: [] };
  const zone = await zones.findOne({ pincode: String(pincode), active: true });
  if (!zone) return { configured: true, serviceable: false, notice: 'Sorry, delivery is not available at this PIN code.', slots: [] };
  const day = String(date || new Date().toISOString().slice(0, 10));
  const rows = await db.collection('delivery_slots').find({ pincode: String(pincode), date: day, active: true }).sort({ start: 1 }).toArray();
  const slots = rows.filter(s => Number(s.reservedCount || 0) < Number(s.capacity || 0)).map(s => ({ id: s._id.toString(), date: s.date, start: s.start, end: s.end, remaining: Math.max(0, Number(s.capacity || 0) - Number(s.reservedCount || 0)), fee: Number(zone.deliveryFee || 0) }));
  return { configured: true, serviceable: true, zone: { pincode: zone.pincode, deliveryFee: Number(zone.deliveryFee || 0), minOrder: Number(zone.minOrder || 0), zoneName: zone.name || '' }, slots, notice: slots.length ? 'Delivery available. Choose a slot.' : 'Delivery available, but no slots are open for this date.' };
}

async function reserveDeliverySlot(db, pincode, slotId) {
  const zoneCount = await db.collection('delivery_zones').countDocuments({});
  if (!zoneCount) return null;
  const zone = await db.collection('delivery_zones').findOne({ pincode: String(pincode), active: true });
  if (!zone) throw Object.assign(new Error('Delivery is not available at this PIN code.'), { status: 400 });
  if (!ObjectId.isValid(String(slotId || ''))) throw Object.assign(new Error('Choose an available delivery slot.'), { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const slot = await db.collection('delivery_slots').findOneAndUpdate(
    { _id: new ObjectId(slotId), pincode: String(pincode), date: { $gte: today }, active: true, $expr: { $lt: [{ $ifNull: ['$reservedCount', 0] }, '$capacity'] } },
    { $inc: { reservedCount: 1 }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' }
  );
  const value = slot?.value || slot;
  if (!value) throw Object.assign(new Error('That delivery slot is full or no longer available. Please choose another.'), { status: 409 });
  return { slotId: value._id, pincode: value.pincode, date: value.date, start: value.start, end: value.end, fee: Number(zone.deliveryFee || 0) };
}

async function releaseDeliverySlot(db, order) {
  if (!order?.deliverySlot?.slotId || order.deliverySlotReleased) return;
  const marked = await db.collection('orders').updateOne({ _id: order._id, deliverySlotReleased: { $ne: true } }, { $set: { deliverySlotReleased: true } });
  if (!marked.modifiedCount) return;
  const slotId = order.deliverySlot.slotId;
  await db.collection('delivery_slots').updateOne({ _id: slotId, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 }, $set: { updatedAt: new Date() } });
}

module.exports = { serviceability, reserveDeliverySlot, releaseDeliverySlot };
