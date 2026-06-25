import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getCatalogForCustomer, getCustomerForUser, getDraftCartForCustomer } from '@/lib/catalog'
import CatalogView from './CatalogView'

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  if (!authData?.user) {
    redirect('/login')
  }

  const customer = await getCustomerForUser(authData.user.id)

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-lg font-semibold text-red-600 mb-2">
          No se encontró un cliente vinculado a este usuario
        </h1>
        <p className="text-sm text-neutral-600">
          auth_user_id: <code className="bg-neutral-100 px-1 rounded">{authData.user.id}</code>
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          Verificá en Supabase que la tabla <code>customers</code> tenga este UID en la columna{' '}
          <code>auth_user_id</code>.
        </p>
      </div>
    )
  }

  const [groups, cartMap] = await Promise.all([
    getCatalogForCustomer(customer),
    getDraftCartForCustomer(customer.customer_id),
  ])

  const initialCart = Object.fromEntries(cartMap)

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 pt-4 text-xs text-neutral-400">
        Debug: cliente {customer.customer_id} ({customer.customer_name}) — {groups.length} grupos de producto encontrados
      </div>
      <CatalogView groups={groups} initialCart={initialCart} />
    </>
  )
}
