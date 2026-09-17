import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminView from './AdminView'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  // Check if user is admin
  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id, customer_name, is_admin')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!customer?.is_admin) redirect('/catalog')

  // Fetch all wholesale orders
  const { data: wholesaleOrders } = await supabase
    .from('order_requests')
    .select(`
      order_id, order_date, currency, net_total, grand_total, status,
      customer_id,
      order_lines (sku, product_name, size, qty, final_unit_price, line_total)
    `)
    .not('customer_id', 'like', 'ATH%')
    .order('order_date', { ascending: false })

  // Fetch customer names for wholesale orders
  const { data: customers } = await supabase
    .from('customers')
    .select('customer_id, customer_name, email_login')

  const customerMap = new Map((customers ?? []).map((c) => [c.customer_id, c]))

  // Fetch all athlete orders
  const { data: athleteOrders } = await supabase
    .from('order_requests')
    .select(`
      order_id, order_date, currency, status, shipping_address,
      customer_id,
      order_lines (sku, product_name, size, qty)
    `)
    .like('customer_id', 'ATH%')
    .order('order_date', { ascending: false })

  // Fetch athlete names
  const { data: athletes } = await supabase
    .from('athletes')
    .select('athlete_id, athlete_name, email_login')

  const athleteMap = new Map((athletes ?? []).map((a) => [a.athlete_id, a]))

  const wholesaleWithNames = (wholesaleOrders ?? []).map((o) => ({
    ...o,
    customerName: customerMap.get(o.customer_id)?.customer_name ?? o.customer_id,
    customerEmail: customerMap.get(o.customer_id)?.email_login ?? '',
  }))

  const athleteWithNames = (athleteOrders ?? []).map((o) => ({
    ...o,
    athleteName: athleteMap.get(o.customer_id)?.athlete_name ?? o.customer_id,
    athleteEmail: athleteMap.get(o.customer_id)?.email_login ?? '',
  }))

  return (
    <AdminView
      wholesaleOrders={wholesaleWithNames}
      athleteOrders={athleteWithNames}
    />
  )
}
