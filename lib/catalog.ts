import { createClient } from '@/lib/supabase-server'
import {
  calculatePrice,
  getStockStatus,
  type Category,
  type Customer,
  type CustomerDiscounts,
  type Product,
  type Promotion,
} from '@/lib/pricing'

export type SizeVariant = {
  sku: string
  ean: string
  size: string
  stock: number
  stockStatus: ReturnType<typeof getStockStatus>
  listPrice: number
  finalUnitPrice: number
  displayPrice: string
  currency: 'GBP' | 'EUR'
  customerDiscountPct: number
  promoDiscountPct: number
}

export type ProductGroupWithVariants = {
  productGroup: string
  productName: string
  category: Category
  imageUrl: string
  variants: SizeVariant[]
}

export async function getCustomerForUser(authUserId: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name, warehouse, currency, vat_rule')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !data) return null
  return data as Customer
}

export async function getCatalogForCustomer(
  customer: Customer
): Promise<ProductGroupWithVariants[]> {
  const supabase = await createClient()

  const [{ data: products }, { data: discountsRow }, { data: promotions }, { data: stockRows }] =
    await Promise.all([
      supabase.from('products').select('*').eq('active', true),
      supabase
        .from('customer_discounts')
        .select('*')
        .eq('customer_id', customer.customer_id)
        .single(),
      supabase.from('promotions').select('*'),
      supabase
        .from(customer.warehouse === 'UK' ? 'stock_uk' : 'stock_eu')
        .select('sku, stock'),
    ])

  if (!products || !discountsRow) return []

  const discounts = discountsRow as CustomerDiscounts
  const stockMap = new Map((stockRows ?? []).map((r) => [r.sku, r.stock as number]))
  const promoList = (promotions ?? []) as Promotion[]

  const groups = new Map<string, ProductGroupWithVariants>()

  for (const p of products as Product[]) {
    const price = calculatePrice(p, customer, discounts, promoList)
    const stock = stockMap.get(p.sku) ?? 0

    const variant: SizeVariant = {
      sku: p.sku,
      ean: p.ean,
      size: p.size,
      stock,
      stockStatus: getStockStatus(stock),
      listPrice: price.listPrice,
      finalUnitPrice: price.finalUnitPrice,
      displayPrice: price.displayPrice,
      currency: price.currency,
      customerDiscountPct: price.customerDiscountPct,
      promoDiscountPct: price.promoDiscountPct,
    }

    const existing = groups.get(p.product_group)
    if (existing) {
      existing.variants.push(variant)
    } else {
      groups.set(p.product_group, {
        productGroup: p.product_group,
        productName: p.product_name,
        category: p.category,
        imageUrl: p.image_url,
        variants: [variant],
      })
    }
  }

  // Ordenar talles dentro de cada grupo de forma natural
  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }))
  }

  return Array.from(groups.values()).sort((a, b) => a.productName.localeCompare(b.productName))
}

export async function getDraftCartForCustomer(customerId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('draft_cart')
    .select('sku, qty')
    .eq('customer_id', customerId)

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    map.set(row.sku, row.qty)
  }
  return map
}
