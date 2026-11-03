const { sendJson, methodNotAllowed } = require('../../../lib/http');
module.exports = function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const enabled = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  return sendJson(res, 200, enabled ? { enabled: true, publicKey } : { enabled: false, publicKey: '', error: 'Push service is not configured. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.' });
};
