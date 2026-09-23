'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import type { ProductGroupWithVariants, AthleteCredits } from '@/lib/catalog'

const CATEGORIES = ['Sticks', 'Bags', 'Accessories', 'Apparel', 'Shoes', 'Padel'] as const
const DEFAULT_VISIBLE = 5

const STOCK_STYLES: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-700',
  'Low Stock': 'bg-amber-50 text-amber-700',
  'Out of Stock': 'bg-neutral-100 text-neutral-500',
}

const CREDIT_CATEGORY_MAP: Record<string, keyof AthleteCredits> = {
  Sticks: 'sticks',
  Bags: 'bags',
  Accessories: 'accessories',
  Shoes: 'shoes',
  Padel: 'padel',
}

export default function AthleteCatalogView({
  groups,
  credits,
  originalCredits,
  usedCredits: initialUsedCredits,
  athleteId,
  athleteName,
}: {
  groups: ProductGroupWithVariants[]
  credits: AthleteCredits
  originalCredits?: AthleteCredits
  usedCredits: Record<string, number>
  athleteId: string
  athleteName: string
}) {
  const availableCategories = useMemo(() => {
    const present = new Set(groups.map((g) => g.category))
    return CATEGORIES.filter((c) => present.has(c))
  }, [groups])

  const [activeCategory, setActiveCategory] = useState<string>(availableCategories[0] ?? 'Sticks')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [usedCredits, setUsedCredits] = useState<Record<string, number>>(initialUsedCredits)
  const [zoomedImage, setZoomedImage] = useState<{ url: string; alt: string } | null>(null)
  const [openSubcategories, setOpenSubcategories] = useState<Set<string>>(new Set())
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())
  const [showAllCategory, setShowAllCategory] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const visibleGroups = useMemo(
    () => groups.filter((g) => g.category === activeCategory),
    [groups, activeCategory]
  )

  const subcategoryBuckets = useMemo(() => {
    const buckets = new Map<string, ProductGroupWithVariants[]>()
    for (const g of visibleGroups) {
      const key = g.subcategory || ''
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(g)
    }
    return buckets
  }, [visibleGroups])

  const hasSubcategories = useMemo(
    () => Array.from(subcategoryBuckets.keys()).some((k) => k !== ''),
    [subcategoryBuckets]
  )

  // Credit calculation for active category
  const creditKey = CREDIT_CATEGORY_MAP[activeCategory] ?? 'accessories'
  const totalCredit = credits[creditKey] ?? 0
  const originalTotal = (originalCredits?.[creditKey as keyof AthleteCredits] ?? totalCredit) as number
  const usedInCategory = usedCredits[activeCategory.toLowerCase()] ?? 0
  const remainingCredit = totalCredit - usedInCategory

  const totalUnitsInCart = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  function toggleSubcategory(key: string) {
    setOpenSubcategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function toggleExpanded(key: string) {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  const updateQty = useCallback((sku: string, qty: number, category: string) => {
    const catKey = category.toLowerCase()
    const oldQty = cart[sku] ?? 0
    const delta = qty - oldQty
    const currentUsed = usedCredits[catKey] ?? 0
    const creditTotal = credits[CREDIT_CATEGORY_MAP[category] ?? 'accessories'] ?? 0

    // Block if exceeds credit
    if (currentUsed + delta > creditTotal) return

    setCart((prev) => ({ ...prev, [sku]: qty }))
    setUsedCredits((prev) => ({ ...prev, [catKey]: currentUsed + delta }))

    if (saveTimers.current[sku]) clearTimeout(saveTimers.current[sku])
    saveTimers.current[sku] = setTimeout(async () => {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, qty, customerId: athleteId }),
      })
    }, 800)
  }, [cart, usedCredits, credits, athleteId])

  function renderProductGroup(group: ProductGroupWithVariants) {
    return (
      <div key={group.productGroup} className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.imageUrl}
            alt={group.productName}
            onClick={() => setZoomedImage({ url: group.imageUrl, alt: group.productName })}
            className="w-20 h-20 rounded-lg object-contain bg-neutral-100 p-1.5 flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-neutral-900">{group.productName}</h3>
              {group.onSale && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex-shrink-0">Sale</span>
              )}
            </div>
            <p className="text-xs text-neutral-400">{group.variants.length} {group.variants.length === 1 ? 'size' : 'sizes'}</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-neutral-100">
          {group.variants.map((v) => {
            const currentQty = cart[v.sku] ?? 0
            const catKey = group.category.toLowerCase()
            const used = usedCredits[catKey] ?? 0
            const creditTotal = credits[CREDIT_CATEGORY_MAP[group.category] ?? 'accessories'] ?? 0
            const canAdd = used < creditTotal && v.stockStatus !== 'Out of Stock'

            return (
              <div key={v.sku} className="flex items-center gap-3 py-3 text-sm">
                <div className="w-16 font-medium text-neutral-700 flex-shrink-0">{v.size}</div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${STOCK_STYLES[v.stockStatus]}`}>
                  {v.stockStatus}
                </span>
                <div className="flex-1 text-neutral-400 text-xs hidden sm:block">
                  <div>SKU: {v.sku}</div>
                </div>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  disabled={!canAdd && currentQty === 0}
                  value={currentQty}
                  onChange={(e) => {
                    const qty = Math.max(0, parseInt(e.target.value || '0', 10))
                    updateQty(v.sku, qty, group.category)
                  }}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-300 flex-shrink-0"
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderProductGroupGrid(group: ProductGroupWithVariants) {
    const catKey = group.category.toLowerCase()
    const used = usedCredits[catKey] ?? 0
    const creditTotal = credits[CREDIT_CATEGORY_MAP[group.category] ?? 'accessories'] ?? 0

    return (
      <div key={group.productGroup} className="bg-white rounded-xl border border-neutral-200 p-3">
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.imageUrl}
            alt={group.productName}
            onClick={() => setZoomedImage({ url: group.imageUrl, alt: group.productName })}
            className="w-full aspect-square rounded-lg object-contain bg-neutral-100 p-2 cursor-zoom-in hover:opacity-90 transition-opacity"
          />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <h3 className="font-medium text-neutral-900 text-xs leading-tight">{group.productName}</h3>
              {group.onSale && (
                <span className="text-xs font-semibold px-1 py-0.5 rounded bg-red-100 text-red-600 flex-shrink-0">Sale</span>
              )}
            </div>
            <div className="space-y-1.5">
              {group.variants.map((v) => {
                const currentQty = cart[v.sku] ?? 0
                const canAdd = used < creditTotal && v.stockStatus !== 'Out of Stock'
                return (
                  <div key={v.sku} className="flex items-center gap-1.5 text-xs">
                    <span className="w-10 font-medium text-neutral-700 flex-shrink-0 text-xs">{v.size}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STOCK_STYLES[v.stockStatus]}`}>
                      {v.stockStatus === 'Out of Stock' ? 'OOS' : v.stockStatus === 'Low Stock' ? 'Low' : 'Avail'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      disabled={!canAdd && currentQty === 0}
                      value={currentQty}
                      onChange={(e) => {
                        const qty = Math.max(0, parseInt(e.target.value || '0', 10))
                        updateQty(v.sku, qty, group.category)
                      }}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="w-12 rounded border border-neutral-300 px-1 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-300 flex-shrink-0 ml-auto"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderBucket(subcat: string, items: ProductGroupWithVariants[]) {
    const isOpen = openSubcategories.has(subcat)
    const isExpanded = expandedSubcategories.has(subcat)
    const visibleItems = isExpanded ? items : items.slice(0, DEFAULT_VISIBLE)
    const hasMore = items.length > DEFAULT_VISIBLE

    return (
      <div key={subcat} className="border border-neutral-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSubcategory(subcat)}
          className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
        >
          <span className="font-medium text-neutral-900 text-sm">
            {subcat}
            <span className="text-neutral-400 ml-2 font-normal">({items.length} {items.length === 1 ? 'model' : 'models'})</span>
          </span>
          <span className="text-neutral-400 text-sm">{isOpen ? '−' : '+'}</span>
        </button>
        {isOpen && (
          <div className="p-3 space-y-3 bg-neutral-50/50">
            {viewMode === 'grid' ? <div className="grid grid-cols-2 gap-2">{visibleItems.map(renderProductGroupGrid)}</div> : visibleItems.map(renderProductGroup)}
            {hasMore && (
              <button
                onClick={() => toggleExpanded(subcat)}
                className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors border border-neutral-200 rounded-lg bg-white"
              >
                {isExpanded ? 'Show less' : `View all ${items.length} models`}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Catalog</h1>
          <p className="text-sm text-neutral-500">Hi {athleteName} — select your items</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-400 hover:text-neutral-700'}`}
            >☰</button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-400 hover:text-neutral-700'}`}
            >⊞</button>
          </div>
          <a
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            My order
            {totalUnitsInCart > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-white text-neutral-900 text-xs font-semibold w-5 h-5">
                {totalUnitsInCart}
              </span>
            )}
          </a>
        </div>
      </header>

      <nav className="flex gap-1 mb-2 border-b border-neutral-200 overflow-x-auto">
        {availableCategories.map((cat) => {
          const ck = CREDIT_CATEGORY_MAP[cat] ?? 'accessories'
          const total = credits[ck] ?? 0
          const used = usedCredits[cat.toLowerCase()] ?? 0
          const remaining = total - used
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowAllCategory(false) }}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeCategory === cat
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {cat}
              {(originalCredits ? (originalCredits[ck] ?? total) : total) > 0 && (
                <span className={`ml-1.5 text-xs font-normal ${remaining === 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                  ({remaining}/{originalCredits ? (originalCredits[ck] ?? total) : total})
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Credit indicator for active category */}
      {totalCredit > 0 && (
        <div className={`flex items-center gap-2 mb-6 mt-3 px-3 py-2 rounded-lg text-sm ${
          remainingCredit === 0
            ? 'bg-red-50 text-red-700'
            : remainingCredit <= 1
            ? 'bg-amber-50 text-amber-700'
            : 'bg-neutral-100 text-neutral-600'
        }`}>
          <div className="flex-1">
            <span className="font-medium">{activeCategory} credit: </span>
            {remainingCredit} of {originalTotal} remaining
          </div>
          <div className="flex gap-1">
            {Array.from({ length: originalTotal }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-sm ${
                  i < usedInCategory ? 'bg-neutral-400' : 'bg-neutral-900'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visibleGroups.length === 0 && (
          <p className="text-sm text-neutral-400 py-12 text-center">No products in this category yet.</p>
        )}

        {showAllCategory ? (
          <>
            {viewMode === 'grid' ? <div className="grid grid-cols-2 gap-2">{visibleGroups.map(renderProductGroupGrid)}</div> : visibleGroups.map(renderProductGroup)}
            <button
              onClick={() => setShowAllCategory(false)}
              className="w-full py-2.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors border border-neutral-200 rounded-xl bg-white"
            >
              Back to collections view
            </button>
          </>
        ) : (
          <>
            {viewMode === 'grid' ? <div className="grid grid-cols-2 gap-2">{(subcategoryBuckets.get('') ?? []).map(renderProductGroupGrid)}</div> : subcategoryBuckets.get('')?.map(renderProductGroup)}
            {hasSubcategories &&
              Array.from(subcategoryBuckets.entries())
                .filter(([key]) => key !== '')
                .sort((a, b) => {
                  const orderA = Math.min(...a[1].map((g: any) => g.sortOrder ?? 0))
                  const orderB = Math.min(...b[1].map((g: any) => g.sortOrder ?? 0))
                  return orderA - orderB
                })
                .map(([subcat, items]) => renderBucket(subcat, items))}
            {hasSubcategories && visibleGroups.length > 0 && (
              <button
                onClick={() => setShowAllCategory(true)}
                className="w-full py-2.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors border border-dashed border-neutral-300 rounded-xl bg-white"
              >
                View all {visibleGroups.length} {activeCategory} models
              </button>
            )}
          </>
        )}
      </div>

      {zoomedImage && (
        <div onClick={() => setZoomedImage(null)} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 cursor-zoom-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomedImage.url} alt={zoomedImage.alt} className="max-w-full max-h-full rounded-lg object-contain" />
          <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 text-neutral-900 flex items-center justify-center text-lg hover:bg-white transition-colors" aria-label="Close">×</button>
        </div>
      )}
    </div>
  )
}
