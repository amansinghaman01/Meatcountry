const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return sendJson(res, 200, { ok: true, database: 'connected' });
  } catch (error) {
    if (error.code === 'CONFIG_MISSING') return sendJson(res, 503, { ok: false, database: 'not_configured' });
    return errorResponse(res, error);
  }
};
