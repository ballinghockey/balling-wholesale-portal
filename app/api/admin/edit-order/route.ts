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
    const { error } = await serviceClient
      .from('order_lines')
      .update({ qty, line_total: qty * unitPrice })
      .eq('id', lineId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (action === 'delete_line') {
    const { data: lineData } = await serviceClient
      .from('order_lines')
      .select('order_id, sku, qty')
      .eq('id', lineId)
      .single()

    const { error } = await serviceClient
      .from('order_lines')
      .delete()
      .eq('id', lineId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (lineData) {
      const { data: order } = await serviceClient
        .from('order_requests')
        .select('customer_id')
        .eq('order_id', lineData.order_id)
        .single()

      if (order) {
        const { data: athlete } = await serviceClient
          .from('athletes')
          .select('athlete_id')
          .eq('athlete_id', order.customer_id)
          .maybeSingle()

        if (athlete) {
          const { data: product } = await serviceClient
            .from('products')
            .select('category')
            .eq('sku', lineData.sku)
            .maybeSingle()

          if (product) {
            const CREDIT_MAP: Record<string, string> = {
              Sticks: 'sticks', Bags: 'bags', Accessories: 'accessories',
              Apparel: 'accessories', Shoes: 'shoes', Padel: 'padel',
            }
            const creditField = CREDIT_MAP[product.category]
            if (creditField) {
              const { data: credits } = await serviceClient
                .from('athlete_credits')
                .select(creditField)
                .eq('athlete_id', athlete.athlete_id)
                .single()

              if (credits) {
                await serviceClient
                  .from('athlete_credits')
                  .update({ [creditField]: ((credits as any)[creditField] ?? 0) + lineData.qty })
                  .eq('athlete_id', athlete.athlete_id)
              }
            }
          }
        }
      }
    }
  }

  if (action === 'add_line') {
    const { error } = await serviceClient
      .from('order_lines')
      .insert({
        order_id: orderId, sku, product_name: productName, size, qty,
        list_price: unitPrice, customer_discount_pct: 0, promo_discount_pct: 0,
        final_unit_price: unitPrice, line_total: qty * unitPrice,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Recalculate order totals
  const { data: allLines } = await serviceClient
    .from('order_lines')
    .select('sku, product_name, size, qty, final_unit_price, line_total')
    .eq('order_id', orderId)

  const netTotal = (allLines ?? []).reduce((sum, l) => sum + (l.line_total ?? 0), 0)

  const { data: orderData } = await serviceClient
    .from('order_requests')
    .select('customer_id, currency, status')
    .eq('order_id', orderId)
    .single()

  // Recalculate VAT based on the order's vat_rule
  const VAT_RATES: Record<string, number> = {
    UK_STANDARD: 0.20,
    ES_STANDARD: 0.21,
    EU_EXEMPT: 0,
    CLUB_INCLUDED: 0,
  }

  const { data: orderForVat } = await serviceClient
    .from('order_requests')
    .select('vat_rule')
    .eq('order_id', orderId)
    .single()

  const vatRate = VAT_RATES[orderForVat?.vat_rule ?? 'EU_EXEMPT'] ?? 0
  const vatTotal = Math.round(netTotal * vatRate * 100) / 100
  const grandTotal = Math.round((netTotal + vatTotal) * 100) / 100

  await serviceClient
    .from('order_requests')
    .update({
      net_total: Math.round(netTotal * 100) / 100,
      vat_total: vatTotal,
      grand_total: grandTotal,
    })
    .eq('order_id', orderId)

  // Send email notification to customer
  if (orderData && process.env.RESEND_API_KEY) {
    const symbol = orderData.currency === 'GBP' ? '£' : '€'
    const ref = orderId.slice(0, 8).toUpperCase()

    // Get customer/athlete email
    let customerEmail: string | null = null
    let customerName = 'there'

    const { data: customer } = await serviceClient
      .from('customers')
      .select('email_login, customer_name')
      .eq('customer_id', orderData.customer_id)
      .maybeSingle()

    if (customer) {
      customerEmail = customer.email_login
      customerName = customer.customer_name
    } else {
      const { data: athlete } = await serviceClient
        .from('athletes')
        .select('email_login, athlete_name')
        .eq('athlete_id', orderData.customer_id)
        .maybeSingle()
      if (athlete) {
        customerEmail = athlete.email_login
        customerName = athlete.athlete_name
      }
    }

    if (customerEmail) {
      const isAthlete = !customer

      const linesHtml = (allLines ?? []).map(l => [
        '<tr>',
        `<td style="padding:8px 16px;font-size:13px;color:#333">${l.product_name} · ${l.size}</td>`,
        `<td style="padding:8px 16px;font-size:13px;color:#333;text-align:center">${l.qty}</td>`,
        !isAthlete ? `<td style="padding:8px 16px;font-size:13px;color:#333;text-align:right">${symbol}${(l.line_total ?? 0).toFixed(2)}</td>` : '',
        '</tr>',
      ].join('')).join('')

      const html = [
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
        '<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">',
        '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">',
        '<div style="background:#000;padding:20px 32px"></div>',
        '<div style="padding:32px">',
        `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">Your order has been updated</h1>`,
        `<p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${customerName}, your order (Ref: <strong>${ref}</strong>) has been modified by our team. Here is the updated order:</p>`,
        '<table style="width:100%;border-collapse:collapse;margin-bottom:24px">',
        '<thead><tr style="background:#f5f5f5">',
        '<th style="padding:8px 16px;font-size:12px;text-align:left;color:#666;text-transform:uppercase">Product</th>',
        '<th style="padding:8px 16px;font-size:12px;text-align:center;color:#666;text-transform:uppercase">Qty</th>',
        !isAthlete ? '<th style="padding:8px 16px;font-size:12px;text-align:right;color:#666;text-transform:uppercase">Total</th>' : '',
        '</tr></thead>',
        `<tbody>${linesHtml}</tbody>`,
        !isAthlete ? `<tfoot><tr><td colspan="2" style="padding:12px 16px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #eee">Subtotal</td><td style="padding:12px 16px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #eee">${symbol}${netTotal.toFixed(2)}</td></tr></tfoot>` : '',
        '</table>',
        '<p style="margin:0 0 8px;color:#555;font-size:13px">If you have any questions about these changes, please contact us.</p>',
        '<div style="border-top:1px solid #eee;padding-top:20px;margin-top:24px;font-size:12px;color:#aaa;text-align:center">',
        'Balling Hockey · Wholesale Portal<br>',
        'Questions? <a href="mailto:admin@ballinghockey.com" style="color:#666">admin@ballinghockey.com</a>',
        '</div></div></div></body></html>',
      ].join('')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ballinghockey.com',
          to: [customerEmail],
          subject: `Your order has been updated · Ref ${ref}`,
          html,
        }),
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// Search/browse products
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

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = serviceClient
    .from('products')
    .select('sku, product_name, product_group, size, base_price_gbp, base_price_eur, category, subcategory')
    .eq('active', true)
    .order('category')
    .order('product_name')

  if (q.length >= 2) {
    query = query.or(`sku.ilike.%${q}%,product_name.ilike.%${q}%`)
  }

  const { data: products } = await query.limit(500)

  return NextResponse.json({ products: products ?? [] })
}
