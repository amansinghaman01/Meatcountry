const { MongoClient } = require('mongodb');

let cached = globalThis.__freshCartMongo || { client: null, promise: null, indexesPromise: null };
if (!globalThis.__freshCartMongo) globalThis.__freshCartMongo = cached;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const error = new Error('MongoDB is not configured. Add MONGODB_URI and MONGODB_DATABASE in Vercel.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  if (!cached.promise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });
    cached.client = client;
    cached.promise = client.connect().catch((error) => {
      cached.promise = null;
      cached.client = null;
      cached.indexesPromise = null;
      throw error;
    });
  }

  const client = await cached.promise;
  const db = client.db(process.env.MONGODB_DATABASE || 'freshcart');
  if (!cached.indexesPromise) {
    cached.indexesPromise = Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
      db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true, sparse: true }),
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('coupons').createIndex({ code: 1 }, { unique: true }),
      db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
      db.collection('loyalty_ledger').createIndex({ userId: 1, createdAt: -1 }),
      db.collection('loyalty_ledger').createIndex({ orderId: 1, type: 1 }, { unique: true, sparse: true }),
    ]).catch((error) => {
      cached.indexesPromise = null;
      throw error;
    });
  }
  await cached.indexesPromise;
  return db;
}

module.exports = { getDb };
