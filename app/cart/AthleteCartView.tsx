'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type CartItem = {
  sku: string
  qty: number
  productName: string
  category: string
  size: string
  imageUrl: string
}

type ShippingAddress = {
  name: string
  line1: string
  line2: string
  city: string
  county: string
  postcode: string
  country: string
}

const ALL_COUNTRIES = [
  'United Kingdom', 'Ireland', 'Spain', 'France', 'Germany', 'Netherlands',
  'Belgium', 'Italy', 'Portugal', 'Sweden', 'Denmark', 'Norway', 'Finland',
  'Austria', 'Switzerland', 'Poland', 'Czech Republic', 'Slovakia', 'Hungary',
  'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Serbia', 'Greece', 'Turkey',
  'Australia', 'New Zealand', 'United States', 'Canada', 'South Africa',
  'Argentina', 'India', 'Malaysia', 'Singapore', 'Other',
]

export default function AthleteCartView({
  items: initialItems,
  athleteId,
  athleteName,
  warehouse,
}: {
  items: CartItem[]
  athleteId: string
  athleteName: string
  warehouse: 'UK' | 'EU'
}) {
  const router = useRouter()
  const [items, setItems] = useState<CartItem[]>(initialItems)
  const [, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})

  const countryOptions = ALL_COUNTRIES

  const [address, setAddress] = useState<ShippingAddress>({
    name: athleteName,
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: '',
    country: countryOptions[0],
  })

  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0)

  const saveQty = useCallback(async (sku: string, qty: number) => {
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, qty }),
    })
  }, [])

  function handleQtyChange(sku: string, value: string) {
    const qty = Math.max(1, parseInt(value || '1', 10))
    setItems((prev) => prev.map((item) => item.sku === sku ? { ...item, qty } : item))
  }

  function handleQtyBlur(sku: string, qty: number) {
    startTransition(() => saveQty(sku, qty))
  }

  async function removeItem(sku: string) {
    setItems((prev) => prev.filter((item) => item.sku !== sku))
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, qty: 0 }),
    })
  }

  function validateAddress(): boolean {
    const errors: Record<string, string> = {}
    if (!address.name.trim()) errors.name = 'Required'
    if (!address.line1.trim()) errors.line1 = 'Required'
    if (!address.city.trim()) errors.city = 'Required'
    if (!address.postcode.trim()) errors.postcode = 'Required'
    if (!address.country.trim()) errors.country = 'Required'

    // UK postcode format validation
    if (warehouse === 'UK' && address.postcode) {
      const ukPostcode = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i
      if (!ukPostcode.test(address.postcode.trim())) {
        errors.postcode = 'Invalid UK postcode format (e.g. SW1A 1AA)'
      }
    }

    setAddressErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function confirmOrder() {
    if (!validateAddress()) return

    setConfirming(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          currency: warehouse === 'UK' ? 'GBP' : 'EUR',
          customerId: athleteId,
          customerName: athleteName,
          isAthlete: true,
          shippingAddress: address,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Order failed')
      }

      setConfirmed(true)
      setItems([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  if (confirmed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Request confirmed!</h1>
        <p className="text-neutral-500 mb-8">Your equipment request has been submitted. Our team will be in touch to arrange delivery.</p>
        <button onClick={() => router.push('/catalog')} className="rounded-lg bg-neutral-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors">
          Back to catalog
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">Your request is empty</h1>
        <p className="text-neutral-500 mb-8">Add products from the catalog to get started.</p>
        <button onClick={() => router.push('/catalog')} className="rounded-lg bg-neutral-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors">
          Go to catalog
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">My request</h1>
          <p className="text-sm text-neutral-500">{totalUnits} {totalUnits === 1 ? 'unit' : 'units'} · {athleteName}</p>
        </div>
        <button onClick={() => router.push('/catalog')} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Back to catalog
        </button>
      </header>

      {/* Items */}
      <div className="space-y-3 mb-8">
        {items.map((item) => (
          <div key={item.sku} className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.productName} className="w-16 h-16 rounded-lg object-contain bg-neutral-100 p-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">{item.productName}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.size} · {item.category}</p>
                  </div>
                  <button onClick={() => removeItem(item.sku)} className="text-neutral-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0" aria-label="Remove item">×</button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-neutral-400">Qty:</span>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                    onBlur={(e) => handleQtyBlur(item.sku, parseInt(e.target.value || '1', 10))}
                    className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shipping address */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4 text-sm">Shipping address</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Full name *</label>
            <input
              type="text"
              value={address.name}
              onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${addressErrors.name ? 'border-red-400' : 'border-neutral-300'}`}
              placeholder="Full name"
            />
            {addressErrors.name && <p className="text-xs text-red-500 mt-1">{addressErrors.name}</p>}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Address line 1 *</label>
            <input
              type="text"
              value={address.line1}
              onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${addressErrors.line1 ? 'border-red-400' : 'border-neutral-300'}`}
              placeholder="Street address, P.O. box"
            />
            {addressErrors.line1 && <p className="text-xs text-red-500 mt-1">{addressErrors.line1}</p>}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Address line 2</label>
            <input
              type="text"
              value={address.line2}
              onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="Apartment, suite, unit, building (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">City *</label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${addressErrors.city ? 'border-red-400' : 'border-neutral-300'}`}
                placeholder="City"
              />
              {addressErrors.city && <p className="text-xs text-red-500 mt-1">{addressErrors.city}</p>}
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {warehouse === 'UK' ? 'County' : 'Region / Province'}
              </label>
              <input
                type="text"
                value={address.county}
                onChange={(e) => setAddress((a) => ({ ...a, county: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder={warehouse === 'UK' ? 'County (optional)' : 'Region (optional)'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {warehouse === 'UK' ? 'Postcode *' : 'Postal code *'}
              </label>
              <input
                type="text"
                value={address.postcode}
                onChange={(e) => setAddress((a) => ({ ...a, postcode: e.target.value.toUpperCase() }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 ${addressErrors.postcode ? 'border-red-400' : 'border-neutral-300'}`}
                placeholder={warehouse === 'UK' ? 'SW1A 1AA' : '28001'}
              />
              {addressErrors.postcode && <p className="text-xs text-red-500 mt-1">{addressErrors.postcode}</p>}
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">Country *</label>
              <select
                value={address.country}
                onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              >
                {countryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4 text-center">{error}</p>}

      <button
        onClick={confirmOrder}
        disabled={confirming || items.length === 0}
        className="w-full rounded-lg bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
      >
        {confirming ? 'Submitting...' : 'Submit request'}
      </button>
      <p className="text-xs text-neutral-400 text-center mt-2">Our team will review and arrange delivery.</p>
    </div>
  )
}
