import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { sku, qty } = await req.json()

  if (!sku) {
    return NextResponse.json({ error: 'SKU required' }, { status: 400 })
  }

  // Find entity ID — check customers first, then athletes
  let entityId: string | null = null

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (customer) {
    entityId = customer.customer_id
  } else {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('athlete_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (athlete) entityId = athlete.athlete_id
  }

  if (!entityId) {
    return NextResponse.json({ error: 'No entity found for user' }, { status: 404 })
  }

  // Use service role to bypass RLS for cart operations
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (qty === 0) {
    await admin
      .from('draft_cart')
      .delete()
      .eq('customer_id', entityId)
      .eq('sku', sku)
  } else {
    await admin
      .from('draft_cart')
      .upsert({ customer_id: entityId, sku, qty }, { onConflict: 'customer_id,sku' })
  }

  return NextResponse.json({ ok: true })
}
