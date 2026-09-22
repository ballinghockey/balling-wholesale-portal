import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('customers')
    .select('is_admin')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!admin?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, orderId, lineId, sku, qty, productName, size, unitPrice } = await req.json()

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (action === 'update_qty') {
    // Update quantity of existing line
    const { error } = await serviceClient
      .from('order_lines')
      .update({
        qty,
        line_total: qty * unitPrice,
      })
      .eq('id', lineId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (action === 'delete_line') {
    // Remove a line from the order
    const { error } = await serviceClient
      .from('order_lines')
      .delete()
      .eq('id', lineId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (action === 'add_line') {
    // Add a new product line to the order
    const { error } = await serviceClient
      .from('order_lines')
      .insert({
        order_id: orderId,
        sku,
        product_name: productName,
        size,
        qty,
        list_price: unitPrice,
        customer_discount_pct: 0,
        promo_discount_pct: 0,
        final_unit_price: unitPrice,
        line_total: qty * unitPrice,
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Recalculate order totals
  const { data: lines } = await serviceClient
    .from('order_lines')
    .select('line_total')
    .eq('order_id', orderId)

  const netTotal = (lines ?? []).reduce((sum, l) => sum + (l.line_total ?? 0), 0)

  await serviceClient
    .from('order_requests')
    .update({
      net_total: Math.round(netTotal * 100) / 100,
      grand_total: Math.round(netTotal * 100) / 100,
    })
    .eq('order_id', orderId)

  return NextResponse.json({ ok: true })
}

// Search products
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('customers')
    .select('is_admin')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!admin?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''

  if (q.length < 2) return NextResponse.json({ products: [] })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // If query is short (catalog browse mode), return all products grouped
  let query = serviceClient
    .from('products')
    .select('sku, product_name, product_group, size, base_price_gbp, base_price_eur, category')
    .eq('active', true)

  if (q.length >= 2) {
    query = query.or(`sku.ilike.%${q}%,product_name.ilike.%${q}%`)
  }

  const { data: products } = await query.order('category').order('product_name').limit(500)

  return NextResponse.json({ products: products ?? [] })
}
