import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Verify admin
  const { data: admin } = await supabase
    .from('customers')
    .select('is_admin')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!admin?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const {
    athlete_name, contact_name, email, country,
    warehouse, currency,
    credits_sticks, credits_bags, credits_accessories,
    credits_apparel, credits_shoes, credits_padel,
  } = await req.json()

  if (!athlete_name || !email || !warehouse || !currency) {
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
      currency,
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
      apparel: parseInt(credits_apparel) || 0,
      shoes: parseInt(credits_shoes) || 0,
      padel: parseInt(credits_padel) || 0,
    })

  if (creditsError) {
    return NextResponse.json({ error: creditsError.message }, { status: 500 })
  }

  // Invite user via Supabase Auth (sends email with password setup link)
  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://balling-wholesale-portal.vercel.app'}/set-password`,
      data: { athlete_id, type: 'athlete' },
    }
  )

  if (inviteError) {
    // Athlete was created but invite failed — still return partial success
    console.error('[invite] Error sending invite:', inviteError.message)
    return NextResponse.json({
      ok: true,
      athlete_id,
      warning: `Athlete created but invite email failed: ${inviteError.message}. Link the user manually in Supabase Auth.`
    })
  }

  // Link auth user to athlete
  if (inviteData?.user?.id) {
    await serviceClient
      .from('athletes')
      .update({ auth_user_id: inviteData.user.id })
      .eq('athlete_id', athlete_id)
  }

  return NextResponse.json({ ok: true, athlete_id })
}
