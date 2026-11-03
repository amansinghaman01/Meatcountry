const { requireAdmin } = require('../../../lib/admin');
const { sendJson, methodNotAllowed, errorResponse } = require('../../../lib/http');
module.exports = async function handler(req,res) {
  if(req.method!=='GET') return methodNotAllowed(res,['GET']);
  try {
    const admin=await requireAdmin(req,res); if(!admin) return;
    const rows=await admin.db.collection('users').aggregate([
      {$match:{role:{$ne:'admin'}}},
      {$lookup:{from:'orders',localField:'_id',foreignField:'userId',as:'orders'}},
      {$project:{name:1,email:1,phone:1,createdAt:1,orderCount:{$size:'$orders'},lifetimeValue:{$reduce:{input:'$orders',initialValue:0,in:{$add:['$$value','$$this.total']}}}}},
      {$sort:{createdAt:-1}},{$limit:200}
    ]).toArray();
    return sendJson(res,200,{customers:rows.map(x=>({...x,_id:undefined,id:x._id.toString()}))});
  } catch(error){return errorResponse(res,error);}
};
