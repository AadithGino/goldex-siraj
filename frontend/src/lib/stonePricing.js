import { formatAED } from '@/lib/pricing'

/** Compute stone charge from a stone_rates row and variant carat weight */
export function computeStoneCharge(rate, stoneWeightCarat) {
  if (!rate) return 0
  const unitRate = Number(rate.rate_per_unit) || 0
  if (rate.unit === 'piece') return unitRate
  const weight = Number(stoneWeightCarat) || 0
  return Math.round(unitRate * weight * 100) / 100
}

/** Compute charge for one product_stones row */
export function computeStoneLineCharge(rate, stone) {
  if (!rate) return Number(stone.charge) || 0
  const unitRate = Number(rate.rate_per_unit) || 0
  const count = Number(stone.stone_count) || 1
  if (rate.unit === 'piece') {
    return Math.round(unitRate * count * 100) / 100
  }
  const weight = Number(stone.stone_weight_carat) || 0
  return Math.round(unitRate * weight * 100) / 100
}

export const DEFAULT_PRODUCT_STONE = {
  label: '',
  stone_rate_id: '',
  pricing_mode: 'rate',
  stone_type: '',
  grade: null,
  unit: 'piece',
  stone_count: 1,
  shape: 'Round',
  size_mm: '',
  setting_type: 'Cap',
  stone_weight_carat: '',
  weight: '',
  manual_charge: '',
  charge: 0,
}

export function formatStoneRateLabel(rate) {
  if (!rate) return ''
  const unit = rate.unit === 'piece' ? 'piece' : 'ct'
  return `${rate.stone_type} · ${rate.grade} · ${formatAED(rate.rate_per_unit)}/${unit}`
}
