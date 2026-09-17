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

    // Get current cart to calculate used credits
    const { data: cartRows } = await supabase
      .from('draft_cart')
      .select('sku, qty, products(category)')
      .eq('customer_id', athlete.athlete_id)

    const usedCredits: Record<string, number> = {}
    for (const row of cartRows ?? []) {
      const cat = (row as any).products?.category?.toLowerCase() ?? ''
      usedCredits[cat] = (usedCredits[cat] ?? 0) + row.qty
    }

    return (
      <AthleteCatalogView
        groups={groups}
        credits={credits ?? { sticks: 0, bags: 0, accessories: 0, apparel: 0, shoes: 0, padel: 0 }}
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

  const initialCart = Object.fromEntries(cartMap)

  return <CatalogView groups={groups} initialCart={initialCart} />
} 
