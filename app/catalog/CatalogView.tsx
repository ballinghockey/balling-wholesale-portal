'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ProductGroupWithVariants } from '@/lib/catalog'

const CATEGORIES = ['Sticks', 'Bags', 'Accessories', 'Apparel', 'Shoes'] as const

const STOCK_STYLES: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-700',
  'Low Stock': 'bg-amber-50 text-amber-700',
  'Out of Stock': 'bg-neutral-100 text-neutral-500',
}

export default function CatalogView({
  groups,
  initialCart,
}: {
  groups: ProductGroupWithVariants[]
  initialCart: Record<string, number>
}) {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('Sticks')
  const [cart, setCart] = useState<Record<string, number>>(initialCart)
  const [savingSku, setSavingSku] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visibleGroups = useMemo(
    () => groups.filter((g) => g.category === activeCategory),
    [groups, activeCategory]
  )

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart]
  )

  async function updateQty(sku: string, qty: number) {
    setCart((prev) => ({ ...prev, [sku]: qty }))
    setSavingSku(sku)

    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, qty }),
      })
    } finally {
      setSavingSku(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Catálogo</h1>
          <p className="text-sm text-neutral-500">Elegí cantidades por talle</p>
        </div>
        <a
          href="/cart"
          className="relative inline-flex items-center gap-2 rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Mi pedido
          {cartCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-white text-neutral-900 text-xs font-semibold w-5 h-5">
              {cartCount}
            </span>
          )}
        </a>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-neutral-200 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCategory === cat
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        {visibleGroups.length === 0 && (
          <p className="text-sm text-neutral-400 py-12 text-center">
            No hay productos en esta categoría todavía.
          </p>
        )}

        {visibleGroups.map((group) => (
          <div
            key={group.productGroup}
            className="bg-white rounded-xl border border-neutral-200 p-4"
          >
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={group.imageUrl}
                alt={group.productName}
                className="w-20 h-20 rounded-lg object-cover bg-neutral-100 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-neutral-900">{group.productName}</h3>
                <p className="text-xs text-neutral-400">
                  {group.variants.length} {group.variants.length === 1 ? 'talle' : 'talles'}
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-neutral-100">
              {group.variants.map((v) => (
                <div
                  key={v.sku}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <div className="w-16 font-medium text-neutral-700 flex-shrink-0">
                    {v.size}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${STOCK_STYLES[v.stockStatus]}`}
                  >
                    {v.stockStatus}
                  </span>

                  <div className="flex-1 text-neutral-400 text-xs hidden sm:block">
                    SKU: {v.sku}
                  </div>

                  <div className="font-semibold text-neutral-900 w-20 text-right flex-shrink-0">
                    {v.displayPrice}
                  </div>

                  <input
                    type="number"
                    min={0}
                    disabled={v.stockStatus === 'Out of Stock'}
                    value={cart[v.sku] ?? 0}
                    onChange={(e) => {
                      const qty = Math.max(0, parseInt(e.target.value || '0', 10))
                      startTransition(() => updateQty(v.sku, qty))
                    }}
                    className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-300 flex-shrink-0"
                  />

                  {savingSku === v.sku && (
                    <span className="text-xs text-neutral-300 flex-shrink-0">...</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
