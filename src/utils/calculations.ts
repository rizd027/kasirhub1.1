/**
 * Calculates tiered discount based on the formula:
 * ((Price * (1 - Disc1%)) * (1 - Disc2%)) - FixedAmount
 */
export const calculateTieredDiscount = (
  price: number,
  disc1Percent: number = 0,
  disc2Percent: number = 0,
  fixedAmount: number = 0
): number => {
  const afterDisc1 = price * (1 - disc1Percent / 100);
  const afterDisc2 = afterDisc1 * (1 - disc2Percent / 100);
  const finalPrice = Math.max(0, afterDisc2 - fixedAmount);
  return finalPrice;
};

export const calculateTotalDiscount = (
  price: number,
  disc1Percent: number = 0,
  disc2Percent: number = 0,
  fixedAmount: number = 0
): number => {
  const finalPrice = calculateTieredDiscount(price, disc1Percent, disc2Percent, fixedAmount);
  return price - finalPrice;
};
