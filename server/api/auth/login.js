const bcrypt = require('bcryptjs');
const { getDb } = require('../../../lib/db');
const { setSession } = require('../../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!assertSameOrigin(req, res)) return;
  try {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return sendJson(res, 400, { error: 'Enter your email and password.' });
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    // Use a dummy hash comparison for unknown emails to reduce timing differences.
    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
    if (!user || !valid) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    setSession(res, user);
    return sendJson(res, 200, { user: { name: user.name, email: user.email, role: user.role || 'customer' } });
  } catch (error) {
    return errorResponse(res, error);
  }
};
