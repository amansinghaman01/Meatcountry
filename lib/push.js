async function notifyUser(db, userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return { sent: 0, skipped: true };
  let webpush;
  try { webpush = require('web-push'); } catch { return { sent: 0, skipped: true, reason: 'web-push dependency is not installed' }; }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const col = db.collection('push_subscriptions');
  const rows = await col.find({ userId }).toArray();
  let sent = 0;
  for (const row of rows) {
    try { await webpush.sendNotification(row.subscription, JSON.stringify(payload)); sent++; }
    catch (error) { if (error.statusCode === 404 || error.statusCode === 410) await col.deleteOne({ _id: row._id }); }
  }
  return { sent };
}
module.exports = { notifyUser };
