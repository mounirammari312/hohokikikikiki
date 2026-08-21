export interface TrackingStep {
  title: string;
  description: string;
  date: string;
  completed: boolean;
}

export function getTrackingDetails(trackingNumber: string): TrackingStep[] {
  return [
    {
      title: 'تم استلام الطلب',
      description: 'تم تسجيل طلبك بنجاح وجارٍ التجهيز في المستودع',
      date: 'اليوم، 10:30 صباحاً',
      completed: true,
    },
    {
      title: 'تأكيد الطلب وشحنه',
      description: 'تم تسليم الطرد لشركة التوصيل في اتجاه ولايتك',
      date: 'اليوم، 02:15 مساءً',
      completed: true,
    },
    {
      title: 'في الطريق إليك',
      description: 'الطرد مع مندوب التوصيل في منطقتك',
      date: 'قيد التنفيذ',
      completed: false,
    },
    {
      title: 'تم التسليم والدفع',
      description: 'استلام الطرد والدفع نقداً عند الباب',
      date: 'المتوقع غداً',
      completed: false,
    }
  ];
}
