import { STORAGE_KEYS, load, save, generateId } from './db'
import type { Order, OrderItem, OrderStatus } from './types'
import { getWilayas } from './wilayas'

export function getOrders(): Order[] { return load<Order[]>(STORAGE_KEYS.ORDERS, []) }

export function createOrder(data: Omit<Order,'_id'|'orderNumber'|'createdAt'|'updatedAt'|'status'| 'wilayaNameAr'> & {wilayaNameAr?:string}): Order {
  const orders = getOrders()
  const wilayas = getWilayas()
  const w = wilayas.find(x=>x.code===data.wilaya || x.nameAr===data.wilaya)
  const wilayaNameAr = data.wilayaNameAr || w?.nameAr || data.wilaya
  const existingSignature = `${data.phone}-${data.items.map(i=>i.productId+":"+i.qty).join(',')}`
  const duplicate = orders.find(o=> `${o.phone}-${o.items.map(i=>i.productId+":"+i.qty).join(',')}`===existingSignature && Date.now() - new Date(o.createdAt).getTime() < 1000*60*30)
  if(duplicate) throw new Error('DUPLICATE_ORDER')

  const order: Order = {
    _id: generateId(),
    orderNumber: "LUM-"+ (1000+orders.length+1).toString(),
    customerName: data.customerName,
    phone: data.phone,
    phone2: data.phone2,
    wilaya: w?.code || data.wilaya,
    wilayaNameAr,
    commune: data.commune,
    address: data.address,
    deliveryType: data.deliveryType,
    items: data.items,
    subtotal: data.subtotal,
    discount: data.discount,
    shippingCost: data.shippingCost,
    total: data.total,
    status: 'new',
    notes: data.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  orders.unshift(order)
  save(STORAGE_KEYS.ORDERS, orders)
  return order
}

export function updateOrderStatus(id:string, status: OrderStatus){
  const orders = getOrders()
  const idx = orders.findIndex(o=>o._id===id)
  if(idx>=0){ orders[idx].status = status; orders[idx].updatedAt = new Date().toISOString(); save(STORAGE_KEYS.ORDERS, orders)}
  return orders
}
export function deleteOrder(id:string){
  const orders = getOrders().filter(o=>o._id!==id); save(STORAGE_KEYS.ORDERS, orders); return orders
}

export function exportOrdersCsv(orders: Order[]): string {
  const header = ["رقم الطلب","الاسم","الهاتف","الولاية","البلدية","المنتجات","الكمية","المجموع","الشحن","الإجمالي","الحالة","التاريخ"]
  const rows = orders.map(o=>[o.orderNumber,o.customerName,o.phone,o.wilayaNameAr,o.commune, o.items.map(i=>i.nameAr).join(' | '), o.items.reduce((a,b)=>a+b.qty,0), o.subtotal, o.shippingCost, o.total, o.status, new Date(o.createdAt).toLocaleDateString('ar-DZ')])
  const csv = [header, ...rows].map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  return csv
}
