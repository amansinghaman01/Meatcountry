const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req,res) {
  try {
    const admin=await requireAdmin(req,res); if(!admin) return;
    const col=admin.db.collection('coupons');
    if(req.method==='GET') { const rows=await col.find({}).sort({createdAt:-1}).toArray(); return sendJson(res,200,{coupons:rows.map(x=>({...x,_id:undefined,id:x._id.toString()}))}); }
    if(!['POST','DELETE'].includes(req.method)) return methodNotAllowed(res,['GET','POST','DELETE']);
    if(!assertSameOrigin(req,res)) return;
    const body=await readBody(req);
    if(req.method==='DELETE') { const r=await col.updateOne({code:String(body.code||'').toUpperCase()},{$set:{active:false,updatedAt:new Date()}});return sendJson(res,r.matchedCount?200:404,{ok:!!r.matchedCount}); }
    const code=String(body.code||'').trim().toUpperCase(),type=body.type==='flat'?'flat':'percent';
    const discountValue=Number(body.discountValue),minOrder=Number(body.minOrder||0),maxDiscount=Number(body.maxDiscount||0),maxUses=Number(body.maxUses||0);
    if(!/^[A-Z0-9_-]{3,24}$/.test(code)||!Number.isFinite(discountValue)||discountValue<=0||discountValue>(type==='percent'?100:100000)||!Number.isFinite(minOrder)||minOrder<0||!Number.isFinite(maxDiscount)||maxDiscount<0||!Number.isInteger(maxUses)||maxUses<0) return sendJson(res,400,{error:'Enter valid coupon details.'});
    const coupon={code,type,discountValue,minOrder,maxDiscount:maxDiscount>0?maxDiscount:null,maxUses:maxUses||null,active:true,updatedAt:new Date()};
    await col.updateOne({code},{$set:coupon,$setOnInsert:{createdAt:new Date(),usedCount:0}},{upsert:true});
    return sendJson(res,200,{ok:true,code});
  } catch(error){return errorResponse(res,error);}
};
