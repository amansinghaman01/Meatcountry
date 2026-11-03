const { ObjectId } = require('mongodb');
const { requireAdmin } = require('../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const col = admin.db.collection('reviews');
    if (req.method === 'GET') { const rows = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray(); return sendJson(res, 200, { reviews: rows.map(r => ({ ...r, _id: undefined, id: r._id.toString(), userId: r.userId?.toString(), orderId: r.orderId?.toString() })) }); }
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'PATCH']);
    if (!assertSameOrigin(req, res)) return;
    const body = await readBody(req);
    if (!ObjectId.isValid(String(body.id || '')) || !['approved', 'rejected'].includes(body.status)) return sendJson(res, 400, { error: 'Invalid review action.' });
    const row = await col.findOne({ _id: new ObjectId(body.id) }); if (!row) return sendJson(res, 404, { error: 'Review not found.' });
    await col.updateOne({ _id: row._id }, { $set: { status: body.status, moderatedAt: new Date(), moderatedBy: admin.user._id, moderationNote: String(body.note || '').slice(0, 200) } });
    return sendJson(res, 200, { ok: true, status: body.status });
  } catch (error) { return errorResponse(res, error); }
};
