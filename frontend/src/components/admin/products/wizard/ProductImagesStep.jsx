import { ProductImagesManager } from '@/components/admin/products/ProductImagesManager'

export function ProductImagesStep({ productId, images = [] }) {
  return <ProductImagesManager productId={productId} images={images} />
}
