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

  const { type, id, data } = await req.json()

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (type === 'athlete_credits') {
    const { error } = await serviceClient
      .from('athlete_credits')
      .update(data)
      .eq('athlete_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (type === 'customer_discounts') {
    const { error } = await serviceClient
      .from('customer_discounts')
      .update(data)
      .eq('customer_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (type === 'athlete') {
    const { error } = await serviceClient
      .from('athletes')
      .update(data)
      .eq('athlete_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (type === 'customer') {
    const { error } = await serviceClient
      .from('customers')
      .update(data)
      .eq('customer_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
