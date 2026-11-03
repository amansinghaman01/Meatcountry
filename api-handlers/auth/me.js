const { ObjectId } = require('mongodb');
const { requireUser } = require('../../lib/auth');
const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = requireUser(req);
    if (!session) return sendJson(res, 401, { user: null });
    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.sub) }, { projection: { name: 1, email: 1, role: 1, loyaltyPoints: 1 } });
    if (!user) return sendJson(res, 401, { user: null });
    return sendJson(res, 200, { user: { name: user.name, email: user.email, role: user.role || 'customer', loyaltyPoints: user.loyaltyPoints || 0 } });
  } catch (error) { return errorResponse(res, error); }
};
