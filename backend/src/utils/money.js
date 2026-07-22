export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

export const nonNegativeMoney = (value) => Math.max(0, roundMoney(value))
