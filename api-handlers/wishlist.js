const { ObjectId } = require('mongodb');
const catalog = require('../catalog');
const { getDb } = require('../lib/db');
const { requireUser } = require('../lib/auth');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../lib/http');

module.exports = async function handler(req,res) {
  try {
    const session=requireUser(req); if(!session) return sendJson(res,401,{error:'Please sign in to sync your wishlist.'});
    const db=await getDb(), users=db.collection('users'), id=new ObjectId(session.sub);
    if(req.method==='GET') {
      const user=await users.findOne({_id:id},{projection:{wishlist:1}});
      return sendJson(res,200,{productIds:user?.wishlist||[]});
    }
    if(req.method!=='PUT') return methodNotAllowed(res,['GET','PUT']);
    if(!assertSameOrigin(req,res)) return;
    const body=await readBody(req);
    if(!Array.isArray(body.productIds)||body.productIds.length>100) return sendJson(res,400,{error:'Wishlist must contain at most 100 products.'});
    const ids=[...new Set(body.productIds.map(x=>String(x)))];
    if(ids.some(x=>!/^[A-Z0-9-]{3,32}$/.test(x))) return sendJson(res,400,{error:'Invalid product in wishlist.'});
    const overrides=await db.collection('products').find({id:{$in:ids},active:{$ne:false}},{projection:{id:1}}).toArray();
    const allowed=new Set([...catalog.map(x=>x.id),...overrides.map(x=>x.id)]);
    if(ids.some(x=>!allowed.has(x))) return sendJson(res,400,{error:'One or more wishlist products are unavailable.'});
    await users.updateOne({_id:id},{$set:{wishlist:ids,updatedAt:new Date()}});
    return sendJson(res,200,{ok:true,productIds:ids});
  } catch(error) { return errorResponse(res,error); }
};
