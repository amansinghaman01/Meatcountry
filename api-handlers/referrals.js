const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  try {
    const session = requireUser(req); if (!session) return sendJson(res, 401, { error: 'Please sign in.' });
    const db = await getDb(), users = db.collection('users'), userId = new ObjectId(session.sub);
    let user = await users.findOne({ _id: userId }, { projection: { referralCode: 1 } });
    if (!user?.referralCode) {
      let code, exists;
      do { code = 'FC' + crypto.randomBytes(4).toString('hex').toUpperCase(); exists = await users.findOne({ referralCode: code }, { projection: { _id: 1 } }); } while (exists);
      await users.updateOne({ _id: userId, referralCode: { $exists: false } }, { $set: { referralCode: code } });
      user = await users.findOne({ _id: userId }, { projection: { referralCode: 1 } });
    }
    const [pending, completed] = await Promise.all([db.collection('referrals').countDocuments({ referrerId: userId, status: 'pending' }), db.collection('referrals').countDocuments({ referrerId: userId, status: 'completed' })]);
    return sendJson(res, 200, { code: user?.referralCode, shareUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/?ref=${encodeURIComponent(user?.referralCode || '')}`, rewardPoints: 100, pending, completed, terms: 'Referral rewards are credited once the invited customer completes and receives their first eligible order. Self-referrals and duplicate accounts are not eligible.' });
  } catch (error) { return errorResponse(res, error); }
};
