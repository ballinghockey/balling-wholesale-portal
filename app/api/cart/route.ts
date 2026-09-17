import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { sku, qty, customerId } = await req.json()

  if (!sku) {
    return NextResponse.json({ error: 'SKU required' }, { status: 400 })
  }

  // Determine the entity ID (customer or athlete)
  let entityId = customerId

  if (!entityId) {
    // Try to find customer first
    const { data: customer } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (customer) {
      entityId = customer.customer_id
    } else {
      // Try athlete
      const { data: athlete } = await supabase
        .from('athletes')
        .select('athlete_id')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle()

      if (athlete) entityId = athlete.athlete_id
    }
  }

  if (!entityId) {
    return NextResponse.json({ error: 'No entity found for user' }, { status: 404 })
  }

  if (qty === 0) {
    await supabase
      .from('draft_cart')
      .delete()
      .eq('customer_id', entityId)
      .eq('sku', sku)
  } else {
    await supabase
      .from('draft_cart')
      .upsert({ customer_id: entityId, sku, qty }, { onConflict: 'customer_id,sku' })
  }

  return NextResponse.json({ ok: true })
}

  return NextResponse.json({ ok: true })
}
