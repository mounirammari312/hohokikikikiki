import React from 'react';
import { EnhancedProductCard } from './marketplace/EnhancedProductCard';
import { Product } from '../services/api/types';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  return <EnhancedProductCard product={product} />;
};

export default ProductCard;
