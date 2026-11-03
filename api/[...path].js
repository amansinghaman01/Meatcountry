const routes = Object.freeze({
  'admin/bootstrap': require('../server/api/admin/bootstrap.js'),
  'admin/coupons': require('../server/api/admin/coupons.js'),
  'admin/customers': require('../server/api/admin/customers.js'),
  'admin/delivery': require('../server/api/admin/delivery.js'),
  'admin/inventory': require('../server/api/admin/inventory.js'),
  'admin/orders': require('../server/api/admin/orders.js'),
  'admin/products': require('../server/api/admin/products.js'),
  'admin/refunds': require('../server/api/admin/refunds.js'),
  'admin/reviews': require('../server/api/admin/reviews.js'),
  'admin/summary': require('../server/api/admin/summary.js'),
  'alternatives': require('../server/api/alternatives.js'),
  'auth/login': require('../server/api/auth/login.js'),
  'auth/logout': require('../server/api/auth/logout.js'),
  'auth/me': require('../server/api/auth/me.js'),
  'auth/register': require('../server/api/auth/register.js'),
  'coupons': require('../server/api/coupons.js'),
  'delivery': require('../server/api/delivery.js'),
  'health': require('../server/api/health.js'),
  'invoices/:id': require('../server/api/invoices/[id].js'),
  'loyalty': require('../server/api/loyalty.js'),
  'notifications': require('../server/api/notifications.js'),
  'order-tracking': require('../server/api/order-tracking.js'),
  'orders': require('../server/api/orders.js'),
  'payment-history': require('../server/api/payment-history.js'),
  'payments/config': require('../server/api/payments/config.js'),
  'payments/create-order': require('../server/api/payments/create-order.js'),
  'payments/verify': require('../server/api/payments/verify.js'),
  'payments/webhook': require('../server/api/payments/webhook.js'),
  'products': require('../server/api/products.js'),
  'profile': require('../server/api/profile.js'),
  'push/config': require('../server/api/push/config.js'),
  'push/subscribe': require('../server/api/push/subscribe.js'),
  'recently-viewed': require('../server/api/recently-viewed.js'),
  'recommendations': require('../server/api/recommendations.js'),
  'referrals': require('../server/api/referrals.js'),
  'refunds': require('../server/api/refunds.js'),
  'reviews': require('../server/api/reviews.js'),
  'wishlist': require('../server/api/wishlist.js')
});

module.exports = async function apiRouter(req, res) {
  try {
    const pathname = String(req.url || '').split('?')[0];
    const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    let route = parts.join('/');
    if (parts.length === 2 && parts[0] === 'invoices') {
      route = 'invoices/:id';
      req.query = { ...(req.query || {}), id: parts[1] };
    }
    const handler = routes[route];
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'API route not found.' }));
    }
    return await handler(req, res);
  } catch (error) {
    console.error('FreshCart API router error:', error && error.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Something went wrong. Please try again.' }));
    }
  }
};

// Keep raw request bodies available for the Razorpay webhook and the shared JSON reader.
module.exports.config = { api: { bodyParser: false } };
