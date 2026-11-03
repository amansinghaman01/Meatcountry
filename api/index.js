// Shared API router. Original route URLs are preserved through vercel.json rewrites.
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
  if (Array.isArray(value)) value = value.join("/");
  return String(value || "").split("/").filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
}

function parsePath(req) {
  // Vercel provides rewrite parameters via req.query. Prefer that value.
  let value = req.query && req.query.path;
  if (value === undefined || value === null || value === "") {
    const rawUrl = String(req.url || "/");
    const question = rawUrl.indexOf("?");
    if (question >= 0) {
      const params = new URLSearchParams(rawUrl.slice(question + 1));
      value = params.get("path");
    }
  }
  if (value !== undefined && value !== null && value !== "") {
    const parts = normalize(value);
    if (parts[0] === "api") parts.shift();
    if (parts[0] === "index") parts.shift();
    return parts;
  }

  const pathname = String(req.url || "/").split("?")[0];
  const parts = normalize(pathname);
  if (parts[0] === "api") parts.shift();
  if (parts[0] === "index") parts.shift();
  return parts;
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

module.exports = async function apiGateway(req, res) {
  const parts = parsePath(req);
  if (!parts.length) return reply(res, 404, { error: "API route not found." });

  for (const [pattern, load] of Object.entries(handlers)) {
    const params = match(pattern.split("/"), parts);
    if (!params) continue;

    let handler;
    try {
      handler = load();
    } catch (error) {
      console.error("[freshcart-api] require failed", pattern, error && error.stack || error);
      return reply(res, 500, { error: "API handler failed to load." });
    }

    req.query = Object.assign({}, req.query || {}, params);
    try {
      return await handler(req, res);
    } catch (error) {
      console.error("[freshcart-api] handler failed", pattern, error && error.stack || error);
      return reply(res, 500, { error: "API handler failed." });
    }
  }

  return reply(res, 404, { error: "Unknown API route.", path: parts.join("/") });
};
