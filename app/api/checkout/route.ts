import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

type OrderItem = {
  sku: string
  productName: string
  size: string
  qty: number
  listPrice: number
  customerDiscountPct: number
  promoDiscountPct: number
  finalUnitPrice: number
  lineTotal: number
  currency: 'GBP' | 'EUR'
  displayListPrice: string
  displayFinalPrice: string
  category?: string
}

function formatCurrency(amount: number, currency: 'GBP' | 'EUR') {
  const symbol = currency === 'GBP' ? '£' : '€'
  return `${symbol}${amount.toFixed(2)}`
}

function buildCustomerEmailHtml(params: {
  customerName: string
  orderId: string
  items: OrderItem[]
  currency: 'GBP' | 'EUR'
  subtotal: number
  vatLabel: string
  orderDate: string
  creditApplied?: number
}) {
  const { customerName, orderId, items, currency, subtotal, vatLabel, orderDate, creditApplied } = params
  const symbol = currency === 'GBP' ? '£' : '€'

  const rows = items.map((item) => {
    const hasDiscount = item.customerDiscountPct > 0 || item.promoDiscountPct > 0
    const discountLines = [
      item.customerDiscountPct > 0 ? `<span style="font-size:11px;color:#059669;display:block">${item.customerDiscountPct}% discount</span>` : '',
      item.promoDiscountPct > 0 ? `<span style="font-size:11px;color:#2563eb;display:block">+ ${item.promoDiscountPct}% promo</span>` : '',
    ].join('')
    return `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 8px;font-size:13px">
        <strong>${item.productName}</strong><br>
        <span style="color:#888;font-size:12px">${item.size} · SKU: ${item.sku}</span>
      </td>
      <td style="padding:10px 8px;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:10px 8px;font-size:13px;text-align:right;color:#888">
        ${hasDiscount ? `<s>${formatCurrency(item.listPrice, currency)}</s><br>` : ''}
        ${item.displayFinalPrice}
        ${discountLines ? `<br>${discountLines}` : ''}
      </td>
      <td style="padding:10px 8px;font-size:13px;text-align:right;font-weight:600">${formatCurrency(item.lineTotal, currency)}</td>
    </tr>
  `}).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#000;padding:20px 32px;display:flex;align-items:center;justify-content:space-between">
      <img src="https://balling-wholesale-portal.vercel.app/logo-full.png" alt="Balling Hockey" style="height:28px;width:auto;display:block;filter:invert(1)" />
      <span style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase">Wholesale Portal</span>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111">Order received</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${customerName}, your order has been received and is being reviewed by our team.</p>
      <div style="background:#f8f8f8;border-radius:6px;padding:16px;margin-bottom:24px;font-size:13px;color:#555">
        <strong style="color:#111">Order reference:</strong> ${orderId.slice(0,8).toUpperCase()}<br>
        <strong style="color:#111">Date:</strong> ${orderDate}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:10px 8px;font-size:12px;text-align:left;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Product</th>
            <th style="padding:10px 8px;font-size:12px;text-align:center;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
            <th style="padding:10px 8px;font-size:12px;text-align:right;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Unit price</th>
            <th style="padding:10px 8px;font-size:12px;text-align:right;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:12px 8px;font-size:14px;text-align:right;font-weight:600;color:#111">Subtotal</td>
            <td style="padding:12px 8px;font-size:14px;text-align:right;font-weight:700;color:#111">${symbol}${subtotal.toFixed(2)}</td>
          </tr>
          ${creditApplied && creditApplied > 0 ? `<tr>
            <td colspan="3" style="padding:4px 8px;font-size:13px;text-align:right;color:#059669;font-weight:600">🎁 Loyalty credit</td>
            <td style="padding:4px 8px;font-size:13px;text-align:right;color:#059669;font-weight:600">-${symbol}${Number(creditApplied).toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="4" style="padding:0 8px 12px;font-size:12px;text-align:right;color:#888">${vatLabel}</td>
          </tr>
        </tfoot>
      </table>
      <div style="border-top:2px solid #000;margin-top:8px;padding-top:20px">
        <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
          Please note that this confirmation is based on your requested quantities.
          Our team will review availability and may reach out if any adjustments are needed before final confirmation.
        </p>
      </div>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center">
        Balling Hockey · Wholesale Portal<br>
        Questions? Contact us at <a href='mailto:admin@ballinghockey.com' style='color:#666'>admin@ballinghockey.com</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

function buildAthleteEmailHtml(params: {
  athleteName: string
  orderId: string
  items: OrderItem[]
  orderDate: string
}) {
  const { athleteName, orderId, items, orderDate } = params

  const rows = items.map((item) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 8px;font-size:13px">
        <strong>${item.productName}</strong><br>
        <span style="color:#888;font-size:12px">${item.size} · SKU: ${item.sku}</span>
      </td>
      <td style="padding:10px 8px;font-size:13px;text-align:center">${item.qty}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#000;padding:20px 32px;display:flex;align-items:center;justify-content:space-between">
      <img src="https://balling-wholesale-portal.vercel.app/logo-full.png" alt="Balling Hockey" style="height:28px;width:auto;display:block;filter:invert(1)" />
      <span style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase">Athlete Portal</span>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111">Equipment request received</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${athleteName}, your equipment request has been received.</p>
      <div style="background:#f8f8f8;border-radius:6px;padding:16px;margin-bottom:24px;font-size:13px;color:#555">
        <strong style="color:#111">Reference:</strong> ${orderId.slice(0,8).toUpperCase()}<br>
        <strong style="color:#111">Date:</strong> ${orderDate}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:10px 8px;font-size:12px;text-align:left;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Product</th>
            <th style="padding:10px 8px;font-size:12px;text-align:center;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="border-top:2px solid #000;margin-top:24px;padding-top:20px">
        <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
          Our team will review your request and be in touch to arrange delivery.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
}

function buildBallingEmailHtml(params: {
  customerName: string
  customerEmail: string
  orderId: string
  items: OrderItem[]
  currency: 'GBP' | 'EUR'
  subtotal: number
  orderDate: string
  isAthlete: boolean
  shippingAddress?: Record<string, string> | null
  creditApplied?: number
}) {
  const { customerName, customerEmail, orderId, items, currency, subtotal, orderDate, isAthlete, shippingAddress, creditApplied } = params
  const symbol = currency === 'GBP' ? '£' : '€'

  const rows = items.map((item) => {
    const discountLines = !isAthlete ? [
      item.customerDiscountPct > 0 ? `<span style="font-size:11px;color:#059669;display:block">${item.customerDiscountPct}% discount</span>` : '',
      item.promoDiscountPct > 0 ? `<span style="font-size:11px;color:#2563eb;display:block">+ ${item.promoDiscountPct}% promo</span>` : '',
    ].join('') : ''
    return `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px;font-size:13px">${item.productName} · ${item.size}${discountLines ? `<div style="margin-top:3px">${discountLines}</div>` : ''}</td>
      <td style="padding:8px;font-size:13px;color:#888">${item.sku}</td>
      <td style="padding:8px;font-size:13px;text-align:center">${item.qty}</td>
      ${!isAthlete ? `
      <td style="padding:8px;font-size:13px;text-align:right">${item.displayFinalPrice}</td>
      <td style="padding:8px;font-size:13px;text-align:right;font-weight:600">${formatCurrency(item.lineTotal, currency)}</td>
      ` : ''}
    </tr>
  `}).join('')

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:32px auto;color:#111">
  <h2 style="margin:0 0 4px">New ${isAthlete ? 'athlete equipment request' : 'wholesale order'} received</h2>
  <p style="margin:0 0 24px;color:#666;font-size:14px">${orderDate} · Ref: ${orderId.slice(0,8).toUpperCase()}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;background:#f5f5f5;border-radius:6px">
    <tr><td style="padding:12px 16px;font-size:13px"><strong>${isAthlete ? 'Athlete' : 'Customer'}:</strong> ${customerName}</td></tr>
    <tr><td style="padding:0 16px 12px;font-size:13px"><strong>Email:</strong> ${customerEmail}</td></tr>
    <tr><td style="padding:0 16px 12px;font-size:13px"><strong>Currency:</strong> ${currency}</td></tr>
    ${creditApplied && creditApplied > 0 ? `<tr><td style="padding:0 16px 12px;font-size:13px;color:#059669"><strong>Loyalty credit applied:</strong> -${symbol}${Number(creditApplied).toFixed(2)}</td></tr>` : ''}
  </table>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#111;color:#fff">
        <th style="padding:8px;font-size:12px;text-align:left">Product</th>
        <th style="padding:8px;font-size:12px;text-align:left">SKU</th>
        <th style="padding:8px;font-size:12px;text-align:center">Qty</th>
        ${!isAthlete ? `
        <th style="padding:8px;font-size:12px;text-align:right">Unit</th>
        <th style="padding:8px;font-size:12px;text-align:right">Total</th>
        ` : ''}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    ${!isAthlete ? `
    <tfoot>
      <tr>
        <td colspan="4" style="padding:12px 8px;text-align:right;font-weight:600">Subtotal</td>
        <td style="padding:12px 8px;text-align:right;font-weight:700;font-size:15px">${symbol}${subtotal.toFixed(2)}</td>
      </tr>
    </tfoot>
    ` : ''}
  </table>
  ${shippingAddress ? `
  <div style="margin-top:20px;padding:12px 16px;background:#f5f5f5;border-radius:6px;font-size:13px">
    <strong>Shipping address:</strong><br>
    ${shippingAddress.name}<br>
    ${shippingAddress.line1}${shippingAddress.line2 ? '<br>' + shippingAddress.line2 : ''}<br>
    ${shippingAddress.city}${shippingAddress.county ? ', ' + shippingAddress.county : ''}<br>
    ${shippingAddress.postcode}<br>
    ${shippingAddress.country}
  </div>` : ''}
  <p style="margin-top:24px;font-size:12px;color:#888">Order ID: ${orderId}</p>
</body>
</html>`
}

async function sendEmail(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not set — skipping email')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  })

  if (!res.ok) {
    console.error(`[email] Resend error sending to ${params.to}:`, await res.text())
  } else {
    console.log(`[email] Sent to: ${params.to}`)
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { items, currency, customerId, customerName, isAthlete, shippingAddress, creditApplied } = await req.json()

  if (!items?.length) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 })
  }

  // Validate stock availability before processing
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Determine warehouse from customer or athlete
  let warehouse = 'EU'
  if (!isAthlete) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('warehouse')
      .eq('customer_id', customerId)
      .single()
    warehouse = customerData?.warehouse ?? 'EU'
  } else {
    const { data: athleteData } = await supabase
      .from('athletes')
      .select('warehouse')
      .eq('athlete_id', customerId)
      .single()
    warehouse = athleteData?.warehouse ?? 'EU'
  }

  const stockTable = warehouse === 'UK' ? 'stock_uk' : 'stock_eu'
  const skus = (items as OrderItem[]).map((i) => i.sku)

  const { data: stockData } = await serviceClient
    .from(stockTable)
    .select('sku, stock')
    .in('sku', skus)

  const stockMap = new Map((stockData ?? []).map((s: any) => [s.sku, s.stock]))

  for (const item of items as OrderItem[]) {
    const available = stockMap.get(item.sku) ?? 0
    if (item.qty > available) {
      return NextResponse.json({
        error: `Insufficient stock for ${item.productName} (${item.size}). Available: ${available}, requested: ${item.qty}`
      }, { status: 400 })
    }
  }

  const orderId = crypto.randomUUID()
  const orderDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  if (isAthlete) {
    // ATHLETE CHECKOUT
    const { data: athlete } = await supabase
      .from('athletes')
      .select('email_login, currency')
      .eq('athlete_id', customerId)
      .single()

    // Create order with zero prices
    const { error: orderError } = await supabase
      .from('order_requests')
      .insert({
        order_id: orderId,
        customer_id: customerId,
        currency: athlete?.currency ?? currency,
        list_total: 0,
        customer_discount_total: 0,
        promo_discount_total: 0,
        net_total: 0,
        vat_total: 0,
        grand_total: 0,
        status: 'submitted',
        shipping_address: shippingAddress ?? null,
      })

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    const orderLines = items.map((item: OrderItem) => ({
      order_id: orderId,
      sku: item.sku,
      product_name: item.productName,
      size: item.size,
      qty: item.qty,
      list_price: 0,
      customer_discount_pct: 0,
      promo_discount_pct: 0,
      final_unit_price: 0,
      line_total: 0,
    }))

    const { error: linesError } = await supabase
      .from('order_lines')
      .insert(orderLines)

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }

    // Deduct credits by category
    const creditDeductions: Record<string, number> = {}
    const CATEGORY_CREDIT_MAP: Record<string, string> = {
      sticks: 'sticks', bags: 'bags', accessories: 'accessories',
      apparel: 'apparel', shoes: 'shoes', padel: 'padel',
    }

    for (const item of items as OrderItem[]) {
      const cat = (item.category ?? '').toLowerCase()
      const creditField = CATEGORY_CREDIT_MAP[cat]
      if (creditField) {
        creditDeductions[creditField] = (creditDeductions[creditField] ?? 0) + item.qty
      }
    }

    // Fetch current credits and subtract (use serviceClient to bypass RLS)
    const { data: currentCredits } = await serviceClient
      .from('athlete_credits')
      .select('*')
      .eq('athlete_id', customerId)
      .single()

    if (currentCredits) {
      const updates: Record<string, number> = {}
      for (const [field, used] of Object.entries(creditDeductions)) {
        updates[field] = Math.max(0, Math.max(0, (currentCredits[field] ?? 0)) - used)
      }

      await serviceClient
        .from('athlete_credits')
        .update(updates)
        .eq('athlete_id', customerId)
    }

    // Clear cart
    await supabase.from('draft_cart').delete().eq('customer_id', customerId)

    // Send emails
    const athleteEmailHtml = buildAthleteEmailHtml({ athleteName: customerName, orderId, items, orderDate })
    const ballingEmailHtml = buildBallingEmailHtml({
      customerName, customerEmail: athlete?.email_login ?? '', orderId, items,
      currency: (athlete?.currency ?? currency) as 'GBP' | 'EUR',
      subtotal: 0, orderDate, isAthlete: true, shippingAddress,
    })

    const ballingSubject = `New athlete request from ${customerName} · Ref ${orderId.slice(0,8).toUpperCase()}`

    await sendEmail({ to: athlete?.email_login ?? '', subject: `Equipment request received · Ref ${orderId.slice(0,8).toUpperCase()}`, html: athleteEmailHtml })
    await sendEmail({ to: 'admin@ballinghockey.com', subject: ballingSubject, html: ballingEmailHtml })
    await sendEmail({ to: 'secure@ballinghockey.com', subject: ballingSubject, html: ballingEmailHtml })

    return NextResponse.json({ ok: true, orderId })
  }

  // CUSTOMER CHECKOUT (unchanged)
  const { data: customer } = await supabase
    .from('customers')
    .select('vat_rule, email_login')
    .eq('customer_id', customerId)
    .single()

  const { data: vatRow } = await supabase
    .from('vat_rules')
    .select('vat_pct')
    .eq('vat_rule', customer?.vat_rule ?? 'EU_EXEMPT')
    .single()

  const vatPct = vatRow?.vat_pct ?? 0
  const VAT_LABELS: Record<string, string> = {
    EU_EXEMPT: 'VAT exempt (intra-EU)',
    UK_STANDARD: 'VAT 20% will be applied',
    ES_STANDARD: 'VAT 21% will be applied',
  }
  const vatLabel = VAT_LABELS[customer?.vat_rule ?? ''] ?? ''

  const listTotal = items.reduce((sum: number, item: OrderItem) => sum + item.listPrice * item.qty, 0)
  const netTotal = items.reduce((sum: number, item: OrderItem) => sum + item.lineTotal, 0)
  const customerDiscountTotal = listTotal - items.reduce((sum: number, item: OrderItem) =>
    sum + item.listPrice * (1 - item.customerDiscountPct / 100) * item.qty, 0)
  const promoDiscountTotal = items.reduce((sum: number, item: OrderItem) =>
    sum + item.listPrice * (1 - item.customerDiscountPct / 100) * (item.promoDiscountPct / 100) * item.qty, 0)
  // VAT calculated on amount after loyalty credit deduction
  const netAfterCredit = Math.max(0, netTotal - (creditApplied ?? 0))
  const vatTotal = netAfterCredit * (vatPct / 100)
  const grandTotal = netAfterCredit + vatTotal

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
      loyalty_credit_applied: creditApplied ?? 0,
      status: 'submitted',
    })

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  const orderLines = items.map((item: OrderItem) => ({
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

  await supabase.from('draft_cart').delete().eq('customer_id', customerId)

  // Deduct loyalty credit if applied — use service role to bypass RLS
  console.log('[loyalty] creditApplied:', creditApplied, 'customerId:', customerId, 'isAthlete:', isAthlete)
  if (!isAthlete && creditApplied && creditApplied > 0) {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: loyalty, error: loyaltyError } = await serviceClient
      .from('customer_loyalty')
      .select('credit_balance')
      .eq('customer_id', customerId)
      .maybeSingle()

    console.log('[loyalty] current balance:', loyalty?.credit_balance, 'error:', loyaltyError?.message)

    if (loyalty) {
      const newBalance = Math.max(0, (loyalty.credit_balance ?? 0) - creditApplied)
      const { error: updateError } = await serviceClient
        .from('customer_loyalty')
        .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
      console.log('[loyalty] updated to:', newBalance, 'error:', updateError?.message)
    }
  }

  const customerEmailHtml = buildCustomerEmailHtml({ customerName, orderId, items, currency, subtotal: netTotal, vatLabel, orderDate, creditApplied })
  const ballingEmailHtml = buildBallingEmailHtml({ customerName, customerEmail: customer?.email_login ?? '', orderId, items, currency, subtotal: netTotal, orderDate, isAthlete: false, creditApplied: creditApplied ?? 0 })
  const creditSymbol = currency === 'GBP' ? '£' : '€'
  const creditNote = creditApplied && creditApplied > 0
    ? ` (${creditSymbol}${Number(creditApplied).toFixed(2)} loyalty credit applied)`
    : ''
  const ballingSubject = `New order from ${customerName} · ${currency} ${netTotal.toFixed(2)}${creditNote}`

  await sendEmail({ to: customer?.email_login ?? '', subject: `Order received · Ref ${orderId.slice(0,8).toUpperCase()}`, html: customerEmailHtml })
  await sendEmail({ to: 'admin@ballinghockey.com', subject: ballingSubject, html: ballingEmailHtml })
  await sendEmail({ to: 'secure@ballinghockey.com', subject: ballingSubject, html: ballingEmailHtml })

  return NextResponse.json({ ok: true, orderId })
}
