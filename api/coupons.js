const { getDb } = require('../lib/db');
const { ObjectId } = require('mongodb');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../lib/http');
module.exports=async function handler(req,res) {
  if(req.method!=='POST') return methodNotAllowed(res,['POST']);
  if(!assertSameOrigin(req,res)) return;
  try {
    const session=requireUser(req); if(!session) return sendJson(res,401,{error:'Please sign in to apply coupons.'});
    const body=await readBody(req),code=String(body.code||'').trim().toUpperCase(),subtotal=Number(body.subtotal);
    if(!/^[A-Z0-9_-]{3,24}$/.test(code)||!Number.isFinite(subtotal)||subtotal<0) return sendJson(res,400,{error:'Enter a valid coupon code.'});
    if(!process.env.MONGODB_URI) return sendJson(res,503,{error:'Coupon validation requires the connected database.'});
    const db=await getDb();
    let row=await db.collection('coupons').findOne({code});
    let discount=0;
    if(!row && code==='FRESH10') { const prior=await db.collection('orders').countDocuments({userId:new ObjectId(session.sub),$or:[{paymentMethod:'Razorpay',paymentStatus:'paid'},{paymentMethod:'COD',status:{$nin:['cancelled','payment_failed']}}]}); if(prior>0) return sendJson(res,400,{error:'FRESH10 is available only on your first eligible order.'}); discount=Math.min(150,Math.round(subtotal*.1)); }
    else {
      if(!row||row.active!==true) return sendJson(res,404,{error:'This coupon is not active.'});
      if(subtotal<Number(row.minOrder||0)) return sendJson(res,400,{error:`Minimum order value is ₹${row.minOrder}.`});
      if(row.maxUses && Number(row.usedCount||0)>=row.maxUses) return sendJson(res,400,{error:'This coupon has reached its usage limit.'});
      discount=row.type==='flat'?Number(row.discountValue):Math.round(subtotal*Number(row.discountValue)/100);
      if(row.maxDiscount) discount=Math.min(discount,Number(row.maxDiscount));
      discount=Math.min(discount,subtotal);
    }
    return sendJson(res,200,{ok:true,code,discount,message:`Coupon applied. You save ₹${discount}.`});
  } catch(error){return errorResponse(res,error);}
};
