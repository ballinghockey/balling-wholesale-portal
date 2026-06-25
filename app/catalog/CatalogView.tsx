Confirmado: el archivo real, tal como existe en mi entorno, ya empieza correctamente con 'use client' en la primera línea — sin "Salida", sin "bash", sin nada extra. El problema fue 100% al copiar desde la pantalla del chat.
Para evitar que se repita: copiá con más cuidado esta vez
Te lo muestro de nuevo. Por favor, al seleccionar, empezá justo en la comilla simple de 'use client' (la primera línea de código real), no desde ninguna palabra o etiqueta que esté por encima:
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
const variantBySku = useMemo(() => {

const map = new Map<string, ProductGroupWithVariants['variants'][number] & { currency: string }>()

for (const g of groups) {

for (const v of g.variants) {

map.set(v.sku, v)

}

}

return map

}, [groups])
const { cartCount, subtotal, currencySymbol } = useMemo(() => {

let count = 0

let total = 0

let symbol = '£'

for (const [sku, qty] of Object.entries(cart)) {

if (qty <= 0) continue

const variant = variantBySku.get(sku)

if (!variant) continue

count += qty

total += qty * variant.finalUnitPrice

symbol = variant.currency === 'GBP' ? '£' : '€'

}

return { cartCount: count, subtotal: total, currencySymbol: symbol }

}, [cart, variantBySku])
const activeCategoryDiscount = useMemo(() => {

const sample = groups.find((g) => g.category === activeCategory)

return sample?.variants[0]?.customerDiscountPct ?? 0

}, [groups, activeCategory])
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

<div className="max-w-5xl mx-auto px-4 py-6 pb-24">

<header className="flex items-center justify-between mb-6">

<div>

<h1 className="text-xl font-semibold text-neutral-900">Catálogo</h1>

<p className="text-sm text-neutral-500">Elegí cantidades por talle</p>

</div>
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

  <nav className="flex gap-1 mb-2 border-b border-neutral-200 overflow-x-auto">
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

  {activeCategoryDiscount > 0 && (
    <p className="text-xs text-emerald-700 bg-emerald-50 inline-block px-2.5 py-1 rounded-md mb-6 mt-3">
      Tu descuento en {activeCategory}: {activeCategoryDiscount}%
    </p>
  )}

  <div className={`space-y-4 ${activeCategoryDiscount > 0 ? '' : 'mt-6'}`}>
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

  {cartCount > 0 && (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          {cartCount} {cartCount === 1 ? 'unidad' : 'unidades'} en tu pedido
        </span>
        <span className="text-lg font-semibold text-neutral-900">
          Subtotal: {currencySymbol}{subtotal.toFixed(2)}
        </span>
      </div>
    </div>
  )}
</div>
)

}
