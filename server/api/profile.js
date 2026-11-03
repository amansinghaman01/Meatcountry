const { ObjectId } = require('mongodb');
const { requireUser } = require('../../lib/auth');
const { getDb } = require('../../lib/db');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../lib/http');
module.exports = async function handler(req,res) {
  try {
    const session=requireUser(req); if(!session) return sendJson(res,401,{error:'Please sign in.'});
    const db=await getDb(); const users=db.collection('users'); const id=new ObjectId(session.sub);
    if(req.method==='GET') {
      const u=await users.findOne({_id:id},{projection:{name:1,email:1,phone:1,addresses:1,loyaltyPoints:1,role:1}});
      if(!u) return sendJson(res,404,{error:'Account not found.'});
      return sendJson(res,200,{profile:{name:u.name,email:u.email,phone:u.phone||'',addresses:u.addresses||[],loyaltyPoints:u.loyaltyPoints||0,role:u.role||'customer'}});
    }
    if(req.method==='DELETE') { if(!assertSameOrigin(req,res)) return; const body=await readBody(req); const index=Number(body.addressIndex); if(!Number.isInteger(index)||index<0||index>19) return sendJson(res,400,{error:'Invalid saved address.'}); const user=await users.findOne({_id:id},{projection:{addresses:1}}); const addresses=user?.addresses||[]; if(index>=addresses.length) return sendJson(res,404,{error:'Saved address not found.'}); addresses.splice(index,1); await users.updateOne({_id:id},{$set:{addresses,updatedAt:new Date()}}); return sendJson(res,200,{ok:true,addresses}); }
    if(req.method!=='PATCH') return methodNotAllowed(res,['GET','PATCH','DELETE']);
    if(!assertSameOrigin(req,res)) return;
    const body=await readBody(req); const set={updatedAt:new Date()};
    if(body.name!==undefined){const name=String(body.name).trim();if(name.length<2||name.length>80)return sendJson(res,400,{error:'Enter a valid name.'});set.name=name;}
    if(body.phone!==undefined){const phone=String(body.phone).trim();if(phone&&!/^[6-9]\d{9}$/.test(phone))return sendJson(res,400,{error:'Enter a valid Indian mobile number.'});set.phone=phone;}
    if(body.address){const a=body.address;const label=String(a.label||'Home').slice(0,30),line=String(a.address||'').trim(),pincode=String(a.pincode||'').trim(),phone=String(a.phone||'').trim();if(line.length<8||line.length>300||!/^\d{6}$/.test(pincode)||!/^[6-9]\d{9}$/.test(phone))return sendJson(res,400,{error:'Enter a valid saved address, PIN code and mobile number.'});
      await users.updateOne({_id:id},{$addToSet:{addresses:{label,address:line,pincode,phone}},$set:set});
    } else await users.updateOne({_id:id},{$set:set});
    const u=await users.findOne({_id:id},{projection:{name:1,email:1,phone:1,addresses:1}});
    return sendJson(res,200,{profile:{name:u.name,email:u.email,phone:u.phone||'',addresses:u.addresses||[]}});
  } catch(error){return errorResponse(res,error);}
};
