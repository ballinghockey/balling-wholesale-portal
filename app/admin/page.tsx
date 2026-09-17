import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
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

  // Fetch ALL orders
  const { data: allOrders } = await supabase
    .from('order_requests')
    .select(`
      order_id, order_date, currency, net_total, grand_total, status,
      customer_id, shipping_address,
      order_lines (sku, product_name, size, qty, final_unit_price, line_total)
    `)
    .order('order_date', { ascending: false })

  // Fetch all customers and athletes for name lookup
  const { data: customers } = await supabase
    .from('customers')
    .select('customer_id, customer_name, email_login')

  const { data: athletes } = await supabase
    .from('athletes')
    .select('athlete_id, athlete_name, email_login')

  const customerMap = new Map((customers ?? []).map((c) => [c.customer_id, { name: c.customer_name, email: c.email_login, isAthlete: false }]))
  const athleteMap = new Map((athletes ?? []).map((a) => [a.athlete_id, { name: a.athlete_name, email: a.email_login, isAthlete: true }]))

  const wholesaleOrders = []
  const athleteOrders = []

  for (const order of allOrders ?? []) {
    const athleteData = athleteMap.get(order.customer_id)
    const customerData = customerMap.get(order.customer_id)

    if (athleteData) {
      athleteOrders.push({
        ...order,
        athleteName: athleteData.name,
        athleteEmail: athleteData.email,
      })
    } else {
      wholesaleOrders.push({
        ...order,
        customerName: customerData?.name ?? order.customer_id,
        customerEmail: customerData?.email ?? '',
      })
    }
  }

  return (
    <AdminView
      wholesaleOrders={wholesaleOrders}
      athleteOrders={athleteOrders}
    />
  )
}
