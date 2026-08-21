import { connectToDatabase } from './mongo';
import { ApiProduct, ApiOrder } from './types';

export async function getProductsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ApiProduct>('products');
}

export async function getOrdersCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ApiOrder>('orders');
}

export async function getTenantsCollection() {
  const { db } = await connectToDatabase();
  return db.collection('tenants');
}
