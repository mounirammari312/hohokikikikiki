export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  customDomain?: string;
  currency: string;
  phone?: string;
}

export interface ApiProduct {
  _id?: string;
  id: string;
  tenantId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating?: number;
  salesCount?: number;
  isChoice?: boolean;
  isFlashDeal?: boolean;
}

export interface ApiOrder {
  _id?: string;
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  commune: string;
  totalPrice: number;
  shippingPrice: number;
  status: string;
  createdAt: string;
}
