import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BALLING_EMAILS = ['admin@ballinghockey.com', 'secure@ballinghockey.com']
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'orders@resend.dev'

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
}) {
  const { customerName, orderId, items, currency, subtotal, vatLabel, orderDate } = params
  const symbol = currency === 'GBP' ? '£' : '€'

  const rows = items.map((item) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 8px;font-size:13px">
        <strong>${item.productName}</strong><br>
        <span style="color:#888;font-size:12px">${item.size} · SKU: ${item.sku}</span>
      </td>
      <td style="padding:10px 8px;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:10px 8px;font-size:13px;text-align:right;color:#888">
        ${item.customerDiscountPct > 0 ? `<s>${formatCurrency(item.listPrice, currency)}</s><br>` : ''}
        ${item.displayFinalPrice}
        ${item.customerDiscountPct > 0 ? `<br><span style="font-size:11px;color:#059669">-${item.customerDiscountPct}% applied</span>` : ''}
      </td>
      <td style="padding:10px 8px;font-size:13px;text-align:right;font-weight:600">${formatCurrency(item.lineTotal, currency)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    
    <div style="background:#000;padding:24px 32px;display:flex;align-items:center">
      <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">BALLING</span>
      <span style="color:#666;font-size:12px;margin-left:12px;letter-spacing:2px;text-transform:uppercase">Wholesale Portal</span>
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
        Questions? Contact your Balling representative.
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
}) {
  const { customerName, customerEmail, orderId, items, currency, subtotal, orderDate } = params
  const symbol = currency === 'GBP' ? '£' : '€'

  const rows = items.map((item) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px;font-size:13px">${item.productName} · ${item.size}</td>
      <td style="padding:8px;font-size:13px;color:#888">${item.sku}</td>
      <td style="padding:8px;font-size:13px;text-align:center">${item.qty}</td>
      <td style="padding:8px;font-size:13px;text-align:right">${item.displayFinalPrice}</td>
      <td style="padding:8px;font-size:13px;text-align:right;font-weight:600">${formatCurrency(item.lineTotal, currency)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:32px auto;color:#111">
  <h2 style="margin:0 0 4px">New wholesale order received</h2>
  <p style="margin:0 0 24px;color:#666;font-size:14px">${orderDate} · Ref: ${orderId.slice(0,8).toUpperCase()}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;background:#f5f5f5;border-radius:6px">
    <tr><td style="padding:12px 16px;font-size:13px"><strong>Customer:</strong> ${customerName}</td></tr>
    <tr><td style="padding:0 16px 12px;font-size:13px"><strong>Email:</strong> ${customerEmail}</td></tr>
    <tr><td style="padding:0 16px 12px;font-size:13px"><strong>Currency:</strong> ${currency}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#111;color:#fff">
        <th style="padding:8px;font-size:12px;text-align:left">Product</th>
        <th style="padding:8px;font-size:12px;text-align:left">SKU</th>
        <th style="padding:8px;font-size:12px;text-align:center">Qty</th>
        <th style="padding:8px;font-size:12px;text-align:right">Unit</th>
        <th style="padding:8px;font-size:12px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="padding:12px 8px;text-align:right;font-weight:600">Subtotal</td>
        <td style="padding:12px 8px;text-align:right;font-weight:700;font-size:15px">${symbol}${subtotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <p style="margin-top:24px;font-size:12px;color:#888">
    This order has been saved in Supabase · Order ID: ${orderId}
  </p>
</body>
</html>`
}

async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
}) {
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
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[email] Resend error:', err)
  } else {
    console.log('[email] Sent to:', params.to)
  }
}

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

  // Fetch customer email + VAT rule
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
  const vatTotal = netTotal * (vatPct / 100)
  const grandTotal = netTotal + vatTotal

  const orderId = crypto.randomUUID()
  const orderDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

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

  // Send emails (non-blocking — order is already saved even if email fails)
  const customerEmailHtml = buildCustomerEmailHtml({
    customerName,
    orderId,
    items,
    currency,
    subtotal: netTotal,
    vatLabel,
    orderDate,
  })

  const ballingEmailHtml = buildBallingEmailHtml({
    customerName,
    customerEmail: customer?.email_login ?? '',
    orderId,
    items,
    currency,
    subtotal: netTotal,
    orderDate,
  })

  await Promise.all([
    sendEmail({
      to: customer?.email_login ?? '',
      subject: `Order confirmed – ${orderDate} · Ref ${orderId.slice(0,8).toUpperCase()}`,
      html: customerEmailHtml,
    }),
    sendEmail({
      to: BALLING_EMAILS,
      subject: `New order from ${customerName} · ${currency} ${netTotal.toFixed(2)}`,
      html: ballingEmailHtml,
    }),
  ])

  return NextResponse.json({ ok: true, orderId })
}
