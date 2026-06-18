export function getVariantUnitPrice(basePrice: number, variant?: { extra_price?: number | string | null } | null) {
  const variantPrice = Number(variant?.extra_price || 0);
  return variantPrice > 0 ? variantPrice : Number(basePrice || 0);
}

export function getVariantPriceInput(basePrice: number | string, variantPrice?: number | string | null) {
  const price = Number(variantPrice || 0);
  return price > 0 ? String(price) : String(basePrice || "0");
}