// Motor de pricing — replica la lógica validada en Google Sheets:
// Precio lista -> Descuento cliente (por categoría) -> Promo activa -> Precio final

export type Category = 'Sticks' | 'Bags' | 'Accessories' | 'Apparel' | 'Shoes' | 'Padel'

export type Customer = {
  customer_id: string
  customer_name: string
  warehouse: 'UK' | 'EU'
  currency: 'GBP' | 'EUR'
  vat_rule: string
}

export type CustomerDiscounts = {
  sticks_pct: number
  bags_pct: number
  accessories_pct: number
  apparel_pct: number
  shoes_pct: number
}

export type Promotion = {
  category: string
  extra_discount_pct: number
  start_date: string
  end_date: string
  active: boolean
}

export type Product = {
  sku: string
  product_group: string
  ean: string
  product_name: string
  category: Category
  size: string
  base_price_gbp: number
  base_price_eur: number
  image_url: string
}

const CATEGORY_FIELD_MAP: Record<Category, keyof CustomerDiscounts> = {
  Sticks: 'sticks_pct',
  Bags: 'bags_pct',
  Accessories: 'accessories_pct',
  Apparel: 'apparel_pct',
  Shoes: 'shoes_pct',
  Padel: 'apparel_pct', // temporal: no hay columna padel_pct todavía
}

export function getCustomerDiscountForCategory(
  discounts: CustomerDiscounts,
  category: Category
): number {
  return discounts[CATEGORY_FIELD_MAP[category]] ?? 0
}

export function getActivePromoDiscount(
  promotions: Promotion[],
  category: Category,
  today: Date = new Date()
): number {
  const todayStr = today.toISOString().slice(0, 10)
  return promotions
    .filter(
      (p) =>
        p.active &&
        p.category === category &&
        p.start_date <= todayStr &&
        p.end_date >= todayStr
    )
    .reduce((sum, p) => sum + p.extra_discount_pct, 0)
}

export type PriceBreakdown = {
  listPrice: number
  currency: 'GBP' | 'EUR'
  customerDiscountPct: number
  promoDiscountPct: number
  finalUnitPrice: number
  displayPrice: string
}

export function calculatePrice(
  product: Product,
  customer: Customer,
  discounts: CustomerDiscounts,
  promotions: Promotion[],
  today: Date = new Date()
): PriceBreakdown {
  const listPrice =
    customer.currency === 'GBP' ? product.base_price_gbp : product.base_price_eur

  const customerDiscountPct = getCustomerDiscountForCategory(discounts, product.category)
  const promoDiscountPct = getActivePromoDiscount(promotions, product.category, today)

  const finalUnitPrice =
    listPrice * (1 - customerDiscountPct / 100) * (1 - promoDiscountPct / 100)

  const symbol = customer.currency === 'GBP' ? '£' : '€'

  return {
    listPrice,
    currency: customer.currency,
    customerDiscountPct,
    promoDiscountPct,
    finalUnitPrice: Math.round(finalUnitPrice * 100) / 100,
    displayPrice: `${symbol}${finalUnitPrice.toFixed(2)}`,
  }
}

export type StockStatus = 'Available' | 'Low Stock' | 'Out of Stock'

export function getStockStatus(stock: number): StockStatus {
  if (stock === 0) return 'Out of Stock'
  if (stock < 5) return 'Low Stock'
  return 'Available'
}
