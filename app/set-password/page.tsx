'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function SetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Process the hash token from the URL
    const handleSession = async () => {
      // Get the hash from the URL
      const hash = window.location.hash
      
      if (hash) {
        // Parse the hash params
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type')

        if (accessToken && refreshToken && (type === 'invite' || type === 'recovery')) {
          // Set the session manually
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (error) {
            setError('Invalid or expired link. Please request a new invitation.')
          } else {
            setReady(true)
          }
        } else {
          setError('Invalid invitation link.')
        }
      } else {
        // No hash — check if already have a session
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setReady(true)
        } else {
          setError('No valid session found. Please use the link from your invitation email.')
        }
      }
      setChecking(false)
    }

    handleSession()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/catalog')
    router.refresh()
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
          <h1 className="text-lg font-semibold text-neutral-900">Set your password</h1>
          <p className="text-sm text-neutral-500 mt-1">Create a password to access the Balling Hockey portal.</p>
        </div>

        {checking ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
            <p className="text-sm text-neutral-500">Verifying your invitation...</p>
          </div>
        ) : !ready ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-neutral-700 mb-1">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Repeat your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Set password & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
