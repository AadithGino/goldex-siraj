const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

export function previewCustomQuote({
  weight,
  rate,
  makingType = 'percent',
  makingValue = 0,
  wastagePercent = 0,
  stoneCharge = 0,
  vatPercent = 0,
  taxMode = 'exclusive',
}) {
  const goldValue = roundMoney(Number(weight || 0) * Number(rate || 0))
  const wastageAmount = roundMoney(goldValue * (Number(wastagePercent) || 0) / 100)
  const makingCharge = makingType === 'flat'
    ? roundMoney(Number(makingValue) || 0)
    : roundMoney(goldValue * (Number(makingValue) || 0) / 100)
  const stone = roundMoney(Number(stoneCharge) || 0)
  const subtotal = roundMoney(goldValue + wastageAmount + makingCharge + stone)
  const vatAmount = !vatPercent
    ? 0
    : roundMoney(
      taxMode === 'inclusive'
        ? subtotal * Number(vatPercent) / (100 + Number(vatPercent))
        : subtotal * Number(vatPercent) / 100,
    )
  const total = taxMode === 'inclusive' ? subtotal : roundMoney(subtotal + vatAmount)
  return { goldValue, wastageAmount, makingCharge, stone, subtotal, vatAmount, total }
}
