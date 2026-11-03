const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');
const { serviceability } = require('../../lib/delivery');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const pincode = String(req.query?.pincode || '').trim();
    const date = String(req.query?.date || new Date().toISOString().slice(0, 10));
    if (!/^\d{6}$/.test(pincode) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: 'Enter a valid 6-digit PIN code and date (YYYY-MM-DD).' });
    const db = await getDb();
    return sendJson(res, 200, await serviceability(db, pincode, date));
  } catch (error) { return errorResponse(res, error); }
};
