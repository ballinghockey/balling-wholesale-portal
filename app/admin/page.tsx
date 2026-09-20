import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AdminView from './AdminView'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id, customer_name, is_admin')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!customer?.is_admin) redirect('/catalog')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allOrders } = await admin
    .from('order_requests')
    .select(`order_id, order_date, currency, net_total, grand_total, status, customer_id, shipping_address, order_lines (id, sku, product_name, size, qty, final_unit_price, line_total)`)
    .order('order_date', { ascending: false })

  const { data: customers } = await admin
    .from('customers')
    .select('customer_id, customer_name, contact_name, email_login, country, warehouse, currency, vat_rule, active, customer_type')
    .order('customer_id')

  const { data: customerDiscounts } = await admin
    .from('customer_discounts')
    .select('*')

  const { data: athletes } = await admin
    .from('athletes')
    .select('athlete_id, athlete_name, contact_name, email_login, country, warehouse, currency, active')
    .order('athlete_id')

  const { data: athleteCredits } = await admin
    .from('athlete_credits')
    .select('*')

  const customerMap = new Map((customers ?? []).map((c) => [c.customer_id, { name: c.customer_name, email: c.email_login, isAthlete: false }]))
  const athleteMap = new Map((athletes ?? []).map((a) => [a.athlete_id, { name: a.athlete_name, email: a.email_login, isAthlete: true }]))
  const discountMap = new Map((customerDiscounts ?? []).map((d) => [d.customer_id, d]))
  const creditsMap = new Map((athleteCredits ?? []).map((c) => [c.athlete_id, c]))

  const wholesaleOrders = []
  const athleteOrders = []

  for (const order of allOrders ?? []) {
    const athleteData = athleteMap.get(order.customer_id)
    const customerData = customerMap.get(order.customer_id)
    if (athleteData) {
      athleteOrders.push({ ...order, athleteName: athleteData.name, athleteEmail: athleteData.email })
    } else {
      wholesaleOrders.push({ ...order, customerName: customerData?.name ?? order.customer_id, customerEmail: customerData?.email ?? '' })
    }
  }

  const customersWithDiscounts = (customers ?? [])
    .filter((c) => c.customer_id !== 'master')
    .map((c) => ({ ...c, discounts: discountMap.get(c.customer_id) ?? null }))

  const athletesWithCredits = (athletes ?? []).map((a) => ({
    ...a, credits: creditsMap.get(a.athlete_id) ?? null
  }))

  return (
    <AdminView
      wholesaleOrders={wholesaleOrders}
      athleteOrders={athleteOrders}
      customers={customersWithDiscounts}
      athletes={athletesWithCredits}
    />
  )
}
