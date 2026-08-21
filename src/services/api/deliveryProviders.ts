export interface DeliveryProvider {
  id: string;
  name: string;
  nameAr: string;
  logo: string;
  trackingUrl: string;
  enabled: boolean;
}

export const DELIVERY_PROVIDERS: DeliveryProvider[] = [
  {
    id: 'yalidine',
    name: 'Yalidine Express',
    nameAr: 'ياليدين إكسبريس',
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
    trackingUrl: 'https://yalidine.app/tracking',
    enabled: true,
  },
  {
    id: 'zrexpress',
    name: 'ZR Express',
    nameAr: 'زد آر إكسبريس',
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
    trackingUrl: 'https://zrexpress.com/track',
    enabled: true,
  },
  {
    id: 'procolis',
    name: 'Procolis',
    nameAr: 'بروكوليس',
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
    trackingUrl: 'https://procolis.com',
    enabled: true,
  }
];
