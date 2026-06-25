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
    redirect('/login')
  }

  const [groups, cartMap] = await Promise.all([
    getCatalogForCustomer(customer),
    getDraftCartForCustomer(customer.customer_id),
  ])

  const initialCart = Object.fromEntries(cartMap)

  return <CatalogView groups={groups} initialCart={initialCart} />
}
