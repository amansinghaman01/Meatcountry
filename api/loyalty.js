const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = requireUser(req);
    if (!session) return sendJson(res, 401, { error: 'Please sign in.' });
    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.sub) }, { projection: { loyaltyPoints: 1 } });
    const ledger = await db.collection('loyalty_ledger').find({ userId: new ObjectId(session.sub) }).sort({ createdAt: -1 }).limit(20).toArray();
    return sendJson(res, 200, { points: user?.loyaltyPoints || 0, rewardValueRupees: Math.floor((user?.loyaltyPoints || 0) / 100) * 20, rupeesPerHundredPoints: 20, ledger: ledger.map(x => ({ points: x.points, type: x.type, note: x.note, createdAt: x.createdAt })) });
  } catch (error) { return errorResponse(res, error); }
};
