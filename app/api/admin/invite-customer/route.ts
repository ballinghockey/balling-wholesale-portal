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
    loyalty_active, loyalty_threshold, loyalty_credit,
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

  // Setup loyalty if enabled
  if (loyalty_active === 'true' && loyalty_threshold && loyalty_credit) {
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

  // Generate invite link and send via Resend
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${process.env.APP_URL ?? 'https://portal.ballinghockey.com'}/set-password`,
      data: { customer_id, type: 'customer' },
    }
  })

  if (linkError || !linkData) {
    console.error('[invite] Error generating link:', linkError?.message)
    return NextResponse.json({
      ok: true,
      customer_id,
      warning: `Customer created but invite link failed: ${linkError?.message}`
    })
  }

  // Link is in properties.action_link
  const inviteUrl = (linkData as any).properties?.action_link ?? linkData.user?.action_link

  if (inviteUrl && process.env.RESEND_API_KEY) {
    const symbol = currency === 'GBP' ? '£' : 'EUR'
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#000;padding:20px 32px">
      
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111">You're invited to the Balling Hockey Wholesale Portal</h1>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${customer_name},</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Your wholesale account has been created. Click the button below to set your password and access the portal.</p>
      <a href="${inviteUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;margin-bottom:24px">Set password & sign in →</a>
      <p style="margin:0 0 8px;color:#999;font-size:12px">Or copy this link: <a href="${inviteUrl}" style="color:#555">${inviteUrl}</a></p>
      <div style="border-top:1px solid #eee;padding-top:20px;margin-top:24px;font-size:12px;color:#aaa;text-align:center">
        Balling Hockey · Wholesale Portal<br>
        Questions? <a href="mailto:admin@ballinghockey.com" style="color:#666">admin@ballinghockey.com</a>
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
        to: [email],
        subject: "You're invited to the Balling Hockey Wholesale Portal",
        html,
      }),
    })
  }

  // Link auth user
  if (linkData.user?.id) {
    await serviceClient
      .from('customers')
      .update({ auth_user_id: linkData.user.id })
      .eq('customer_id', customer_id)
  }

  return NextResponse.json({ ok: true, customer_id })
}
