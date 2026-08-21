import { IncomingMessage, ServerResponse } from 'http';
import { connectToDatabase } from './lib/mongo';
import { getProductsCollection, getOrdersCollection } from './lib/models';
import { resolveTenantFromHost } from './lib/tenant';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = req.url || '/';

  try {
    if (url.startsWith('/api/health')) {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      return;
    }

    if (url.startsWith('/api/products')) {
      const collection = await getProductsCollection();
      const products = await collection.find({}).limit(50).toArray();
      res.statusCode = 200;
      res.end(JSON.stringify(products));
      return;
    }

    if (url.startsWith('/api/orders') && req.method === 'GET') {
      const collection = await getOrdersCollection();
      const orders = await collection.find({}).sort({ createdAt: -1 }).limit(50).toArray();
      res.statusCode = 200;
      res.end(JSON.stringify(orders));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
  }
}
