const { ObjectId } = require('mongodb');
const { getDb } = require('./db');
const { requireUser } = require('./auth');
const { sendJson } = require('./http');

async function requireAdmin(req, res) {
  const session = requireUser(req);
  if (!session) {
    sendJson(res, 401, { error: 'Please sign in.' });
    return null;
  }
  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.sub), role: 'admin' },
    { projection: { name: 1, email: 1, role: 1 } }
  );
  if (!user) {
    sendJson(res, 403, { error: 'Admin access is required.' });
    return null;
  }
  return { session, user, db };
}

module.exports = { requireAdmin };
