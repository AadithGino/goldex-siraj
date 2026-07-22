export function getVatRowLabel(breakup, t) {
  if (breakup?.vat_label) return breakup.vat_label
  if (breakup?.is_zero_rated) return t('product:breakupRow.vatZeroRated')
  const percent = Number(breakup?.vat_percent ?? 0)
  if (percent > 0) return t('product:breakupRow.vatPercent', { percent })
  return t('product:breakupRow.vat')
}
