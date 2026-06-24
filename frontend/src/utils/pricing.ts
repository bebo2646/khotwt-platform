export interface CourseForPricing {
  price: string | number;
  enable_discount?: boolean;
  enableDiscount?: boolean;
  discount_type?: 'percentage' | 'fixed' | null;
  discountType?: 'percentage' | 'fixed' | null;
  discount_value?: string | number | null;
  discountValue?: string | number | null;
  final_price?: string | number | null;
  finalPrice?: string | number | null;
}

export interface DisplayPriceInfo {
  originalPrice: number;
  finalPrice: number;
  hasDiscount: boolean;
  discountText: string;
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  formattedOriginalPrice: string;
  formattedFinalPrice: string;
}

export function getCourseDisplayPrice(course: CourseForPricing): DisplayPriceInfo {
  const price = parseFloat(course.price?.toString() || '0');
  const enableDiscount = course.enable_discount ?? course.enableDiscount ?? false;
  const discountType = course.discount_type ?? course.discountType ?? 'percentage';
  const discountVal = parseFloat(course.discount_value?.toString() ?? course.discountValue?.toString() ?? '0');
  
  let finalPrice = price;
  
  if (enableDiscount) {
    if (discountType === 'percentage') {
      finalPrice = Math.round(price * (1 - (discountVal / 100)) * 100) / 100;
    } else if (discountType === 'fixed') {
      finalPrice = Math.max(0, Math.round((price - discountVal) * 100) / 100);
    }
  }
  
  const formattedOriginalPrice = price === 0 ? 'مجاني' : `${price} ج.م`;
  const formattedFinalPrice = finalPrice === 0 ? 'مجاني' : `${finalPrice} ج.م`;
  const discountText = discountType === 'percentage' ? `${discountVal}% خصم` : `${discountVal} ج.م خصم`;
  
  return {
    originalPrice: price,
    finalPrice,
    hasDiscount: enableDiscount,
    discountText,
    discountValue: discountVal,
    discountType,
    formattedOriginalPrice,
    formattedFinalPrice,
  };
}
