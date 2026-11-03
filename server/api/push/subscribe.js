const { ObjectId } = require('mongodb');
const { getDb } = require('../../../lib/db');
const { requireUser } = require('../../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req, res) {
  try {
    const session = requireUser(req); if (!session) return sendJson(res, 401, { error: 'Please sign in.' });
    if (req.method !== 'POST' && req.method !== 'DELETE') return methodNotAllowed(res, ['POST', 'DELETE']);
    if (!assertSameOrigin(req, res)) return;
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return sendJson(res, 503, { error: 'Push notifications are not configured yet. Set the VAPID environment variables.' });
    const db = await getDb(), col = db.collection('push_subscriptions'), userId = new ObjectId(session.sub);
    if (req.method === 'DELETE') { await col.deleteMany({ userId }); return sendJson(res, 200, { ok: true }); }
    const body = await readBody(req), s = body.subscription;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !/^https:\/\//i.test(s.endpoint)) return sendJson(res, 400, { error: 'Invalid browser push subscription.' });
    await col.updateOne({ userId, 'subscription.endpoint': s.endpoint }, { $set: { userId, subscription: s, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return sendJson(res, 201, { ok: true });
  } catch (error) { return errorResponse(res, error); }
};
