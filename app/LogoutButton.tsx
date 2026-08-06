'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
    >
      Sign out
    </button>
  )
}
