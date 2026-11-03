// Vercel API gateway. All legacy /api/* routes resolve through this function.
const routes = {
  "/admin/bootstrap": () => require("../api-handlers/admin/bootstrap"),
  "/admin/coupons": () => require("../api-handlers/admin/coupons"),
  "/admin/customers": () => require("../api-handlers/admin/customers"),
  "/admin/delivery": () => require("../api-handlers/admin/delivery"),
  "/admin/inventory": () => require("../api-handlers/admin/inventory"),
  "/admin/orders": () => require("../api-handlers/admin/orders"),
  "/admin/products": () => require("../api-handlers/admin/products"),
  "/admin/refunds": () => require("../api-handlers/admin/refunds"),
  "/admin/reviews": () => require("../api-handlers/admin/reviews"),
  "/admin/summary": () => require("../api-handlers/admin/summary"),
  "/alternatives": () => require("../api-handlers/alternatives"),
  "/auth/login": () => require("../api-handlers/auth/login"),
  "/auth/logout": () => require("../api-handlers/auth/logout"),
  "/auth/me": () => require("../api-handlers/auth/me"),
  "/auth/register": () => require("../api-handlers/auth/register"),
  "/coupons": () => require("../api-handlers/coupons"),
  "/delivery": () => require("../api-handlers/delivery"),
  "/health": () => require("../api-handlers/health"),
  "/invoices/:id": () => require("../api-handlers/invoices/[id]"),
  "/loyalty": () => require("../api-handlers/loyalty"),
  "/notifications": () => require("../api-handlers/notifications"),
  "/order-tracking": () => require("../api-handlers/order-tracking"),
  "/orders": () => require("../api-handlers/orders"),
  "/payment-history": () => require("../api-handlers/payment-history"),
  "/payments/config": () => require("../api-handlers/payments/config"),
  "/payments/create-order": () => require("../api-handlers/payments/create-order"),
  "/payments/verify": () => require("../api-handlers/payments/verify"),
  "/payments/webhook": () => require("../api-handlers/payments/webhook"),
  "/products": () => require("../api-handlers/products"),
  "/profile": () => require("../api-handlers/profile"),
  "/push/config": () => require("../api-handlers/push/config"),
  "/push/subscribe": () => require("../api-handlers/push/subscribe"),
  "/recently-viewed": () => require("../api-handlers/recently-viewed"),
  "/recommendations": () => require("../api-handlers/recommendations"),
  "/referrals": () => require("../api-handlers/referrals"),
  "/refunds": () => require("../api-handlers/refunds"),
  "/reviews": () => require("../api-handlers/reviews"),
  "/wishlist": () => require("../api-handlers/wishlist")
};

function sendJson(res, statusCode, body) {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function normalizeSegments(value) {
  const list = Array.isArray(value) ? value : String(value || "").split("/");
  try {
    return list.map((part) => decodeURIComponent(String(part))).filter(Boolean);
  } catch {
    return null;
  }
}

function matchRoute(pattern, actual) {
  const expected = pattern.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(":")) params[expected[i].slice(1)] = actual[i];
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

module.exports = async function apiGateway(req, res) {
  let parsed;
  try {
    parsed = new URL(req.url || "/", "https://vercel.local");
  } catch {
    return sendJson(res, 400, { error: "Invalid request URL." });
  }

  // Rewrites send /api/:path* to /api/index?path=:path*.
  // Prefer the rewrite parameter, then fall back to the original URL.
  let rawPath = req.query && req.query.path;
  if (rawPath === undefined || rawPath === null || rawPath === "") {
    rawPath = parsed.searchParams.get("path");
  }
  let actual = normalizeSegments(rawPath);
  if (actual && actual[0] === "api") actual = actual.slice(1);

  if (!actual || !actual.length) {
    let pathname = parsed.pathname.replace(/^\\/+/, "");
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "api") parts.shift();
    if (parts[0] === "index") parts.shift();
    actual = normalizeSegments(parts);
  }

  if (!actual || !actual.length) {
    return sendJson(res, 404, { error: "API route not found." });
  }

  for (const [pattern, loadHandler] of Object.entries(routes)) {
    const params = matchRoute(pattern, actual);
    if (!params) continue;

    let handler;
    try {
      handler = loadHandler();
    } catch (error) {
      console.error("[api-gateway] Handler load failed:", pattern, error && error.stack || error);
      return sendJson(res, 500, { error: "API handler could not be loaded." });
    }

    req.query = { ...(req.query || {}), ...(params || {}) };
    try {
      return await handler(req, res);
    } catch (error) {
      console.error("[api-gateway] Handler threw:", pattern, error && error.stack || error);
      return sendJson(res, 500, { error: "API handler failed unexpectedly." });
    }
  }

  return sendJson(res, 404, { error: "API route not found." });
};
