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
          No customer linked to this account
        </h1>
        <p className="text-sm text-neutral-600">
          Please contact your Balling representative.
        </p>
      </div>
    )
  }

  const [groups, cartMap] = await Promise.all([
    getCatalogForCustomer(customer),
    getDraftCartForCustomer(customer.customer_id),
  ])

  const initialCart = Object.fromEntries(cartMap)

  return <CatalogView groups={groups} initialCart={initialCart} />
}
