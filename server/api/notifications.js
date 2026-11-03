const { ObjectId } = require('mongodb');
const { requireUser } = require('../../lib/auth');
const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, errorResponse, assertSameOrigin, readBody } = require('../../lib/http');
module.exports = async function handler(req,res) {
  try {
    const session=requireUser(req); if(!session) return sendJson(res,401,{error:'Please sign in.'});
    const db=await getDb(); const col=db.collection('notifications');
    if(req.method==='GET') {
      const rows=await col.find({userId:new ObjectId(session.sub)}).sort({createdAt:-1}).limit(30).toArray();
      return sendJson(res,200,{notifications:rows.map(n=>({id:n._id.toString(),type:n.type,message:n.message,createdAt:n.createdAt,read:n.read}))});
    }
    if(req.method==='PATCH') {
      if(!assertSameOrigin(req,res)) return;
      const body=await readBody(req);
      if(body.all===true) await col.updateMany({userId:new ObjectId(session.sub),read:false},{$set:{read:true}});
      else if(ObjectId.isValid(String(body.id||''))) await col.updateOne({_id:new ObjectId(body.id),userId:new ObjectId(session.sub)},{$set:{read:true}});
      else return sendJson(res,400,{error:'Invalid notification.'});
      return sendJson(res,200,{ok:true});
    }
    return methodNotAllowed(res,['GET','PATCH']);
  } catch(error) { return errorResponse(res,error); }
};
