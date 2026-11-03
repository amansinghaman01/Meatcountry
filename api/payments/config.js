const { sendJson, methodNotAllowed } = require('../../lib/http');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const configuredMode = String(process.env.RAZORPAY_MODE || 'test').toLowerCase();
  const mode = configuredMode === 'live' ? 'live' : 'test';
  const keyMatchesMode = mode === 'test'
    ? keyId.startsWith('rzp_test_')
    : keyId.startsWith('rzp_live_');

  return sendJson(res, 200, {
    enabled: Boolean(keyId && process.env.RAZORPAY_KEY_SECRET && keyMatchesMode),
    keyId: keyId || null,
    mode,
    methods: ['upi', 'netbanking', 'card', 'wallet'],
    upiApps: ['google_pay', 'phonepe', 'paytm', 'bhim']
  });
};
