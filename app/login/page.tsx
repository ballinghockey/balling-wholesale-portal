'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError || !data.user) {
      setLoading(false)
      setError('Incorrect email or password. Please try again.')
      return
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('is_admin')
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    setLoading(false)

    if (customer?.is_admin) {
      router.push('/admin')
    } else {
      router.push('/catalog')
    }

    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    setResetLoading(false)

    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full.png"
            alt="Balling Hockey"
            className="h-10 w-auto object-contain mx-auto mb-4"
          />
          <p className="text-sm text-neutral-500">Wholesale Portal</p>
        </div>

        {!showReset ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setShowReset(true); setError(null) }}
              className="w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors pt-1"
            >
              Forgot your password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">Reset your password</h2>
              <p className="text-xs text-neutral-500">Enter your email and we'll send you a link to reset your password.</p>
            </div>
            {!resetSent ? (
              <>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    placeholder="you@company.com"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {resetLoading ? 'Sending...' : 'Send reset link'}
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-emerald-600 font-medium mb-1">✅ Email sent</p>
                <p className="text-xs text-neutral-500">Check your inbox for a link to reset your password.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetSent(false); setError(null) }}
              className="w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              ← Back to sign in
            </button>
          </form>
        )}

        <p className="text-center text-xs text-neutral-400 mt-6">
          Trouble signing in? Contact your Balling representative.
        </p>
      </div>
    </div>
  )
}
