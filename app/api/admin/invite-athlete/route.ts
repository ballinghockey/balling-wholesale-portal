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
    athlete_name, contact_name, email, country, warehouse, currency,
    credits_sticks, credits_bags, credits_accessories, credits_shoes, credits_padel,
  } = await req.json()

  if (!athlete_name || !email || !warehouse) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Generate athlete ID
  const { data: existing } = await serviceClient
    .from('athletes')
    .select('athlete_id')
    .like('athlete_id', 'ATH%')
    .order('athlete_id', { ascending: false })
    .limit(1)
    .single()

  const lastId = existing?.athlete_id ?? 'ATH000'
  const nextNum = parseInt(lastId.replace('ATH', '')) + 1
  const athlete_id = `ATH${String(nextNum).padStart(3, '0')}`

  // Create athlete record
  const { error: athleteError } = await serviceClient
    .from('athletes')
    .insert({
      athlete_id,
      athlete_name,
      contact_name: contact_name || athlete_name,
      email_login: email,
      country: country || '',
      warehouse,
      currency: currency || (warehouse === 'UK' ? 'GBP' : 'EUR'),
      active: true,
    })

  if (athleteError) {
    return NextResponse.json({ error: athleteError.message }, { status: 500 })
  }

  // Create credits
  const { error: creditsError } = await serviceClient
    .from('athlete_credits')
    .insert({
      athlete_id,
      sticks: parseInt(credits_sticks) || 0,
      bags: parseInt(credits_bags) || 0,
      accessories: parseInt(credits_accessories) || 0,
      apparel: 0,
      shoes: parseInt(credits_shoes) || 0,
      padel: parseInt(credits_padel) || 0,
    })

  if (creditsError) {
    return NextResponse.json({ error: creditsError.message }, { status: 500 })
  }

  // Generate invite link
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://balling-wholesale-portal.vercel.app'}/set-password`,
      data: { athlete_id, type: 'athlete' },
    }
  })

  if (linkError || !linkData) {
    return NextResponse.json({
      ok: true,
      athlete_id,
      warning: `Athlete created but invite link failed: ${linkError?.message}`
    })
  }

  const inviteUrl = (linkData as any).properties?.action_link ?? (linkData.user as any)?.action_link

  if (inviteUrl && process.env.RESEND_API_KEY) {
    const html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
      '<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">',
      '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">',
      '<div style="background:#000;padding:20px 32px">',
      '<span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:2px">BALLING</span>',
      '</div>',
      '<div style="padding:32px">',
      '<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111">You\'re invited to the Balling Hockey Athlete Portal</h1>',
      `<p style="margin:0 0 24px;color:#555;font-size:14px">Hi ${athlete_name},</p>`,
      '<p style="margin:0 0 24px;color:#555;font-size:14px">Your athlete account has been created. Click the button below to set your password and access your product credits.</p>',
      `<a href="${inviteUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;margin-bottom:24px">Set password &amp; sign in &rarr;</a>`,
      `<p style="margin:0 0 8px;color:#999;font-size:12px">Or copy this link: <a href="${inviteUrl}" style="color:#555">${inviteUrl}</a></p>`,
      '<div style="border-top:1px solid #eee;padding-top:20px;margin-top:24px;font-size:12px;color:#aaa;text-align:center">',
      'Balling Hockey &middot; Athlete Portal<br>',
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
        to: [email],
        subject: "You're invited to the Balling Hockey Athlete Portal",
        html,
      }),
    })
  }

  if (linkData.user?.id) {
    await serviceClient
      .from('athletes')
      .update({ auth_user_id: linkData.user.id })
      .eq('athlete_id', athlete_id)
  }

  return NextResponse.json({ ok: true, athlete_id })
}
