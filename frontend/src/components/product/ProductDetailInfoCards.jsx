import { useTranslation } from 'react-i18next'
import { Award, Coins, Info, Ruler } from 'lucide-react'
import { formatMetalTypeLabel, getSizeTypeMeta } from '@/lib/i18nLabels'
import { certificatesForVariant } from '@/lib/certificates'
import { DetailCard } from '@/components/product/DetailCard'
import { useContentLang } from '@/hooks/useContentLang'
import { pickField } from '@/lib/contentLocale'

export function ProductDetailInfoCards({ product, variant, certificates = [] }) {
  const { t } = useTranslation('product')
  const lang = useContentLang()
  if (!product || !variant) return null

  const metalLabel = formatMetalTypeLabel(product.purity, product.metal_type, t)
  const metalColorLabel = product.metal_color
    ? t(`metalColorValues.${product.metal_color}`, { defaultValue: product.metal_color })
    : null
  const brandName = product?.brands ? pickField(product.brands, 'name', lang) : null
  const sizeMeta = getSizeTypeMeta(variant.size_type, t)
  const certs = certificatesForVariant(certificates, variant.id)
  const certLabels = certs.map((c) => c.authority).filter(Boolean)

  const stones = variant.product_stones || []
  const stoneCount = stones.reduce((s, r) => s + (Number(r.stone_count) || 0), 0)
  const stoneSummary =
    stoneCount > 0
      ? t('stoneCount', { count: stoneCount })
      : variant.stone_type && variant.stone_type !== 'none'
        ? variant.stone_type
        : null

  const stockQty = variant.stock_qty

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
      <DetailCard
        icon={Info}
        title={t('basicInformation')}
        rows={[
          { label: t('sku'), value: variant.sku },
          {
            label: t('qtyLabel'),
            value:
              stockQty != null
                ? stockQty > 0
                  ? String(stockQty)
                  : t('outOfStock')
                : t('available'),
          },
          ...(product.is_featured ? [{ label: t('collectionLabel'), value: t('featuredBadge') }] : []),
          ...(product.is_customizable ? [{ label: t('optionsLabel'), value: t('customizableBadge') }] : []),
          ...(product.is_customizable && product.customization_note
            ? [{ label: t('customizationLabel'), value: product.customization_note }]
            : []),
        ]}
      />

      <DetailCard
        icon={Coins}
        title={t('metalInformation')}
        rows={[
          { label: t('metal'), value: metalLabel },
          { label: t('metalColor'), value: metalColorLabel },
          { label: t('brand'), value: brandName },
          {
            label: t('itemNetWeight'),
            value:
              variant.weight_grams != null ? Number(variant.weight_grams).toFixed(3) : null,
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:gap-4">
        <DetailCard
          icon={Ruler}
          title={t('productDimension')}
          rows={[
            { label: sizeMeta.label, value: variant.size || null },
            {
              label: t('height'),
              value: variant.height_mm != null ? `${Number(variant.height_mm)} mm` : null,
            },
            {
              label: t('width'),
              value: variant.width_mm != null ? `${Number(variant.width_mm)} mm` : null,
            },
            { label: t('stones'), value: stoneSummary },
          ]}
        />

        {certLabels.length > 0 && (
          <DetailCard
            icon={Award}
            title={t('certificationDetails')}
            rows={certLabels.map((label, i) => ({
              label: i === 0 ? t('certificationLabel') : t('alsoLabel'),
              value: label,
            }))}
          />
        )}
      </div>
    </div>
  )
}
