const { getDb } = require('../../../lib/db');
const { sendJson, methodNotAllowed, readBody, errorResponse, assertSameOrigin } = require('../../../lib/http');
module.exports = async function handler(req,res) {
  if (req.method !== 'POST') return methodNotAllowed(res,['POST']);
  if (!assertSameOrigin(req,res)) return;
  try {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secret || secret.length < 32) return sendJson(res,503,{error:'Admin bootstrap is not configured. Set a strong ADMIN_BOOTSTRAP_SECRET temporarily in Vercel.'});
    const provided = String(req.headers['x-admin-bootstrap'] || '');
    const a=Buffer.from(secret), b=Buffer.from(provided);
    const crypto=require('crypto'); if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return sendJson(res,403,{error:'Invalid bootstrap secret.'});
    const body=await readBody(req); const email=String(body.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res,400,{error:'Enter a valid account email.'});
    const db=await getDb();
    if(await db.collection('users').countDocuments({role:'admin'})) return sendJson(res,409,{error:'An admin account already exists. Bootstrap is one-time only.'});
    const result=await db.collection('users').updateOne({email},{$set:{role:'admin',updatedAt:new Date()}});
    if(!result.matchedCount) return sendJson(res,404,{error:'Create a customer account with this email first, then bootstrap it.'});
    return sendJson(res,200,{ok:true,email,message:'Admin role assigned. Remove ADMIN_BOOTSTRAP_SECRET from Vercel now.'});
  } catch(error) { return errorResponse(res,error); }
};
