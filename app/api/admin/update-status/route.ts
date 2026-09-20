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

  return NextResponse.json({ ok: true })
}
  }

  return NextResponse.json({ ok: true })
}
