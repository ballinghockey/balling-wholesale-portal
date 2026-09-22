'use client'

import { useState, useCallback, useRef } from 'react'

type OrderLine = {
  id: string
  sku: string
  product_name: string
  size: string
  qty: number
  final_unit_price: number
  line_total: number
}

type Product = {
  sku: string
  product_name: string
  size: string
  base_price_gbp: number
  base_price_eur: number
  category: string
}

export default function OrderEditor({
  orderId,
  initialLines,
  currency,
  onClose,
  onSaved,
}: {
  orderId: string
  initialLines: OrderLine[]
  currency: string
  onClose: () => void
  onSaved: (updatedLines: OrderLine[]) => void
}) {
  const symbol = currency === 'GBP' ? '£' : '€'
  const [lines, setLines] = useState<OrderLine[]>(initialLines)
  const [saving, setSaving] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [addQty, setAddQty] = useState<Record<string, number>>({})
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [changes, setChanges] = useState<string[]>([])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/admin/edit-order?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data.products ?? [])
    setSearching(false)
  }, [])

  function handleSearchChange(q: string) {
    setSearchQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => search(q), 400)
  }

  async function updateQty(line: OrderLine, newQty: number) {
    if (newQty < 1) return
    setSaving(line.id)
    const res = await fetch('/api/admin/edit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_qty',
        orderId,
        lineId: line.id,
        qty: newQty,
        unitPrice: line.final_unit_price,
      }),
    })
    if (res.ok) {
      const oldQty = line.qty
      setLines(prev => prev.map(l => l.id === line.id
        ? { ...l, qty: newQty, line_total: newQty * l.final_unit_price }
        : l
      ))
      setChanges(prev => [...prev, `Changed ${line.product_name} (${line.size}) qty from ${oldQty} to ${newQty}`])
    }
    setSaving(null)
  }

  async function deleteLine(lineId: string) {
    const lineToDelete = lines.find(l => l.id === lineId)
    setSaving(lineId)
    const res = await fetch('/api/admin/edit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_line', orderId, lineId }),
    })
    if (res.ok) {
      setLines(prev => prev.filter(l => l.id !== lineId))
      if (lineToDelete) {
        setChanges(prev => [...prev, `Removed ${lineToDelete.product_name} (${lineToDelete.size}) × ${lineToDelete.qty}`])
      }
    }
    setSaving(null)
  }

  async function addLine(product: Product) {
    const qty = addQty[product.sku] ?? 1
    const unitPrice = currency === 'GBP' ? product.base_price_gbp : product.base_price_eur
    setSaving(`add-${product.sku}`)
    const res = await fetch('/api/admin/edit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_line',
        orderId,
        sku: product.sku,
        productName: product.product_name,
        size: product.size,
        qty,
        unitPrice,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setLines(prev => [...prev, {
        id: data.id ?? Date.now().toString(),
        sku: product.sku,
        product_name: product.product_name,
        size: product.size,
        qty,
        final_unit_price: unitPrice,
        line_total: qty * unitPrice,
      }])
      setChanges(prev => [...prev, `Added ${product.product_name} (${product.size}) × ${qty}`])
      setSearchQuery('')
      setSearchResults([])
      setAddQty({})
    }
    setSaving(null)
  }

  const netTotal = lines.reduce((sum, l) => sum + l.line_total, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">Edit order</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Current lines */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Order lines</p>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.id} className="flex items-center gap-3 bg-neutral-50 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{line.product_name}</p>
                    <p className="text-xs text-neutral-400">{line.size} · {line.sku} · {symbol}{line.final_unit_price.toFixed(2)}/unit</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => updateQty(line, parseInt(e.target.value) || 1)}
                    disabled={saving === line.id}
                    className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
                  />
                  <span className="text-sm font-semibold text-neutral-900 w-16 text-right">
                    {symbol}{line.line_total.toFixed(2)}
                  </span>
                  <button
                    onClick={() => deleteLine(line.id)}
                    disabled={saving === line.id}
                    className="text-neutral-300 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-50"
                  >×</button>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">No lines in this order</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
            <span className="text-sm font-medium text-neutral-700">Subtotal</span>
            <span className="text-sm font-bold text-neutral-900">{symbol}{netTotal.toFixed(2)}</span>
          </div>

          {/* Add product */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Add product</p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {searching && <p className="text-xs text-neutral-400 mt-1">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-neutral-200 rounded-lg overflow-hidden">
                {searchResults.map((product) => {
                  const price = currency === 'GBP' ? product.base_price_gbp : product.base_price_eur
                  return (
                    <div key={product.sku} className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{product.product_name}</p>
                        <p className="text-xs text-neutral-400">{product.size} · {product.sku} · {symbol}{price.toFixed(2)}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={addQty[product.sku] ?? 1}
                        onChange={(e) => setAddQty(prev => ({ ...prev, [product.sku]: parseInt(e.target.value) || 1 }))}
                        className="w-14 rounded-lg border border-neutral-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      <button
                        onClick={() => addLine(product)}
                        disabled={saving === `add-${product.sku}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {saving === `add-${product.sku}` ? '...' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-200 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-neutral-200 text-neutral-600 py-2.5 text-sm font-medium hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              if (changes.length > 0) {
                setShowNotifyModal(true)
              } else {
                onSaved(lines); onClose()
              }
            }}
            className="flex-1 rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>

      {showNotifyModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Notify customer?</h3>
            <p className="text-sm text-neutral-500 mb-3">The following changes were made:</p>
            <ul className="mb-4 space-y-1">
              {changes.map((c, i) => (
                <li key={i} className="text-xs text-neutral-700 bg-neutral-50 rounded px-2 py-1">{c}</li>
              ))}
            </ul>
            <p className="text-sm text-neutral-500 mb-6">Send an email to the customer with these changes and the updated order?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowNotifyModal(false); onSaved(lines); onClose() }}
                className="flex-1 rounded-lg border border-neutral-200 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Skip notification
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/admin/edit-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'notify_customer', orderId, changes }),
                  })
                  setShowNotifyModal(false)
                  onSaved(lines)
                  onClose()
                }}
                className="flex-1 rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 transition-colors"
              >
                Send notification
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
  )
}
