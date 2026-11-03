const crypto = require('crypto');
const { getDb } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
const { ObjectId } = require('mongodb');
module.exports = async function handler(req,res) {
  if (req.method !== 'POST') return methodNotAllowed(res,['POST']);
  if (!assertSameOrigin(req,res)) return;
  try {
    const session = requireUser(req); if (!session) return sendJson(res,401,{error:'Please sign in.'});
    const body = await readBody(req);
    const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature} = body;
    if (![orderId,paymentId,signature].every(x=>typeof x==='string' && x.length>5)) return sendJson(res,400,{error:'Payment verification details are incomplete.'});
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return sendJson(res,503,{error:'Razorpay is not configured.'});
    const expected = crypto.createHmac('sha256',secret).update(`${orderId}|${paymentId}`).digest('hex');
    const a=Buffer.from(expected), b=Buffer.from(signature);
    if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return sendJson(res,400,{error:'Payment signature could not be verified.'});
    const db=await getDb();
    const order=await db.collection('orders').findOne({razorpayOrderId:orderId,userId:new ObjectId(session.sub)});
    if (!order) return sendJson(res,404,{error:'Payment order not found.'});
    if (['cancelled','payment_failed'].includes(order.status)) return sendJson(res,409,{error:'This order is no longer active. Please place a new order.'});
    if (order.paymentStatus==='paid') return sendJson(res,200,{ok:true,orderNumber:order.orderNumber,status:order.status});
    const paymentResponse=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{'Authorization':'Basic '+Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${secret}`).toString('base64')}});
    const paymentData=await paymentResponse.json();
    if (!paymentResponse.ok || paymentData.order_id!==orderId || Number(paymentData.amount)!==Number(order.total)*100 || paymentData.currency!=='INR' || paymentData.status!=='captured') {
      return sendJson(res,409,{error:'Razorpay has not confirmed a captured payment for this exact order amount.'});
    }
    const now=new Date();
    const updated = await db.collection('orders').updateOne({_id:order._id,paymentStatus:{$ne:'paid'},status:{$nin:['cancelled','payment_failed']}},{$set:{paymentStatus:'paid',razorpayPaymentId:paymentId,status:'confirmed',updatedAt:now},$push:{statusHistory:{status:'confirmed',at:now,note:'Payment verified successfully'}}});
    if (!updated.modifiedCount) {
      const latest = await db.collection('orders').findOne({_id:order._id},{projection:{paymentStatus:1,status:1,orderNumber:1}});
      if (latest?.paymentStatus === 'paid') return sendJson(res,200,{ok:true,orderNumber:latest.orderNumber,status:latest.status});
      return sendJson(res,409,{error:'This order changed while payment was being verified. Contact support before retrying.'});
    }
    await db.collection('notifications').insertOne({userId:new ObjectId(session.sub),orderId:order._id,type:'payment',message:`Payment received for ${order.orderNumber}.`,createdAt:now,read:false});
    return sendJson(res,200,{ok:true,orderNumber:order.orderNumber,status:'confirmed'});
  } catch(error) { return errorResponse(res,error); }
};
