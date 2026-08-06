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
  listPrice: number
  customerDiscountPct: number
  promoDiscountPct: number
  finalUnitPrice: number
  lineTotal: number
  currency: 'GBP' | 'EUR'
  displayListPrice: string
  displayFinalPrice: string
}

const VAT_LABELS: Record<string, string> = {
  EU_EXEMPT: 'VAT exempt (intra-EU)',
  UK_STANDARD: 'VAT 20% will be applied',
  ES_STANDARD: 'VAT 21% will be applied',
}

export default function CartView({
  items: initialItems,
  currency,
  customerId,
  customerName,
  vatRule,
}: {
  items: CartItem[]
  currency: 'GBP' | 'EUR'
  customerId: string
  customerName: string
  vatRule: string
}) {
  const router = useRouter()
  const [items, setItems] = useState<CartItem[]>(initialItems)
  const [, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const symbol = currency === 'GBP' ? '£' : '€'
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0)
  const vatLabel = VAT_LABELS[vatRule] ?? ''

  const saveQty = useCallback(async (sku: string, qty: number) => {
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, qty }),
    })
  }, [])

  function handleQtyChange(sku: string, value: string) {
    const qty = Math.max(1, parseInt(value || '1', 10))
    setItems((prev) =>
      prev.map((item) =>
        item.sku === sku
          ? { ...item, qty, lineTotal: Math.round(item.finalUnitPrice * qty * 100) / 100 }
          : item
      )
    )
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

  async function confirmOrder() {
    setConfirming(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, currency, customerId, customerName }),
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
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Order confirmed!</h1>
        <p className="text-neutral-500 mb-8">
          Your order has been submitted. You'll receive a confirmation email shortly.
        </p>
        <button
          onClick={() => router.push('/catalog')}
          className="rounded-lg bg-neutral-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Back to catalog
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">Your order is empty</h1>
        <p className="text-neutral-500 mb-8">Add products from the catalog to get started.</p>
        <button
          onClick={() => router.push('/catalog')}
          className="rounded-lg bg-neutral-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Go to catalog
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-36">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">My order</h1>
          <p className="text-sm text-neutral-500">
            {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} · {customerName}
          </p>
        </div>
        <button
          onClick={() => router.push('/catalog')}
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Back to catalog
        </button>
      </header>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.sku} className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="w-16 h-16 rounded-lg object-contain bg-neutral-100 p-1 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">{item.productName}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.size} · SKU: {item.sku}</p>
                    {item.customerDiscountPct > 0 && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Additional discount {item.customerDiscountPct}% already applied
                        {item.promoDiscountPct > 0 && ` + promo ${item.promoDiscountPct}%`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.sku)}
                    className="text-neutral-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2">
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

                  <div className="flex-1" />

                  <div className="text-right">
                    {item.customerDiscountPct > 0 && (
                      <p className="text-xs text-neutral-400 line-through">{item.displayListPrice}</p>
                    )}
                    <p className="text-sm font-medium text-neutral-900">{item.displayFinalPrice} / unit</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {symbol}{item.lineTotal.toFixed(2)} total
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-4 text-center">{error}</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-neutral-500">{totalUnits} {totalUnits === 1 ? 'unit' : 'units'}</span>
            <span className="text-lg font-semibold text-neutral-900">
              Subtotal: {symbol}{subtotal.toFixed(2)}
            </span>
          </div>
          {vatLabel && (
            <p className="text-xs text-neutral-400 text-right mb-3">{vatLabel}</p>
          )}
          <button
            onClick={confirmOrder}
            disabled={confirming || items.length === 0}
            className="w-full rounded-lg bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Confirming...' : 'Confirm order'}
          </button>
          <p className="text-xs text-neutral-400 text-center mt-2">
            Your Balling representative will review and confirm your order.
          </p>
        </div>
      </div>
    </div>
  )
}
