const { ObjectId } = require('mongodb');
const { getDb } = require('../../../lib/db');
const { requireUser } = require('../../../lib/auth');
const { sendJson, methodNotAllowed, errorResponse } = require('../../../lib/http');

function ascii(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}
function pdfEscape(value) { return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function createInvoicePdf(order, id) {
  const lines = [
    { text: 'FRESHCART MARKET', size: 22, bold: true, gap: 30 },
    { text: 'MEAT | SEAFOOD | EVERYDAY FAVOURITES', size: 9, gap: 25 },
    { text: 'ORDER INVOICE / SUMMARY', size: 16, bold: true, gap: 28 },
    { text: `Invoice: ${order.orderNumber || id}`, size: 10, gap: 16 },
    { text: `Date: ${new Date(order.createdAt).toLocaleString('en-IN')}`, size: 10, gap: 16 },
    { text: `Payment: ${order.paymentMethod} | ${order.paymentStatus}`, size: 10, gap: 24 },
    { text: 'DELIVER TO', size: 11, bold: true, gap: 16 },
    { text: ascii(order.customerName), size: 10, gap: 14 },
    { text: ascii(order.phone), size: 10, gap: 14 },
    { text: ascii(order.address), size: 10, gap: 14 },
    { text: `PIN: ${ascii(order.pincode)}`, size: 10, gap: 24 },
    { text: 'ITEM                                      QTY          PRICE             AMOUNT', size: 9, bold: true, gap: 18 },
    { text: '--------------------------------------------------------------------------', size: 9, gap: 16 },
  ];
  for (const item of order.items || []) {
    lines.push({ text: `${ascii(item.name).slice(0,38).padEnd(40)} ${String(item.quantity).padStart(3)}  Rs ${String(item.unitPrice).padStart(7)}  Rs ${String(item.lineTotal).padStart(8)}`, size: 9, gap: 18 });
  }
  lines.push({ text: '--------------------------------------------------------------------------', size: 9, gap: 20 });
  lines.push({ text: `Subtotal: Rs ${order.subtotal}`, size: 10, gap: 17 });
  lines.push({ text: `Delivery: Rs ${order.deliveryFee}`, size: 10, gap: 17 });
  lines.push({ text: `Discount: Rs ${order.discount || 0}`, size: 10, gap: 17 });
  lines.push({ text: `TOTAL: Rs ${order.total}`, size: 14, bold: true, gap: 26 });
  lines.push({ text: 'Thank you for shopping with FreshCart Market.', size: 9, gap: 14 });
  lines.push({ text: 'This is an electronically generated order invoice.', size: 8, gap: 10 });

  const pages = [];
  let page = [], y = 790;
  for (const line of lines) {
    if (y < 58) { pages.push(page); page = []; y = 790; }
    page.push(`BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf 50 ${y} Td (${pdfEscape(line.text)}) Tj ET`);
    y -= line.gap;
  }
  pages.push(page);

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${pageIds}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pages.forEach((commands, i) => {
    const pageId = 5 + i * 2, contentId = pageId + 1;
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(output, 'ascii');
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'ascii');
}

module.exports = async function handler(req,res) {
  if (req.method !== 'GET') return methodNotAllowed(res,['GET']);
  try {
    const session=requireUser(req); if (!session) return sendJson(res,401,{error:'Please sign in.'});
    const rawId=String(req.query?.id || req.url.split('/').pop().split('?')[0]);
    if (!ObjectId.isValid(rawId)) return sendJson(res,400,{error:'Invalid invoice ID.'});
    const db=await getDb();
    const order=await db.collection('orders').findOne({_id:new ObjectId(rawId)});
    if (!order) return sendJson(res,404,{error:'Order not found.'});
    const isAdmin=!!(await db.collection('users').findOne({_id:new ObjectId(session.sub),role:'admin'},{projection:{_id:1}}));
    if (order.userId?.toString()!==session.sub && !isAdmin) return sendJson(res,403,{error:'You cannot access this invoice.'});
    const pdf=createInvoicePdf(order,rawId);
    res.statusCode=200;
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Length',pdf.length);
    res.setHeader('Content-Disposition',`attachment; filename="FreshCart-${order.orderNumber || rawId}.pdf"`);
    res.setHeader('Cache-Control','private, no-store');
    res.end(pdf);
  } catch(error) { return errorResponse(res,error); }
};

module.exports.createInvoicePdf = createInvoicePdf;
