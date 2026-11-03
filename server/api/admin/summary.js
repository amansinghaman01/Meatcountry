const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, errorResponse } = require('../../../lib/http');
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const db = admin.db, orders = db.collection('orders');
    const [totalOrders, pendingOrders, deliveredOrders, customers, products, finance, refundSummary, popular, inventory] = await Promise.all([
      orders.countDocuments({}),
      orders.countDocuments({ status: { $in: ['placed', 'confirmed', 'preparing', 'shipped', 'payment_pending'] } }),
      orders.countDocuments({ status: 'delivered' }),
      db.collection('users').countDocuments({ role: { $ne: 'admin' } }),
      db.collection('products').countDocuments({ active: { $ne: false } }),
      orders.aggregate([
        { $match: { status: 'delivered', paymentStatus: { $in: ['paid', 'pending'] } } },
        { $group: { _id: null, revenue: { $sum: '$total' }, itemRevenue: { $sum: '$subtotal' }, netItemRevenue: { $sum: { $max: [0, { $subtract: ['$subtotal', { $ifNull: ['$discount', 0] }] }] } }, estimatedCost: { $sum: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: [{ $ifNull: ['$$i.unitCost', 0] }, '$$i.quantity'] } } } } }, totalLines: { $sum: { $size: { $ifNull: ['$items', []] } } }, costedLines: { $sum: { $size: { $filter: { input: { $ifNull: ['$items', []] }, as: 'i', cond: { $gt: [{ $ifNull: ['$$i.unitCost', 0] }, 0] } } } } }, deliveredOrders: { $sum: 1 } } }
      ]).toArray(),
      db.collection('refund_requests').aggregate([{ $match: { status: { $in: ['requested', 'processing', 'pending', 'processed'] } } }, { $group: { _id: null, requested: { $sum: '$amount' }, count: { $sum: 1 }, processed: { $sum: { $cond: [{ $eq: ['$status', 'processed'] }, '$amount', 0] } }, pending: { $sum: { $cond: [{ $in: ['$status', ['requested','processing','pending']] }, '$amount', 0] } } } }]).toArray(),
      orders.aggregate([{ $match: { status: 'delivered' } }, { $unwind: '$items' }, { $group: { _id: '$items.productId', name: { $first: '$items.name' }, quantitySold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } }, { $sort: { quantitySold: -1 } }, { $limit: 8 }]).toArray(),
      db.collection('products').aggregate([{ $match: { active: { $ne: false }, stock: { $exists: true } } }, { $match: { $expr: { $lte: ['$stock', { $ifNull: ['$minStock', 5] }] } } }, { $count: 'count' }]).toArray()
    ]);
    const f = finance[0] || {}, r = refundSummary[0] || {};
    const revenue = Number(f.revenue || 0), netItemRevenue = Number(f.netItemRevenue || 0), estimatedCost = Number(f.estimatedCost || 0);
    const costCoveragePercent = Number(f.totalLines || 0) ? Math.round(Number(f.costedLines || 0) / Number(f.totalLines) * 10000) / 100 : 0;
    return sendJson(res, 200, { totalOrders, pendingOrders, deliveredOrders, customers, products, sales: revenue, revenue, estimatedCost, estimatedGrossProfit: costCoveragePercent === 100 ? netItemRevenue - estimatedCost : null, costCoveragePercent, lowStockProducts: Number(inventory?.[0]?.count || 0), marginPercent: netItemRevenue && costCoveragePercent === 100 ? Math.round((netItemRevenue - estimatedCost) / netItemRevenue * 10000) / 100 : null, refundsRequested: Number(r.requested || 0), refundsProcessed: Number(r.processed || 0), refundsPending: Number(r.pending || 0), refundRequests: Number(r.count || 0), popularProducts: popular.map(x => ({ productId: x._id, name: x.name, quantitySold: x.quantitySold, revenue: x.revenue })), disclaimer: 'Profit is shown only when 100% of delivered order lines have a non-zero costPrice snapshot. It excludes tax, packaging, delivery, gateway fees and operating expenses.' });
  } catch (error) { return errorResponse(res, error); }
};
