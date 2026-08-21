export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  rating?: number;
  reviewsCount?: number;
  salesCount?: number;
  storeName?: string;
  storeId?: string;
  isChoice?: boolean;
  isFlashDeal?: boolean;
  stockLeft?: number;
  freeShipping?: boolean;
  description?: string;
  colors?: string[];
  sizes?: string[];
  inStock?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  color?: string;
  size?: string;
}

export interface Order {
  id: string;
  tenantId?: string;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  commune: string;
  address: string;
  items: OrderItem[];
  totalPrice: number;
  shippingPrice: number;
  deliveryType: 'home' | 'desk';
  deliveryProvider?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  createdAt: string;
}

export interface WilayaDeliveryPrice {
  id: number;
  name: string;
  ar_name: string;
  homePrice: number;
  deskPrice: number;
  available: boolean;
}
