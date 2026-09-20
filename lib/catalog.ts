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
  subcategory: string
  sortOrder: number
  imageUrl: string
  onSale: boolean
  variants: SizeVariant[]
}

export type UserType = 'customer' | 'athlete' | null

export type AthleteProfile = {
  athlete_id: string
  athlete_name: string
  warehouse: 'UK' | 'EU'
  currency: 'GBP' | 'EUR'
}

export type AthleteCredits = {
  sticks: number
  bags: number
  accessories: number
  apparel: number
  shoes: number
  padel: number
}

// Detect whether the logged-in user is a customer or athlete
export async function getUserType(authUserId: string): Promise<UserType> {
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (customer) return 'customer'

  const { data: athlete } = await supabase
    .from('athletes')
    .select('athlete_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (athlete) return 'athlete'

  return null
}

export async function getCustomerForUser(authUserId: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name, warehouse, currency, vat_rule, customer_type')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !data) return null
  return data as Customer
}

export async function getAthleteForUser(authUserId: string): Promise<AthleteProfile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('athlete_id, athlete_name, warehouse, currency')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !data) return null
  return data as AthleteProfile
}

export async function getAthleteCredits(athleteId: string): Promise<AthleteCredits | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_credits')
    .select('*')
    .eq('athlete_id', athleteId)
    .single()

  if (error || !data) return null
  return data as AthleteCredits
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

  for (const p of products as (Product & { subcategory?: string; sort_order?: number; on_sale?: boolean })[]) {
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
        subcategory: p.subcategory ?? '',
        sortOrder: p.sort_order ?? 0,
        imageUrl: p.image_url,
        onSale: p.on_sale ?? false,
        variants: [variant],
      })
    }
  }

  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }))
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    // Within same subcategory: sort by price descending (highest first)
    const priceA = a.variants[0]?.listPrice ?? 0
    const priceB = b.variants[0]?.listPrice ?? 0
    if (priceB !== priceA) return priceB - priceA
    return a.productName.localeCompare(b.productName)
  })
}

// Catalog for athletes — same products but no pricing info needed
export async function getCatalogForAthlete(
  athlete: AthleteProfile
): Promise<ProductGroupWithVariants[]> {
  const supabase = await createClient()

  const [{ data: products }, { data: stockRows }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true),
    supabase
      .from(athlete.warehouse === 'UK' ? 'stock_uk' : 'stock_eu')
      .select('sku, stock'),
  ])

  if (!products) return []

  const stockMap = new Map((stockRows ?? []).map((r) => [r.sku, r.stock as number]))
  const groups = new Map<string, ProductGroupWithVariants>()

  for (const p of products as (Product & { subcategory?: string; sort_order?: number; on_sale?: boolean })[]) {
    const stock = stockMap.get(p.sku) ?? 0

    const variant: SizeVariant = {
      sku: p.sku,
      ean: p.ean,
      size: p.size,
      stock,
      stockStatus: getStockStatus(stock),
      // Athletes don't see prices — use base price for sorting only
      listPrice: athlete.currency === 'GBP' ? (p.base_price_gbp ?? 0) : (p.base_price_eur ?? 0),
      finalUnitPrice: 0,
      displayPrice: '',
      currency: athlete.currency,
      customerDiscountPct: 0,
      promoDiscountPct: 0,
    }

    const existing = groups.get(p.product_group)
    if (existing) {
      existing.variants.push(variant)
    } else {
      groups.set(p.product_group, {
        productGroup: p.product_group,
        productName: p.product_name,
        category: p.category as Category,
        subcategory: p.subcategory ?? '',
        sortOrder: p.sort_order ?? 0,
        imageUrl: p.image_url,
        onSale: p.on_sale ?? false,
        variants: [variant],
      })
    }
  }

  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }))
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    // Within same subcategory: sort by base price descending (highest first)
    const priceA = a.variants[0]?.listPrice ?? 0
    const priceB = b.variants[0]?.listPrice ?? 0
    if (priceB !== priceA) return priceB - priceA
    return a.productName.localeCompare(b.productName)
  })
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
