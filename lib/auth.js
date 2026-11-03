const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'freshcart_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('Authentication is not configured. Add a strong JWT_SECRET in Vercel.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return secret;
}

function cookieOptions(maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function setSession(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name },
    getSecret(),
    { expiresIn: SESSION_SECONDS, issuer: 'freshcart-market', audience: 'freshcart-web' }
  );
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', cookieOptions(0));
}

function getToken(req) {
  const header = req.headers.cookie || '';
  const entry = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)); } catch { return null; }
}

function requireUser(req) {
  const token = getToken(req);
  if (!token) return null;
  // Keep configuration errors distinct from invalid/expired user tokens.
  // Otherwise auth/me returns a misleading 401 when JWT_SECRET is missing.
  const secret = getSecret();
  try {
    return jwt.verify(token, secret, { issuer: 'freshcart-market', audience: 'freshcart-web' });
  } catch {
    return null;
  }
}

module.exports = { setSession, clearSession, requireUser, getSecret };
