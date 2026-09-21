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

  const { orderId, status } = await req.json()
  const validStatuses = ['submitted', 'confirmed', 'shipped', 'cancelled']

  if (!orderId || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch current order to check previous status
  const { data: order } = await serviceClient
    .from('order_requests')
    .select('status, customer_id, net_total, currency')
    .eq('order_id', orderId)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Update status
  const { error } = await serviceClient
    .from('order_requests')
    .update({ status })
    .eq('order_id', orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Accumulate loyalty when order is confirmed (only if not already confirmed before)
  if (status === 'confirmed' && order.status !== 'confirmed') {
    const { data: loyaltyRule } = await serviceClient
      .from('loyalty_rules')
      .select('*')
      .eq('customer_id', order.customer_id)
      .eq('active', true)
      .maybeSingle()

    if (loyaltyRule) {
      const { data: loyalty } = await serviceClient
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', order.customer_id)
        .maybeSingle()

      const currentSpent = loyalty?.total_spent ?? 0
      const newTotalSpent = currentSpent + order.net_total

      const oldCycles = Math.floor(currentSpent / loyaltyRule.spend_threshold)
      const newCycles = Math.floor(newTotalSpent / loyaltyRule.spend_threshold)
      const newCreditsEarned = (newCycles - oldCycles) * loyaltyRule.credit_amount

      const currentBalance = loyalty?.credit_balance ?? 0
      const newBalance = currentBalance + newCreditsEarned

      if (loyalty) {
        await serviceClient.from('customer_loyalty').update({
          total_spent: newTotalSpent,
          credit_balance: newBalance,
          updated_at: new Date().toISOString(),
        }).eq('customer_id', order.customer_id)
      } else {
        await serviceClient.from('customer_loyalty').insert({
          customer_id: order.customer_id,
          total_spent: newTotalSpent,
          credit_balance: newBalance,
          currency: order.currency,
        })
      }
    }
  }

  // If cancelled, reverse loyalty if it was previously confirmed
  if (status === 'cancelled' && order.status === 'confirmed') {
    const { data: loyalty } = await serviceClient
      .from('customer_loyalty')
      .select('*')
      .eq('customer_id', order.customer_id)
      .maybeSingle()

    if (loyalty) {
      const newTotalSpent = Math.max(0, loyalty.total_spent - order.net_total)
      await serviceClient.from('customer_loyalty').update({
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString(),
      }).eq('customer_id', order.customer_id)
    }
  }

  // Send email notification to customer
  const statusMessages: Record<string, { subject: string; message: string }> = {
    confirmed: {
      subject: `Order confirmed · Ref ${orderId.slice(0,8).toUpperCase()}`,
      message: 'Great news! Your order has been confirmed and is being prepared.'
    },
    shipped: {
      subject: `Order shipped · Ref ${orderId.slice(0,8).toUpperCase()}`,
      message: 'Your order is on its way! You will receive it shortly.'
    },
    cancelled: {
      subject: `Order cancelled · Ref ${orderId.slice(0,8).toUpperCase()}`,
      message: 'Your order has been cancelled. Please contact us at admin@ballinghockey.com if you have any questions.'
    },
    submitted: {
      subject: `Order received · Ref ${orderId.slice(0,8).toUpperCase()}`,
      message: 'Your order has been received and is being reviewed by our team.'
    },
  }

  const notification = statusMessages[status]
  if (notification) {
    // Get customer email
    let customerEmail: string | null = null

    const { data: customer } = await serviceClient
      .from('customers')
      .select('email_login, customer_name')
      .eq('customer_id', order.customer_id)
      .maybeSingle()

    if (customer) {
      customerEmail = customer.email_login
    } else {
      const { data: athlete } = await serviceClient
        .from('athletes')
        .select('email_login, athlete_name')
        .eq('athlete_id', order.customer_id)
        .maybeSingle()
      if (athlete) customerEmail = athlete.email_login
    }

    const customerName = customer?.customer_name ?? 'there'

    if (customerEmail && process.env.RESEND_API_KEY) {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#000;padding:20px 32px;display:flex;align-items:center;justify-content:space-between">
      <img src="https://balling-wholesale-portal.vercel.app/logo-full.png" alt="Balling Hockey" style="height:28px;width:auto;display:block;filter:invert(1)" />
      <span style="color:#555;font-size:11px;letter-spacing:2px;text-transform:uppercase">Wholesale Portal</span>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111">Order update</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${customerName},</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px">${notification.message}</p>
      <div style="background:#f8f8f8;border-radius:6px;padding:16px;margin-bottom:24px;font-size:13px;color:#555">
        <strong style="color:#111">Order reference:</strong> ${orderId.slice(0,8).toUpperCase()}<br>
        <strong style="color:#111">Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
      <div style="border-top:1px solid #eee;padding-top:20px;font-size:12px;color:#aaa;text-align:center">
        Balling Hockey · Wholesale Portal<br>
        Questions? Contact us at <a href="mailto:admin@ballinghockey.com" style="color:#666">admin@ballinghockey.com</a>
      </div>
    </div>
  </div>
</body>
</html>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ballinghockey.com',
          to: [customerEmail],
          subject: notification.subject,
          html,
        }),
      })
    }
  }

  return NextResponse.json({ ok: true })
}
