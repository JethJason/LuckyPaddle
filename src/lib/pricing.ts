import {
  MULTI_HOUR_DISCOUNT,
  MULTI_HOUR_DISCOUNT_START_HOUR,
  MULTI_HOUR_MIN,
  PRICE_PER_HOUR,
} from "./config";
import type { TimeRate } from "./store";

export type PriceBreakdown = {
  hours: number;
  base: number;
  discount: number;
  discountPerHour: number;
  total: number;
};

export function getRateForHour(hour: number, rates: TimeRate[]): number {
  for (const rate of rates) {
    if (hour >= rate.start && hour < rate.end) return rate.price;
  }
  return PRICE_PER_HOUR;
}

export function getPriceBreakdown(fromHour: number, toHour: number, rates: TimeRate[]): PriceBreakdown {
  const hours = Math.max(0, toHour - fromHour);
  const discountEligible = hours >= MULTI_HOUR_MIN;
  const discountPerHour = discountEligible ? MULTI_HOUR_DISCOUNT : 0;
  let base = 0;
  let total = 0;

  for (let h = fromHour; h < toHour; h++) {
    const price = getRateForHour(h, rates);
    const hourDiscount = discountEligible && h >= MULTI_HOUR_DISCOUNT_START_HOUR
      ? MULTI_HOUR_DISCOUNT
      : 0;
    base += price;
    total += Math.max(0, price - hourDiscount);
  }

  return { hours, base, discount: base - total, discountPerHour, total };
}

export function getPriceForRange(fromHour: number, toHour: number, rates: TimeRate[]): number {
  return getPriceBreakdown(fromHour, toHour, rates).total;
}
