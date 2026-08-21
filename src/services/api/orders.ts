import { Order } from './types';

const STORAGE_KEY = 'amugar_orders_db';

export async function getOrders(): Promise<Order[]> {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading orders:', e);
  }
  return [];
}

export async function createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<Order> {
  const orders = await getOrders();
  const newOrder: Order = {
    ...orderData,
    id: `ORD-${Date.now().toString().slice(-6)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    trackingNumber: `ALG-${Math.floor(100000 + Math.random() * 900000)}`,
  };
  orders.unshift(newOrder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  return newOrder;
}
