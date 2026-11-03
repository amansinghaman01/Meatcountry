// Single Vercel Function dispatcher. Original handlers and public /api URLs are preserved.
const routes = {
  "/admin/bootstrap": require("../api-handlers/admin/bootstrap"),
  "/admin/coupons": require("../api-handlers/admin/coupons"),
  "/admin/customers": require("../api-handlers/admin/customers"),
  "/admin/delivery": require("../api-handlers/admin/delivery"),
  "/admin/inventory": require("../api-handlers/admin/inventory"),
  "/admin/orders": require("../api-handlers/admin/orders"),
  "/admin/products": require("../api-handlers/admin/products"),
  "/admin/refunds": require("../api-handlers/admin/refunds"),
  "/admin/reviews": require("../api-handlers/admin/reviews"),
  "/admin/summary": require("../api-handlers/admin/summary"),
  "/alternatives": require("../api-handlers/alternatives"),
  "/auth/login": require("../api-handlers/auth/login"),
  "/auth/logout": require("../api-handlers/auth/logout"),
  "/auth/me": require("../api-handlers/auth/me"),
  "/auth/register": require("../api-handlers/auth/register"),
  "/coupons": require("../api-handlers/coupons"),
  "/delivery": require("../api-handlers/delivery"),
  "/health": require("../api-handlers/health"),
  "/invoices/:id": require("../api-handlers/invoices/[id]"),
  "/loyalty": require("../api-handlers/loyalty"),
  "/notifications": require("../api-handlers/notifications"),
  "/order-tracking": require("../api-handlers/order-tracking"),
  "/orders": require("../api-handlers/orders"),
  "/payment-history": require("../api-handlers/payment-history"),
  "/payments/config": require("../api-handlers/payments/config"),
  "/payments/create-order": require("../api-handlers/payments/create-order"),
  "/payments/verify": require("../api-handlers/payments/verify"),
  "/payments/webhook": require("../api-handlers/payments/webhook"),
  "/products": require("../api-handlers/products"),
  "/profile": require("../api-handlers/profile"),
  "/push/config": require("../api-handlers/push/config"),
  "/push/subscribe": require("../api-handlers/push/subscribe"),
  "/recently-viewed": require("../api-handlers/recently-viewed"),
  "/recommendations": require("../api-handlers/recommendations"),
  "/referrals": require("../api-handlers/referrals"),
  "/refunds": require("../api-handlers/refunds"),
  "/reviews": require("../api-handlers/reviews"),
  "/wishlist": require("../api-handlers/wishlist")
};

function decodePath(pathname) {
  try {
    return pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
}

function matchRoute(pattern, actual) {
  const expected = pattern.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    const part = expected[i];
    if (part.startsWith(":")) params[part.slice(1)] = actual[i];
    else if (part !== actual[i]) return null;
  }
  return params;
}

module.exports = async function apiRouter(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Invalid request path." }));
  }

  const prefix = "/api/";
  let relativePath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname.replace(/^\\/+/, "");

  // Some catch-all adapters expose the path only through req.query.path.
  if (!relativePath || relativePath === "[...path]") {
    const catchAll = req.query && req.query.path;
    relativePath = Array.isArray(catchAll) ? catchAll.join("/") : String(catchAll || "");
  }

  const actualSegments = decodePath(relativePath);
  if (!actualSegments || !actualSegments.length) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "API route not found." }));
  }

  let selectedHandler = null;
  let selectedParams = null;
  for (const [route, handler] of Object.entries(routes)) {
    const params = matchRoute(route, actualSegments);
    if (params) {
      selectedHandler = handler;
      selectedParams = params;
      break;
    }
  }

  if (!selectedHandler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "API route not found." }));
  }

  req.query = { ...(req.query || {}), ...(selectedParams || {}) };
  return selectedHandler(req, res);
};
