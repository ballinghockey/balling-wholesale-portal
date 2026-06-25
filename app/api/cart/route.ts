import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const { sku, qty } = await req.json()

  if (!sku || typeof qty !== 'number' || qty < 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  if (qty === 0) {
    // Si la cantidad es 0, eliminamos la línea del carrito
    const { error } = await supabase
      .from('draft_cart')
      .delete()
      .eq('customer_id', customer.customer_id)
      .eq('sku', sku)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, removed: true })
  }

  // Upsert: actualiza si ya existe la fila (customer_id, sku), crea si no.
  // Esto resuelve, a nivel de base de datos, el problema de duplicados
  // que tuvimos en la versión anterior con Softr.
  const { error } = await supabase
    .from('draft_cart')
    .upsert(
      {
        customer_id: customer.customer_id,
        sku,
        qty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id,sku' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
