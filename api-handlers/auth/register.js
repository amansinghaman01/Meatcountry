const bcrypt = require('bcryptjs');
const { getDb } = require('../../lib/db');
const { setSession } = require('../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!assertSameOrigin(req, res)) return;
  try {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Enter your name (2–80 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendJson(res, 400, { error: 'Enter a valid email address.' });
    if (password.length < 10 || password.length > 128) return sendJson(res, 400, { error: 'Password must be 10–128 characters.' });
    const db = await getDb();
    const referralCode = String(body.referralCode || '').trim().toUpperCase();
    let referrer = null;
    if (referralCode) { referrer = await db.collection('users').findOne({ referralCode }, { projection: { _id: 1 } }); if (!referrer) return sendJson(res, 400, { error: 'Referral code is invalid.' }); }
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({ name, email, passwordHash, role: 'customer', ...(referrer ? { referredBy: referrer._id } : {}), createdAt: new Date(), updatedAt: new Date() });
    const user = { _id: result.insertedId, name, email };
    if (referrer) await db.collection('referrals').insertOne({ referrerId: referrer._id, referredUserId: result.insertedId, referralCode, status: 'pending', createdAt: new Date(), updatedAt: new Date() });
    setSession(res, user);
    return sendJson(res, 201, { user: { name, email, role: 'customer' } });
  } catch (error) {
    if (error.code === 11000) return sendJson(res, 409, { error: 'An account with this email already exists.' });
    return errorResponse(res, error);
  }
};
