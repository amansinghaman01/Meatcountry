function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 32_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function assertSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true; // Non-browser clients may omit Origin; cookie SameSite remains enabled.
  try {
    const parsed = new URL(origin);
    const host = req.headers.host;
    if (!host || parsed.host !== host) {
      sendJson(res, 403, { error: 'Cross-origin request blocked.' });
      return false;
    }
    return true;
  } catch {
    sendJson(res, 403, { error: 'Invalid request origin.' });
    return false;
  }
}

function errorResponse(res, error) {
  if (error.code === 'CONFIG_MISSING') return sendJson(res, 503, { error: error.message });
  if (error.code === 11000) return sendJson(res, 409, { error: 'An account with this email already exists.' });
  console.error('FreshCart API error:', error.message);
  return sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
}

module.exports = { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin };
