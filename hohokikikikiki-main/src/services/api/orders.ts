/**
 * Orders service.
 *
 * Sync API reads from an in-memory cache kept fresh by syncOrders().
 * Mutations go through the async `*Api` helpers in ./client.
 */

import type { Order, OrderStatus } from './types'
import {
  fetchOrders, fetchOrderByNumber, createOrderApi,
  updateOrderStatusApi, deleteOrderApi,
} from './client'

let cache: Order[] = []
let loaded = false

export async function syncOrders(): Promise<Order[]> {
  try {
    const list = await fetchOrders()
    cache = list
    loaded = true
    return list
  } catch {
    loaded = true
    return cache
  }
}

export function getOrders(): Order[] {
  if (!loaded) void syncOrders()
  return cache
}

export async function getOrder(orderNumber: string): Promise<Order | undefined> {
  // Try the cache first (cheap), then the API
  const fromCache = cache.find(o => o.orderNumber === orderNumber)
  if (fromCache) return fromCache
  return await fetchOrderByNumber(orderNumber)
}

export async function createOrder(
  data: Omit<Order,'_id'|'orderNumber'|'createdAt'|'updatedAt'|'status'| 'wilayaNameAr'> & {wilayaNameAr?:string}
): Promise<Order> {
  try {
    const order = await createOrderApi(data)
    cache = [order, ...cache]
    return order
  } catch (err: any) {
    if (err?.message === 'DUPLICATE_ORDER' || err?.body?.error === 'DUPLICATE_ORDER') {
      throw new Error('DUPLICATE_ORDER')
    }
    throw err
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order[]> {
  const list = await updateOrderStatusApi(id, status)
  cache = list
  return list
}

export async function deleteOrder(id: string): Promise<Order[]> {
  const list = await deleteOrderApi(id)
  cache = list
  return list
}

export function exportOrdersCsv(orders: Order[]): string {
  const header = ["رقم الطلب","الاسم","الهاتف","الولاية","البلدية","المنتجات","الكمية","المجموع","الشحن","الإجمالي","الحالة","التاريخ"]
  const rows = orders.map(o => [
    o.orderNumber, o.customerName, o.phone, o.wilayaNameAr, o.commune,
    o.items.map(i => i.nameAr).join(' | '),
    o.items.reduce((a, b) => a + b.qty, 0),
    o.subtotal, o.shippingCost, o.total, o.status,
    new Date(o.createdAt).toLocaleDateString('ar-DZ')
  ])
  return [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}
