export function isStorefrontVariantValid(variant) {
  if (!variant || variant.is_active === false) return false

  const fixedPrice = Number(variant.fixed_price)
  const hasFixedPrice = Number.isFinite(fixedPrice) && fixedPrice > 0

  const pricingWeight = Number(variant.effective_weight ?? variant.weight_grams)
  const hasLiveGoldPricing =
    Boolean(variant.purity) &&
    Number.isFinite(pricingWeight) &&
    pricingWeight > 0

  return hasFixedPrice || hasLiveGoldPricing
}
