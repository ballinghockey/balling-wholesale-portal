import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    console.log('[cart] Not authenticated')
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  console.log('[cart] User ID:', authData.user.id)

  const body = await req.json()
  const { sku, qty } = body
  console.log('[cart] Body:', JSON.stringify(body))

  if (!sku) {
    return NextResponse.json({ error: 'SKU required' }, { status: 400 })
  }

  // Find entity ID
  let entityId: string | null = null
  let entityType: string | null = null

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (customer) {
    entityId = customer.customer_id
    entityType = 'customer'
  } else {
    const { data: athlete } = await supabase
      .from('athletes')
      .select('athlete_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (athlete) {
      entityId = athlete.athlete_id
      entityType = 'athlete'
    }
  }

  console.log('[cart] Entity:', entityType, entityId)

  if (!entityId) {
    return NextResponse.json({ error: 'No entity found for user' }, { status: 404 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (qty === 0) {
    const { error } = await admin
      .from('draft_cart')
      .delete()
      .eq('customer_id', entityId)
      .eq('sku', sku)
    console.log('[cart] Delete result error:', error?.message ?? 'none')
  } else {
    const { error } = await admin
      .from('draft_cart')
      .upsert({ customer_id: entityId, sku, qty }, { onConflict: 'customer_id,sku' })
    console.log('[cart] Upsert result error:', error?.message ?? 'none')
  }

  return NextResponse.json({ ok: true })
}
