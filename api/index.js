// Consolidated Vercel API router. Preserves all original /api/* URLs.
const handlers = {
  "admin/bootstrap": () => require("../api-handlers/admin/bootstrap"),
  "admin/coupons": () => require("../api-handlers/admin/coupons"),
  "admin/customers": () => require("../api-handlers/admin/customers"),
  "admin/delivery": () => require("../api-handlers/admin/delivery"),
  "admin/inventory": () => require("../api-handlers/admin/inventory"),
  "admin/orders": () => require("../api-handlers/admin/orders"),
  "admin/products": () => require("../api-handlers/admin/products"),
  "admin/refunds": () => require("../api-handlers/admin/refunds"),
  "admin/reviews": () => require("../api-handlers/admin/reviews"),
  "admin/summary": () => require("../api-handlers/admin/summary"),
  "alternatives": () => require("../api-handlers/alternatives"),
  "auth/login": () => require("../api-handlers/auth/login"),
  "auth/logout": () => require("../api-handlers/auth/logout"),
  "auth/me": () => require("../api-handlers/auth/me"),
  "auth/register": () => require("../api-handlers/auth/register"),
  "coupons": () => require("../api-handlers/coupons"),
  "delivery": () => require("../api-handlers/delivery"),
  "health": () => require("../api-handlers/health"),
  "invoices/:id": () => require("../api-handlers/invoices/[id]"),
  "loyalty": () => require("../api-handlers/loyalty"),
  "notifications": () => require("../api-handlers/notifications"),
  "order-tracking": () => require("../api-handlers/order-tracking"),
  "orders": () => require("../api-handlers/orders"),
  "payment-history": () => require("../api-handlers/payment-history"),
  "payments/config": () => require("../api-handlers/payments/config"),
  "payments/create-order": () => require("../api-handlers/payments/create-order"),
  "payments/verify": () => require("../api-handlers/payments/verify"),
  "payments/webhook": () => require("../api-handlers/payments/webhook"),
  "products": () => require("../api-handlers/products"),
  "profile": () => require("../api-handlers/profile"),
  "push/config": () => require("../api-handlers/push/config"),
  "push/subscribe": () => require("../api-handlers/push/subscribe"),
  "recently-viewed": () => require("../api-handlers/recently-viewed"),
  "recommendations": () => require("../api-handlers/recommendations"),
  "referrals": () => require("../api-handlers/referrals"),
  "refunds": () => require("../api-handlers/refunds"),
  "reviews": () => require("../api-handlers/reviews"),
  "wishlist": () => require("../api-handlers/wishlist")
};

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function normalize(value) {
  const list = Array.isArray(value) ? value : String(value || "").split("/");
  try {
    return list.map((part) => decodeURIComponent(String(part))).filter(Boolean);
  } catch {
    return null;
  }
}

function match(pattern, parts) {
  const expected = pattern.split("/");
  if (expected.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(":")) params[expected[i].slice(1)] = parts[i];
    else if (expected[i] !== parts[i]) return null;
  }
  return params;
}

function resolvePath(req) {
  let raw = req.query && req.query.path;
  if (raw === undefined || raw === null || raw === "") {
    const rawUrl = String(req.url || "/");
    const q = rawUrl.indexOf("?");
    if (q >= 0) raw = new URLSearchParams(rawUrl.slice(q + 1)).get("path");
  }
  let parts;
  if (raw !== undefined && raw !== null && raw !== "") {
    parts = normalize(raw);
  } else {
    parts = normalize(String(req.url || "/").split("?")[0]);
  }
  if (!parts) return null;
  while (parts[0] === "api" || parts[0] === "index") parts.shift();
  return parts;
}

module.exports = async function apiGateway(req, res) {
  const parts = resolvePath(req);
  if (!parts || !parts.length) return reply(res, 404, { error: "API route not found." });

  for (const [pattern, load] of Object.entries(handlers)) {
    const params = match(pattern, parts);
    if (params === null) continue;

    let handler;
    try {
      handler = load();
    } catch (error) {
      console.error("[freshcart-api] failed loading", pattern, error && error.stack || error);
      return reply(res, 500, { error: "API handler could not be loaded." });
    }

    req.query = Object.assign({}, req.query || {}, params);
    try {
      return await handler(req, res);
    } catch (error) {
      console.error("[freshcart-api] handler failed", pattern, error && error.stack || error);
      return reply(res, 500, { error: "API handler failed unexpectedly." });
    }
  }

  return reply(res, 404, { error: "Unknown API route.", path: parts.join("/") });
};
