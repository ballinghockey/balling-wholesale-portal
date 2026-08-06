import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getCustomerForUser } from '@/lib/catalog'
import CartView from './CartView'

export default async function CartPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  const customer = await getCustomerForUser(authData.user.id)
  if (!customer) redirect('/login')

  const { data: cartRows } = await supabase
    .from('draft_cart')
    .select(`sku, qty, products (product_name, category, size, image_url, base_price_gbp, base_price_eur)`)
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

  const today = new Date().toISOString().slice(0, 10)
  const symbol = customer.currency === 'GBP' ? '£' : '€'

  const CATEGORY_DISCOUNT_MAP: Record<string, string> = {
    Sticks: 'sticks_pct', Bags: 'bags_pct', Accessories: 'accessories_pct',
    Apparel: 'apparel_pct', Shoes: 'shoes_pct', Padel: 'apparel_pct',
  }

  const items = (cartRows ?? []).map((row: any) => {
    const p = row.products
    const listPrice = customer.currency === 'GBP' ? p.base_price_gbp : p.base_price_eur
    const discountField = CATEGORY_DISCOUNT_MAP[p.category] ?? 'accessories_pct'
    const customerDiscountPct = discounts?.[discountField] ?? 0
    const activePromo = (promotions ?? []).find((promo: any) =>
      promo.category === p.category && promo.start_date <= today && promo.end_date >= today
    )
    const promoDiscountPct = activePromo?.extra_discount_pct ?? 0
    const finalUnitPrice = listPrice * (1 - customerDiscountPct / 100) * (1 - promoDiscountPct / 100)
    const lineTotal = finalUnitPrice * row.qty

    return {
      sku: row.sku,
      qty: row.qty,
      productName: p.product_name,
      category: p.category,
      size: p.size,
      imageUrl: p.image_url,
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

  return (
    <CartView
      items={items}
      currency={customer.currency as 'GBP' | 'EUR'}
      customerId={customer.customer_id}
      customerName={customer.customer_name}
      vatRule={customer.vat_rule}
    />
  )
}
