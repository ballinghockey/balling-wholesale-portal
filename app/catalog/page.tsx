import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import {
  getCatalogForCustomer,
  getCatalogForAthlete,
  getCustomerForUser,
  getAthleteForUser,
  getAthleteCredits,
  getDraftCartForCustomer,
  getUserType,
} from '@/lib/catalog'
import CatalogView from './CatalogView'
import AthleteCatalogView from './AthleteCatalogView'

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  const userType = await getUserType(authData.user.id)

  if (!userType) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-red-600 mb-2">Account not linked</h1>
        <p className="text-sm text-neutral-600">Please contact your Balling representative.</p>
      </div>
    )
  }

  // ATHLETE flow
  if (userType === 'athlete') {
    const athlete = await getAthleteForUser(authData.user.id)
    if (!athlete) redirect('/login')

    const [groups, credits] = await Promise.all([
      getCatalogForAthlete(athlete),
      getAthleteCredits(athlete.athlete_id),
    ])

    const { data: cartRows } = await supabase
      .from('draft_cart')
      .select('sku, qty, products(category)')
      .eq('customer_id', athlete.athlete_id)

    const usedCredits: Record<string, number> = {}
    for (const row of cartRows ?? []) {
      const cat = (row as any).products?.category?.toLowerCase() ?? ''
      usedCredits[cat] = (usedCredits[cat] ?? 0) + row.qty
    }

    // Calculate total = current available + used in active (non-cancelled) orders
    // This is mathematically stable:
    // - edit qty: available +/-N, order lines -/+N => total unchanged
    // - cancel: credits returned to available, order excluded => total unchanged
    const { data: activeOrders } = await supabase
      .from('order_requests')
      .select('order_id')
      .eq('customer_id', athlete.athlete_id)
      .not('status', 'eq', 'cancelled')

    const activeOrderIds = activeOrders?.map((r: any) => r.order_id) ?? []

    const { data: activeOrderLines } = activeOrderIds.length > 0
      ? await supabase
          .from('order_lines')
          .select('qty, sku, products(category)')
          .in('order_id', activeOrderIds)
      : { data: [] }

    const CREDIT_MAP: Record<string, string> = {
      Sticks: 'sticks', Bags: 'bags', Accessories: 'accessories',
      Apparel: 'apparel', Shoes: 'shoes', Padel: 'padel',
    }

    const usedByCategory: Record<string, number> = {}
    for (const line of activeOrderLines ?? []) {
      const cat = (line.products as any)?.category
      const field = CREDIT_MAP[cat]
      if (field) usedByCategory[field] = (usedByCategory[field] ?? 0) + line.qty
    }

    const currentCredits = credits ?? { sticks: 0, bags: 0, accessories: 0, apparel: 0, shoes: 0, padel: 0 }
    const totalCredits = {
      sticks: (currentCredits.sticks ?? 0) + (usedByCategory.sticks ?? 0),
      bags: (currentCredits.bags ?? 0) + (usedByCategory.bags ?? 0),
      accessories: (currentCredits.accessories ?? 0) + (usedByCategory.accessories ?? 0),
      apparel: (currentCredits.apparel ?? 0) + (usedByCategory.apparel ?? 0),
      shoes: (currentCredits.shoes ?? 0) + (usedByCategory.shoes ?? 0),
      padel: (currentCredits.padel ?? 0) + (usedByCategory.padel ?? 0),
    }

    return (
      <AthleteCatalogView
        groups={groups}
        credits={currentCredits}
        originalCredits={totalCredits}
        usedCredits={usedCredits}
        athleteId={athlete.athlete_id}
        athleteName={athlete.athlete_name}
      />
    )
  }

  // CUSTOMER flow
  const customer = await getCustomerForUser(authData.user.id)
  if (!customer) redirect('/login')

  const [groups, cartMap] = await Promise.all([
    getCatalogForCustomer(customer),
    getDraftCartForCustomer(customer.customer_id),
  ])

  // Fetch loyalty data
  const [{ data: loyaltyData }, { data: loyaltyRule }] = await Promise.all([
    supabase.from('customer_loyalty').select('*').eq('customer_id', customer.customer_id).maybeSingle(),
    supabase.from('loyalty_rules').select('*').eq('customer_id', customer.customer_id).maybeSingle(),
  ])

  const initialCart = Object.fromEntries(cartMap)

  return (
    <CatalogView
      groups={groups}
      initialCart={initialCart}
      loyalty={loyaltyData ? {
        creditBalance: loyaltyData.credit_balance,
        totalSpent: loyaltyData.total_spent,
        currency: loyaltyData.currency as 'GBP' | 'EUR',
        spendThreshold: loyaltyRule?.spend_threshold ?? 500,
        creditAmount: loyaltyRule?.credit_amount ?? 50,
        active: loyaltyRule?.active ?? false,
      } : null}
    />
  )
}
