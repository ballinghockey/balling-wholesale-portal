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

  const {
    customer_name, contact_name, email, country, region,
    warehouse, currency, vat_rule, shipping_rule, customer_type,
    discount_sticks, discount_bags, discount_accessories,
    discount_apparel, discount_shoes,
  } = await req.json()

  if (!customer_name || !email || !warehouse || !currency || !vat_rule) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generate customer ID
  const { data: existing } = await serviceClient
    .from('customers')
    .select('customer_id')
    .like('customer_id', 'C%')
    .order('customer_id', { ascending: false })
    .limit(1)
    .single()

  const lastId = existing?.customer_id ?? 'C000'
  const nextNum = parseInt(lastId.replace('C', '')) + 1
  const customer_id = `C${String(nextNum).padStart(3, '0')}`

  // Create customer record
  const { error: customerError } = await serviceClient
    .from('customers')
    .insert({
      customer_id,
      customer_name,
      contact_name: contact_name || customer_name,
      email_login: email,
      country: country || '',
      region: region || warehouse,
      warehouse,
      currency,
      vat_rule,
      shipping_rule: shipping_rule || 'STANDARD',
      customer_type: customer_type || 'wholesale',
      active: true,
    })

  if (customerError) {
    return NextResponse.json({ error: customerError.message }, { status: 500 })
  }

  // Create discounts
  const { error: discountError } = await serviceClient
    .from('customer_discounts')
    .insert({
      customer_id,
      sticks_pct: parseInt(discount_sticks) || 0,
      bags_pct: parseInt(discount_bags) || 0,
      accessories_pct: parseInt(discount_accessories) || 0,
      apparel_pct: parseInt(discount_apparel) || 0,
      shoes_pct: parseInt(discount_shoes) || 0,
    })

  if (discountError) {
    return NextResponse.json({ error: discountError.message }, { status: 500 })
  }

  // Invite user
  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://balling-wholesale-portal.vercel.app'}/set-password`,
      data: { customer_id, type: 'customer' },
    }
  )

  if (inviteError) {
    console.error('[invite] Error sending invite:', inviteError.message)
    return NextResponse.json({
      ok: true,
      customer_id,
      warning: `Customer created but invite email failed: ${inviteError.message}`
    })
  }

  if (inviteData?.user?.id) {
    await serviceClient
      .from('customers')
      .update({ auth_user_id: inviteData.user.id })
      .eq('customer_id', customer_id)
  }

  // Setup loyalty if enabled
  if (loyalty_active && loyalty_threshold && loyalty_credit) {
    await serviceClient.from('loyalty_rules').upsert({
      customer_id,
      spend_threshold: parseFloat(loyalty_threshold),
      credit_amount: parseFloat(loyalty_credit),
      active: true,
    }, { onConflict: 'customer_id' })

    await serviceClient.from('customer_loyalty').upsert({
      customer_id,
      credit_balance: 0,
      total_spent: 0,
      currency: currency || 'GBP',
    }, { onConflict: 'customer_id' })
  }

  return NextResponse.json({ ok: true, customer_id })
}
