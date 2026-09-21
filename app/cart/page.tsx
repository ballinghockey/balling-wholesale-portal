import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getCustomerForUser, getAthleteForUser, getUserType } from '@/lib/catalog'
import CartView from './CartView'
import AthleteCartView from './AthleteCartView'

export default async function CartPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  const userType = await getUserType(authData.user.id)
  if (!userType) redirect('/login')

  // ATHLETE CART
  if (userType === 'athlete') {
    const athlete = await getAthleteForUser(authData.user.id)
    if (!athlete) redirect('/login')

    const { data: cartRows } = await supabase
      .from('draft_cart')
      .select(`sku, qty, products (product_name, product_group, category, size, image_url)`)
      .eq('customer_id', athlete.athlete_id)
      .order('sku')

    const productGroups = [...new Set((cartRows ?? []).map((r: any) => r.products?.product_group).filter(Boolean))]
    const groupImageMap = new Map<string, string>()

    if (productGroups.length > 0) {
      const { data: groupProducts } = await supabase
        .from('products')
        .select('product_group, image_url')
        .in('product_group', productGroups)
        .not('image_url', 'is', null)
        .order('image_url')

      for (const gp of groupProducts ?? []) {
        if (!groupImageMap.has(gp.product_group) && gp.image_url) {
          groupImageMap.set(gp.product_group, gp.image_url)
        }
      }
    }

    const items = (cartRows ?? []).map((row: any) => {
      const p = row.products
      return {
        sku: row.sku,
        qty: row.qty,
        productName: p.product_name,
        category: p.category,
        size: p.size,
        imageUrl: groupImageMap.get(p.product_group) ?? p.image_url ?? '',
      }
    })

    return (
      <AthleteCartView
        items={items}
        athleteId={athlete.athlete_id}
        athleteName={athlete.athlete_name}
        warehouse={athlete.warehouse}
      />
    )
  }

  // CUSTOMER CART
  const customer = await getCustomerForUser(authData.user.id)
  if (!customer) redirect('/login')

  const isClub = customer.customer_type === 'club'

  const { data: cartRows } = await supabase
    .from('draft_cart')
    .select(`sku, qty, products (product_name, product_group, category, size, image_url, base_price_gbp, base_price_eur, rrp_gbp, rrp_eur)`)
    .eq('customer_id', customer.customer_id)
    .order('sku')

  const { data: discounts } = await supabase
    .from('customer_discounts')
    .select('*')
    .eq('customer_id', customer.customer_id)
    .single()

  const { data: promotions } = await supabase
    .from('promotions')
    .select('*')
    .eq('active', true)

  const productGroups = [...new Set((cartRows ?? []).map((r: any) => r.products?.product_group).filter(Boolean))]
  const groupImageMap = new Map<string, string>()

  if (productGroups.length > 0) {
    const { data: groupProducts } = await supabase
      .from('products')
      .select('product_group, image_url')
      .in('product_group', productGroups)
      .not('image_url', 'is', null)
      .order('image_url')

    for (const gp of groupProducts ?? []) {
      if (!groupImageMap.has(gp.product_group) && gp.image_url) {
        groupImageMap.set(gp.product_group, gp.image_url)
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const symbol = customer.currency === 'GBP' ? '£' : '€'

  const CATEGORY_DISCOUNT_MAP: Record<string, string> = {
    Sticks: 'sticks_pct', Bags: 'bags_pct', Accessories: 'accessories_pct',
    Apparel: 'apparel_pct', Shoes: 'shoes_pct', Padel: 'apparel_pct',
  }

  const items = (cartRows ?? []).map((row: any) => {
    const p = row.products
    const discountField = CATEGORY_DISCOUNT_MAP[p.category] ?? 'accessories_pct'
    const customerDiscountPct = discounts?.[discountField] ?? 0

    let listPrice: number
    let finalUnitPrice: number
    let promoDiscountPct = 0

    if (isClub) {
      // Club: use RRP as base, apply club discount
      listPrice = customer.currency === 'GBP'
        ? (p.rrp_gbp ?? p.base_price_gbp * 2)
        : (p.rrp_eur ?? p.base_price_eur * 2)
      finalUnitPrice = listPrice * (1 - customerDiscountPct / 100)
    } else {
      // Wholesale: use base price, apply discount + promo
      listPrice = customer.currency === 'GBP' ? p.base_price_gbp : p.base_price_eur
      const activePromo = (promotions ?? []).find((promo: any) =>
        promo.category === p.category && promo.start_date <= today && promo.end_date >= today
      )
      promoDiscountPct = activePromo?.extra_discount_pct ?? 0
      finalUnitPrice = listPrice * (1 - customerDiscountPct / 100) * (1 - promoDiscountPct / 100)
    }

    const lineTotal = finalUnitPrice * row.qty
    const imageUrl = groupImageMap.get(p.product_group) ?? p.image_url ?? ''

    return {
      sku: row.sku,
      qty: row.qty,
      productName: p.product_name,
      category: p.category,
      size: p.size,
      imageUrl,
      listPrice,
      customerDiscountPct,
      promoDiscountPct,
      finalUnitPrice: Math.round(finalUnitPrice * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      currency: customer.currency as 'GBP' | 'EUR',
      displayListPrice: `${symbol}${listPrice.toFixed(2)}`,
      displayFinalPrice: `${symbol}${finalUnitPrice.toFixed(2)}`,
    }
  })

  // Fetch loyalty balance
  const { data: loyaltyData } = await supabase
    .from('customer_loyalty')
    .select('credit_balance')
    .eq('customer_id', customer.customer_id)
    .maybeSingle()

  return (
    <CartView
      items={items}
      currency={customer.currency as 'GBP' | 'EUR'}
      customerId={customer.customer_id}
      customerName={customer.customer_name}
      vatRule={customer.vat_rule}
      loyaltyBalance={loyaltyData?.credit_balance ?? 0}
    />
  )
}
