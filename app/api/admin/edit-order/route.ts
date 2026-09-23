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

  const body = await req.json()
  const { action, orderId, lineId, sku, qty, productName, size, unitPrice } = body
  console.log('[edit-order] action:', action, 'orderId:', orderId, 'sku:', sku, 'qty:', qty)

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
              // Get current credits
              const { data: credits } = await serviceClient
                .from('athlete_credits')
                .select('sticks, bags, accessories, shoes, padel')
                .eq('athlete_id', athlete.athlete_id)
                .single()

              if (credits) {
                // Calculate original credits = current + all used in this order for this category
                const { data: orderLines } = await serviceClient
                  .from('order_lines')
                  .select('qty, sku')
                  .eq('order_id', lineData.order_id)

                // Get categories for all order lines
                const orderSkus = (orderLines ?? []).map((l: any) => l.sku)
                const { data: orderProducts } = await serviceClient
                  .from('products')
                  .select('sku, category')
                  .in('sku', orderSkus)

                const categoryQtyMap: Record<string, number> = {}
                for (const line of orderLines ?? []) {
                  const prod = (orderProducts ?? []).find((p: any) => p.sku === line.sku)
                  if (prod) {
                    const cf = CREDIT_MAP[prod.category]
                    if (cf) categoryQtyMap[cf] = (categoryQtyMap[cf] ?? 0) + line.qty
                  }
                }

                // Original credits = current + used in order (excluding the line being deleted)
                const usedInOrder = categoryQtyMap[creditField] ?? 0
                const originalCredits = ((credits as any)[creditField] ?? 0) + usedInOrder
                // New value = current + returned qty, capped at original
                const newValue = Math.min(
                  originalCredits,
                  ((credits as any)[creditField] ?? 0) + lineData.qty
                )

                await serviceClient
                  .from('athlete_credits')
                  .update({ [creditField]: newValue })
                  .eq('athlete_id', athlete.athlete_id)
              }
            }
          }
        }
      }
    }
  }

  // Handle customer notification - send ONE email with all changes
  if (action === 'notify_customer') {
    const changesList = body.changes ?? []
    
    // Fetch order data inside the notify block
    const { data: orderData, error: orderErr } = await serviceClient
      .from('order_requests')
      .select('customer_id, currency, status')
      .eq('order_id', orderId)
      .maybeSingle()

    console.log('[notify] orderId:', orderId, 'changes:', changesList.length, 'orderData:', JSON.stringify(orderData), 'orderErr:', orderErr?.message, 'resend:', !!process.env.RESEND_API_KEY)

    if (orderData && process.env.RESEND_API_KEY) {
      const symbol = orderData.currency === 'GBP' ? '£' : '€'
      const ref = orderId.slice(0, 8).toUpperCase()

      let customerEmail: string | null = null
      let customerName = 'there'
      let isAthlete = false

      const { data: customer } = await serviceClient
        .from('customers').select('email_login, customer_name').eq('customer_id', orderData.customer_id).maybeSingle()

      if (customer) {
        customerEmail = customer.email_login
        customerName = customer.customer_name
      } else {
        const { data: athlete } = await serviceClient
          .from('athletes').select('email_login, athlete_name').eq('athlete_id', orderData.customer_id).maybeSingle()
        if (athlete) { customerEmail = athlete.email_login; customerName = athlete.athlete_name; isAthlete = true }
      }

      const { data: finalLines } = await serviceClient
        .from('order_lines').select('product_name, size, qty, list_price, customer_discount_pct, promo_discount_pct, final_unit_price, line_total').eq('order_id', orderId)

      const netTotal = (finalLines ?? []).reduce((s: number, l: any) => s + (l.line_total ?? 0), 0)

      if (customerEmail) {
        const changesHtml = (changesList ?? []).map((c: string) =>
          `<li style="padding:4px 0;font-size:13px;color:#333">${c}</li>`
        ).join('')

        const linesHtml = (finalLines ?? []).map((l: any) => {
          const discountInfo = !isAthlete && (l.customer_discount_pct > 0 || l.promo_discount_pct > 0)
            ? `<div style="font-size:11px;margin-top:2px">${l.customer_discount_pct > 0 ? `<span style="color:#059669">${l.customer_discount_pct}% discount</span>` : ''}${l.customer_discount_pct > 0 && l.promo_discount_pct > 0 ? ' · ' : ''}${l.promo_discount_pct > 0 ? `<span style="color:#2563eb">+${l.promo_discount_pct}% promo</span>` : ''}</div>`
            : ''
          return `<tr>
            <td style="padding:8px 16px;font-size:13px;color:#333">${l.product_name} · ${l.size}${discountInfo}</td>
            <td style="padding:8px 16px;font-size:13px;color:#333;text-align:center">${l.qty}</td>
            ${!isAthlete ? `<td style="padding:8px 16px;font-size:13px;color:#333;text-align:right">${symbol}${(l.line_total ?? 0).toFixed(2)}</td>` : ''}
          </tr>`
        }).join('')

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
<div style="background:#000;padding:20px 32px"></div>
<div style="padding:32px">
<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">Your order has been updated</h1>
<p style="margin:0 0 20px;color:#555;font-size:14px">Hi ${customerName}, your order (Ref: <strong>${ref}</strong>) was modified by our team.</p>
<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:16px;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e">Changes made:</p>
<ul style="margin:0;padding-left:16px">${changesHtml}</ul>
</div>
<p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#111">Updated order:</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<thead><tr style="background:#f5f5f5">
<th style="padding:8px 16px;font-size:12px;text-align:left;color:#666;text-transform:uppercase">Product</th>
<th style="padding:8px 16px;font-size:12px;text-align:center;color:#666;text-transform:uppercase">Qty</th>
${!isAthlete ? '<th style="padding:8px 16px;font-size:12px;text-align:right;color:#666;text-transform:uppercase">Total</th>' : ''}
</tr></thead>
<tbody>${linesHtml}</tbody>
${!isAthlete ? `<tfoot><tr><td colspan="2" style="padding:12px 16px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #eee">Subtotal</td><td style="padding:12px 16px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #eee">${symbol}${netTotal.toFixed(2)}</td></tr></tfoot>` : ''}
</table>
<div style="border-top:1px solid #eee;padding-top:20px;font-size:12px;color:#aaa;text-align:center">
Balling Hockey · Wholesale Portal<br>
Questions? <a href="mailto:admin@ballinghockey.com" style="color:#666">admin@ballinghockey.com</a>
</div></div></div></body></html>`

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
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

  if (action === 'add_line') {
    const { customerDiscountPct = 0, productPromoDiscountPct = 0, listPrice } = body
    const finalUnitPrice = unitPrice
    const { error } = await serviceClient
      .from('order_lines')
      .insert({
        order_id: orderId, sku, product_name: productName, size, qty,
        list_price: listPrice ?? unitPrice,
        customer_discount_pct: customerDiscountPct,
        promo_discount_pct: productPromoDiscountPct,
        final_unit_price: finalUnitPrice,
        line_total: qty * finalUnitPrice,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If athlete order, deduct credits for added line
    const { data: addOrder } = await serviceClient
      .from('order_requests')
      .select('customer_id')
      .eq('order_id', orderId)
      .single()

    if (addOrder) {
      const { data: addAthlete } = await serviceClient
        .from('athletes')
        .select('athlete_id')
        .eq('athlete_id', addOrder.customer_id)
        .maybeSingle()

      if (addAthlete) {
        const { data: addProduct } = await serviceClient
          .from('products')
          .select('category')
          .eq('sku', sku)
          .maybeSingle()

        if (addProduct) {
          const CREDIT_MAP: Record<string, string> = {
            Sticks: 'sticks', Bags: 'bags', Accessories: 'accessories',
            Apparel: 'accessories', Shoes: 'shoes', Padel: 'padel',
          }
          const creditField = CREDIT_MAP[addProduct.category]
          if (creditField) {
            const { data: addCredits } = await serviceClient
              .from('athlete_credits')
              .select(creditField)
              .eq('athlete_id', addAthlete.athlete_id)
              .single()

            if (addCredits) {
              const currentVal = (addCredits as any)[creditField] ?? 0
              console.log('[add_line] creditField:', creditField, 'current:', currentVal, 'deducting:', qty)
              const newValue = Math.max(0, currentVal - qty)
              await serviceClient
                .from('athlete_credits')
                .update({ [creditField]: newValue })
                .eq('athlete_id', addAthlete.athlete_id)
            }
          }
        }
      }
    }
  }

  // Recalculate order totals
  const { data: allLines } = await serviceClient
    .from('order_lines')
    .select('sku, product_name, size, qty, list_price, customer_discount_pct, promo_discount_pct, final_unit_price, line_total')
    .eq('order_id', orderId)

  const netTotal = (allLines ?? []).reduce((sum, l) => sum + (l.line_total ?? 0), 0)

  // Recalculate VAT - get vat_rule from customer
  const VAT_RATES: Record<string, number> = {
    UK_STANDARD: 0.20,
    ES_STANDARD: 0.21,
    EU_EXEMPT: 0,
    CLUB_INCLUDED: 0,
  }

  // Get customer_id from order, then get vat_rule from customer
  const { data: orderInfo } = await serviceClient
    .from('order_requests')
    .select('customer_id')
    .eq('order_id', orderId)
    .single()

  let vatRule = 'EU_EXEMPT'
  if (orderInfo?.customer_id) {
    const { data: customerVat } = await serviceClient
      .from('customers')
      .select('vat_rule')
      .eq('customer_id', orderInfo.customer_id)
      .maybeSingle()
    if (customerVat?.vat_rule) vatRule = customerVat.vat_rule
  }

  const vatRate = VAT_RATES[vatRule] ?? 0
  const vatTotal = Math.round(netTotal * vatRate * 100) / 100
  const grandTotal = Math.round((netTotal + vatTotal) * 100) / 100

  // Get current order totals before updating
  const { data: currentOrder } = await serviceClient
    .from('order_requests')
    .select('net_total, status, customer_id, loyalty_credit_applied')
    .eq('order_id', orderId)
    .single()

  await serviceClient
    .from('order_requests')
    .update({
      net_total: Math.round(netTotal * 100) / 100,
      vat_total: vatTotal,
      grand_total: grandTotal,
    })
    .eq('order_id', orderId)

  // If order is confirmed, adjust loyalty based on new total
  if (currentOrder?.status === 'confirmed' && currentOrder.customer_id) {
    const { data: loyalty } = await serviceClient
      .from('customer_loyalty')
      .select('total_spent, credit_balance')
      .eq('customer_id', currentOrder.customer_id)
      .maybeSingle()

    const { data: loyaltyRule } = await serviceClient
      .from('loyalty_rules')
      .select('spend_threshold, credit_amount')
      .eq('customer_id', currentOrder.customer_id)
      .eq('active', true)
      .maybeSingle()

    if (loyalty && loyaltyRule) {
      const loyaltyCreditUsed = currentOrder.loyalty_credit_applied ?? 0
      const oldActualSpent = Math.max(0, (currentOrder.net_total ?? 0) - loyaltyCreditUsed)
      const newActualSpent = Math.max(0, netTotal - loyaltyCreditUsed)
      const spentDiff = newActualSpent - oldActualSpent

      const currentTotalSpent = loyalty.total_spent ?? 0
      const newTotalSpent = Math.max(0, currentTotalSpent + spentDiff)

      // Recalculate earned cycles
      const previousCycles = Math.floor(currentTotalSpent / loyaltyRule.spend_threshold)
      const newCycles = Math.floor(newTotalSpent / loyaltyRule.spend_threshold)
      const cycleDiff = newCycles - previousCycles
      const creditAdjustment = cycleDiff * loyaltyRule.credit_amount

      const newBalance = Math.max(0, (loyalty.credit_balance ?? 0) + creditAdjustment)

      await serviceClient.from('customer_loyalty').update({
        total_spent: Math.round(newTotalSpent * 100) / 100,
        credit_balance: Math.round(newBalance * 100) / 100,
        updated_at: new Date().toISOString(),
      }).eq('customer_id', currentOrder.customer_id)
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
  const customerId = url.searchParams.get('customerId') ?? ''
  const currency = url.searchParams.get('currency') ?? 'GBP'

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Determine stock table based on currency
  const stockTable = currency === 'GBP' ? 'stock_uk' : 'stock_eu'

  // Get SKUs with stock > 0
  const { data: stockData } = await serviceClient
    .from(stockTable)
    .select('sku')
    .gt('stock', 0)

  const skusWithStock = new Set((stockData ?? []).map((s: any) => s.sku))

  let query = serviceClient
    .from('products')
    .select('sku, product_name, product_group, size, base_price_gbp, base_price_eur, category, subcategory')
    .eq('active', true)
    .order('category')
    .order('product_name')

  if (q.length >= 2) {
    query = query.or(`sku.ilike.%${q}%,product_name.ilike.%${q}%`)
  }

  const { data: allProducts } = await query.limit(500)

  // Filter to only products with stock and include stock qty
  const stockMap = new Map((stockData ?? []).map((s: any) => [s.sku, s.stock]))

  // Re-fetch with stock qty
  const { data: stockWithQty } = await serviceClient
    .from(stockTable)
    .select('sku, stock')
    .gt('stock', 0)

  const stockQtyMap = new Map((stockWithQty ?? []).map((s: any) => [s.sku, s.stock]))

  const products = (allProducts ?? [])
    .filter((p: any) => skusWithStock.has(p.sku))
    .map((p: any) => ({ ...p, stock: stockQtyMap.get(p.sku) ?? 0 }))

  // Fetch customer discounts and product promos if customerId provided
  let discounts: Record<string, number> = {}
  let productPromos: { product_group: string; discount_pct: number; start_date: string; end_date: string }[] = []

  if (customerId) {
    const { data: discountData } = await serviceClient
      .from('customer_discounts')
      .select('sticks_pct, bags_pct, accessories_pct, apparel_pct, shoes_pct')
      .eq('customer_id', customerId)
      .maybeSingle()

    if (discountData) {
      discounts = {
        Sticks: discountData.sticks_pct ?? 0,
        Bags: discountData.bags_pct ?? 0,
        Accessories: discountData.accessories_pct ?? 0,
        Apparel: discountData.apparel_pct ?? 0,
        Shoes: discountData.shoes_pct ?? 0,
        Padel: discountData.apparel_pct ?? 0,
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const { data: promoData } = await serviceClient
      .from('product_promotions')
      .select('product_group, discount_pct, start_date, end_date')
      .eq('customer_id', customerId)
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)

    productPromos = promoData ?? []
  }

  // Apply discounts to products
  const today = new Date().toISOString().slice(0, 10)
  const productsWithPrices = (products ?? []).map((p: any) => {
    const basePrice = currency === 'GBP' ? p.base_price_gbp : p.base_price_eur
    const customerDiscountPct = discounts[p.category] ?? 0
    const promo = productPromos.find((pp: any) => pp.product_group === p.product_group)
    const productPromoDiscountPct = promo?.discount_pct ?? 0
    const totalDiscount = Math.min(customerDiscountPct + productPromoDiscountPct, 100)
    const finalPrice = Math.round(basePrice * (1 - totalDiscount / 100) * 100) / 100
    return {
      ...p,
      finalPrice,
      customerDiscountPct,
      productPromoDiscountPct,
    }
  })

  return NextResponse.json({ products: productsWithPrices })
}
