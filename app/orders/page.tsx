import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getCustomerForUser, getAthleteForUser, getUserType } from '@/lib/catalog'
import OrdersView from './OrdersView'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

  const userType = await getUserType(authData.user.id)
  if (!userType) redirect('/login')

  // Check if admin — redirect to admin panel
  const { data: adminCheck } = await supabase
    .from('customers')
    .select('is_admin')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (adminCheck?.is_admin) redirect('/admin')

  // ATHLETE
  if (userType === 'athlete') {
    const athlete = await getAthleteForUser(authData.user.id)
    if (!athlete) redirect('/login')

    const { data: orders } = await supabase
      .from('order_requests')
      .select(`
        order_id,
        order_date,
        currency,
        net_total,
        grand_total,
        vat_total,
        status,
        order_lines (
          id,
          sku,
          product_name,
          size,
          qty,
          list_price,
          customer_discount_pct,
          promo_discount_pct,
          final_unit_price,
          line_total
        )
      `)
      .eq('customer_id', athlete.athlete_id)
      .order('order_date', { ascending: false })

    return (
      <OrdersView
        orders={orders ?? []}
        currency={athlete.currency as 'GBP' | 'EUR'}
        customerName={athlete.athlete_name}
        isAthlete={true}
      />
    )
  }

  // CUSTOMER
  const customer = await getCustomerForUser(authData.user.id)
  if (!customer) redirect('/login')

  const { data: orders } = await supabase
    .from('order_requests')
    .select(`
      order_id,
      order_date,
      currency,
      net_total,
      grand_total,
      vat_total,
      status,
      order_lines (
        id,
        sku,
        product_name,
        size,
        qty,
        list_price,
        customer_discount_pct,
        promo_discount_pct,
        final_unit_price,
        line_total
      )
    `)
    .eq('customer_id', customer.customer_id)
    .order('order_date', { ascending: false })

  return (
    <OrdersView
      orders={orders ?? []}
      currency={customer.currency as 'GBP' | 'EUR'}
      customerName={customer.customer_name}
      isAthlete={false}
    />
  )
}
