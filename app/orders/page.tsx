import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getCustomerForUser } from '@/lib/catalog'
import OrdersView from './OrdersView'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) redirect('/login')

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
    />
  )
}
