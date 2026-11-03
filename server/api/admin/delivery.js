const { ObjectId } = require('mongodb');
const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const db = admin.db;
    if (req.method === 'GET') {
      const [zones, slots] = await Promise.all([db.collection('delivery_zones').find({}).sort({ pincode: 1 }).toArray(), db.collection('delivery_slots').find({}).sort({ date: 1, start: 1 }).limit(300).toArray()]);
      return sendJson(res, 200, { zones: zones.map(z => ({ ...z, _id: undefined, id: z._id.toString() })), slots: slots.map(s => ({ ...s, _id: undefined, id: s._id.toString() })) });
    }
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    if (req.method === 'POST' && body.type === 'zone') {
      const pincode = String(body.pincode || '').trim(), name = String(body.name || '').trim();
      const deliveryFee = Number(body.deliveryFee || 0), minOrder = Number(body.minOrder || 0);
      if (!/^\d{6}$/.test(pincode) || deliveryFee < 0 || deliveryFee > 1000 || minOrder < 0 || minOrder > 100000) return sendJson(res, 400, { error: 'Enter a valid PIN code, delivery fee and minimum order.' });
      await db.collection('delivery_zones').updateOne({ pincode }, { $set: { pincode, name: name.slice(0, 80), deliveryFee, minOrder, active: body.active !== false, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      return sendJson(res, 200, { ok: true, pincode });
    }
    if (req.method === 'POST' && body.type === 'slot') {
      const pincode = String(body.pincode || '').trim(), date = String(body.date || ''), start = String(body.start || ''), end = String(body.end || ''), capacity = Number(body.capacity);
      const time = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
      if (!/^\d{6}$/.test(pincode) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10) || !time(start) || !time(end) || start >= end || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) return sendJson(res, 400, { error: 'Enter valid PIN code, future date, time range and capacity.' });
      if (!(await db.collection('delivery_zones').findOne({ pincode, active: true }))) return sendJson(res, 400, { error: 'Create an active delivery zone for this PIN code first.' });
      const existing = await db.collection('delivery_slots').findOne({ pincode, date, start, end });
      if (existing) return sendJson(res, 409, { error: 'This delivery slot already exists.' });
      const result = await db.collection('delivery_slots').insertOne({ pincode, date, start, end, capacity, reservedCount: 0, active: true, createdAt: new Date(), updatedAt: new Date() });
      return sendJson(res, 201, { ok: true, id: result.insertedId.toString() });
    }
    if (req.method === 'PATCH' && body.type === 'slot') {
      if (!ObjectId.isValid(String(body.id || '')) || typeof body.active !== 'boolean') return sendJson(res, 400, { error: 'Provide a valid slot ID and active state.' });
      const slot = await db.collection('delivery_slots').findOne({ _id: new ObjectId(body.id) });
      if (!slot) return sendJson(res, 404, { error: 'Delivery slot not found.' });
      await db.collection('delivery_slots').updateOne({ _id: slot._id }, { $set: { active: body.active, updatedAt: new Date() } });
      return sendJson(res, 200, { ok: true, active: body.active, reservedCount: Number(slot.reservedCount || 0) });
    }
    if (req.method === 'PATCH' && body.type === 'assign') {
      if (!ObjectId.isValid(String(body.orderId || ''))) return sendJson(res, 400, { error: 'Invalid order ID.' });
      const driverName = String(body.driverName || '').trim(), driverPhone = String(body.driverPhone || '').trim();
      if (driverName.length < 2 || !/^[6-9]\d{9}$/.test(driverPhone)) return sendJson(res, 400, { error: 'Enter a driver name and valid 10-digit mobile number.' });
      const assignment = { driverName: driverName.slice(0, 80), driverPhone, vehicle: String(body.vehicle || '').slice(0, 40), trackingUrl: /^https:\/\//i.test(String(body.trackingUrl || '')) ? String(body.trackingUrl) : '', assignedAt: new Date(), assignedBy: admin.user._id };
      const result = await db.collection('orders').updateOne({ _id: new ObjectId(body.orderId) }, { $set: { deliveryPartner: assignment, updatedAt: new Date() }, $push: { statusHistory: { status: 'driver_assigned', at: new Date(), note: `Delivery partner ${assignment.driverName} assigned` } } });
      return sendJson(res, result.matchedCount ? 200 : 404, { ok: !!result.matchedCount });
    }
    if (req.method === 'DELETE' && body.type === 'slot' && ObjectId.isValid(String(body.id || ''))) {
      const slot = await db.collection('delivery_slots').findOne({ _id: new ObjectId(body.id) });
      if (!slot) return sendJson(res, 404, { error: 'Slot not found.' });
      if (Number(slot.reservedCount || 0) > 0) return sendJson(res, 409, { error: 'A slot with bookings cannot be deleted. Deactivate it instead.' });
      await db.collection('delivery_slots').deleteOne({ _id: slot._id });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'Unsupported delivery management action.' });
  } catch (error) { return errorResponse(res, error); }
};
