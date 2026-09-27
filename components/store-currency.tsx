"use client";

import { createContext, useContext } from "react";
import { type Currency, DEFAULT_CURRENCY } from "@/lib/money";

/**
 * The store's currency, for the studio's editors deep inside the product
 * list: every price field, hint and label under it reads this rather than
 * being handed the currency through each layer. Outside a provider it is the
 * dollar, which is what every store charged in before there was a choice.
 */
export const StoreCurrency = createContext<Currency>(DEFAULT_CURRENCY);

export function useStoreCurrency(): Currency {
  return useContext(StoreCurrency);
}
