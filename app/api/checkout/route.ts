import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { items, currency, customerId, customerName } = await req.json()

  if (!items?.length) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 })
  }

  // Fetch VAT rule for this customer
  const { data: customer } = await supabase
    .from('customers')
    .select('vat_rule')
    .eq('customer_id', customerId)
    .single()

  const { data: vatRow } = await supabase
    .from('vat_rules')
    .select('vat_pct')
    .eq('vat_rule', customer?.vat_rule ?? 'EU_EXEMPT')
    .single()

  const vatPct = vatRow?.vat_pct ?? 0

  // Calculate totals
  const listTotal = items.reduce((sum: number, item: any) => sum + item.listPrice * item.qty, 0)
  const netTotal = items.reduce((sum: number, item: any) => sum + item.lineTotal, 0)
  const customerDiscountTotal = listTotal - items.reduce((sum: number, item: any) =>
    sum + item.listPrice * (1 - item.customerDiscountPct / 100) * item.qty, 0)
  const promoDiscountTotal = items.reduce((sum: number, item: any) =>
    sum + item.listPrice * (1 - item.customerDiscountPct / 100) * (item.promoDiscountPct / 100) * item.qty, 0)
  const vatTotal = netTotal * (vatPct / 100)
  const grandTotal = netTotal + vatTotal

  // Create order request
  const orderId = crypto.randomUUID()

  const { error: orderError } = await supabase
    .from('order_requests')
    .insert({
      order_id: orderId,
      customer_id: customerId,
      currency,
      list_total: Math.round(listTotal * 100) / 100,
      customer_discount_total: Math.round(customerDiscountTotal * 100) / 100,
      promo_discount_total: Math.round(promoDiscountTotal * 100) / 100,
      net_total: Math.round(netTotal * 100) / 100,
      vat_total: Math.round(vatTotal * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100,
      status: 'submitted',
    })

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  // Create order lines
  const orderLines = items.map((item: any) => ({
    order_id: orderId,
    sku: item.sku,
    product_name: item.productName,
    size: item.size,
    qty: item.qty,
    list_price: item.listPrice,
    customer_discount_pct: item.customerDiscountPct,
    promo_discount_pct: item.promoDiscountPct,
    final_unit_price: item.finalUnitPrice,
    line_total: item.lineTotal,
  }))

  const { error: linesError } = await supabase
    .from('order_lines')
    .insert(orderLines)

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 })
  }

  // Clear draft cart
  await supabase
    .from('draft_cart')
    .delete()
    .eq('customer_id', customerId)

  return NextResponse.json({ ok: true, orderId })
}
