const { clearSession } = require('../../../lib/auth');
const { sendJson, methodNotAllowed, assertSameOrigin } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!assertSameOrigin(req, res)) return;
  clearSession(res);
  return sendJson(res, 200, { ok: true });
};
