const crypto = require('crypto');
const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse } = require('../../lib/http');
const { ObjectId } = require('mongodb');
const { restoreOrderInventory, restorePoints, releaseCoupon } = require('../../lib/order-utils');
const { releaseDeliverySlot } = require('../../lib/delivery');
const { notifyUser } = require('../../lib/push');

module.exports = async function handler(req,res) {
  if (req.method !== 'POST') return methodNotAllowed(res,['POST']);
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return sendJson(res,503,{error:'Razorpay webhook is not configured.'});
    let raw;
    if (Buffer.isBuffer(req.rawBody)) raw=req.rawBody;
    else if (typeof req.rawBody === 'string') raw=Buffer.from(req.rawBody);
    else raw=await new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});
    const signature=String(req.headers['x-razorpay-signature']||'');
    const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
    const a=Buffer.from(expected),b=Buffer.from(signature);
    if(!signature || a.length!==b.length || !crypto.timingSafeEqual(a,b)) return sendJson(res,400,{error:'Invalid webhook signature.'});
    const event=JSON.parse(raw.toString('utf8'));
    const db=await getDb();
    const refundEntity=event.payload?.refund?.entity;
    if (refundEntity?.id && ['refund.created','refund.processed','refund.failed'].includes(event.event)) {
      const refund=await db.collection('refund_requests').findOne({ $or: [ { refundId: refundEntity.id }, ...(refundEntity.notes?.freshcartRefundRequestId && ObjectId.isValid(String(refundEntity.notes.freshcartRefundRequestId)) ? [{ _id: new ObjectId(String(refundEntity.notes.freshcartRefundRequestId)) }] : []), ...(refundEntity.payment_id ? [{ paymentId: refundEntity.payment_id, status: { $in: ['processing','pending'] } }] : []) ] });
      if (refund) {
        const incomingStatus=event.event==='refund.processed'?'processed':event.event==='refund.failed'?'failed':'pending';
        const status=refund.status==='processed'?'processed':refund.status==='failed'&&incomingStatus==='pending'?'failed':incomingStatus;
        await db.collection('refund_requests').updateOne({_id:refund._id,status:{$ne:'processed'}},{$set:{status,refundId:refundEntity.id,paymentId:refundEntity.payment_id||refund.paymentId,providerStatus:refundEntity.status||status,updatedAt:new Date()}});
        const order=await db.collection('orders').findOne({_id:refund.orderId});
        if(order) {
          const shouldCancel = status === 'processed' || order.refundInitiationState === 'processing' || order.status === 'cancelled';
          await db.collection('orders').updateOne({_id:order._id},{$set:{refundStatus:status,paymentStatus:status==='processed'?'refunded':status==='failed'?'refund_failed':'refund_pending',...(shouldCancel?{status:'cancelled',refundInitiationState:status}:{}),updatedAt:new Date()},$push:{statusHistory:{status:shouldCancel?'cancelled':`refund_${status}`,at:new Date(),note:`Razorpay refund ${refundEntity.id} ${status}`}}});
          if(shouldCancel){await restoreOrderInventory(db,order);await restorePoints(db,order);await releaseCoupon(db,order);await releaseDeliverySlot(db,order);}
          await db.collection('notifications').insertOne({userId:refund.userId,orderId:order._id,type:'refund',message:`Refund for ${order.orderNumber} is ${status}.`,createdAt:new Date(),read:false});
          await notifyUser(db, refund.userId, { title: 'FreshCart refund update', body: `Refund for ${order.orderNumber} is ${status}.`, url: '/#customerHub', tag: `refund-${order._id}` }).catch(() => {});
        }
      }
      return sendJson(res,200,{ok:true});
    }
    const entity=event.payload?.payment?.entity;
    if(!entity?.order_id) return sendJson(res,200,{ok:true,ignored:true});
    const orders=db.collection('orders');
    const order=await orders.findOne({razorpayOrderId:entity.order_id});
    if(!order) return sendJson(res,200,{ok:true,ignored:true});
    if(event.event==='payment.captured' || event.event==='order.paid') {
      if(Number(entity.amount)!==Number(order.total)*100 || entity.currency!=='INR') return sendJson(res,400,{error:'Payment amount or currency does not match the order.'});
      const now=new Date();
      const updated=await orders.updateOne({_id:order._id,paymentStatus:{$ne:'paid'},status:{$nin:['cancelled','payment_failed']}},{$set:{paymentStatus:'paid',razorpayPaymentId:entity.id,status:'confirmed',updatedAt:now},$push:{statusHistory:{status:'confirmed',at:now,note:'Razorpay payment confirmed by webhook'}}});
      // Only the webhook that transitions the order to paid should create the notification.
      if(updated.modifiedCount) {
        await db.collection('notifications').insertOne({userId:order.userId,orderId:order._id,type:'payment',message:`Payment received for ${order.orderNumber}.`,createdAt:now,read:false});
      }
    } else if(event.event==='payment.failed') {
      const updated=await orders.updateOne({_id:order._id,paymentStatus:{$ne:'paid'},status:{$ne:'payment_failed'}},{$set:{paymentStatus:'failed',status:'payment_failed',updatedAt:new Date()},$push:{statusHistory:{status:'payment_failed',at:new Date(),note:'Razorpay payment failed'}}});
      if(updated.modifiedCount) {
        await restoreOrderInventory(db,order);
        await restorePoints(db,order); await releaseCoupon(db,order); await releaseDeliverySlot(db,order);
        await db.collection('notifications').insertOne({userId:order.userId,orderId:order._id,type:'payment',message:`Payment failed for ${order.orderNumber}. You can place a new order.`,createdAt:new Date(),read:false});
      }
    }
    return sendJson(res,200,{ok:true});
  } catch(error) { return errorResponse(res,error); }
};
module.exports.config = { api: { bodyParser: false } };
