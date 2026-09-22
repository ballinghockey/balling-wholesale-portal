'use client'

import { useState } from 'react'
import OrderEditor from './OrderEditor'

type ProductPromotion = {
  id: string; product_group: string; product_name: string
  discount_pct: number; start_date: string; end_date: string; active: boolean
}

type OrderLine = {
  id: string; sku: string; product_name: string; size: string; qty: number
  final_unit_price: number; line_total: number
}
type WholesaleOrder = {
  order_id: string; order_date: string; currency: string; net_total: number
  grand_total: number; status: string; customer_id: string
  customerName: string; customerEmail: string; order_lines: OrderLine[]
  loyalty_credit_applied?: number
}
type AthleteOrder = {
  order_id: string; order_date: string; currency: string; status: string
  customer_id: string; athleteName: string; athleteEmail: string
  shipping_address: Record<string, string> | null; order_lines: OrderLine[]
}
type Customer = {
  customer_id: string; customer_name: string; contact_name: string
  email_login: string; country: string; warehouse: string; currency: string
  vat_rule: string; active: boolean; customer_type?: string
  discounts: { sticks_pct: number; bags_pct: number; accessories_pct: number; apparel_pct: number; shoes_pct: number } | null
  promotions?: ProductPromotion[]
}
type Athlete = {
  athlete_id: string; athlete_name: string; contact_name: string
  email_login: string; country: string; warehouse: string; currency: string; active: boolean
  credits: { sticks: number; bags: number; accessories: number; apparel: number; shoes: number; padel: number } | null
}

const STATUS_OPTIONS = ['submitted', 'confirmed', 'shipped', 'cancelled']
const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function OrderCard({ orderId, orderDate, status, title, subtitle, currency, total, lines, shippingAddress, isAthlete, loyaltyCreditApplied }: {
  orderId: string; orderDate: string; status: string; title: string; subtitle: string
  currency?: string; total?: number; lines: OrderLine[]
  shippingAddress?: Record<string, string> | null; isAthlete: boolean
  loyaltyCreditApplied?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [saving, setSaving] = useState(false)
  const [editingOrder, setEditingOrder] = useState(false)
  const [currentLines, setCurrentLines] = useState<OrderLine[]>(lines)
  const [confirmingStatus, setConfirmingStatus] = useState<string | null>(null)
  const [shippingModal, setShippingModal] = useState(false)
  const [shippingInfo, setShippingInfo] = useState({ carrier: '', tracking: '', url: '' })
  const ref = orderId.slice(0, 8).toUpperCase()
  const symbol = currency === 'GBP' ? '£' : '€'
  const totalUnits = currentLines.reduce((sum, l) => sum + l.qty, 0)

  function handleStatusClick(newStatus: string) {
    if (newStatus === 'shipped') {
      setShippingModal(true)
    } else {
      setConfirmingStatus(newStatus)
    }
  }

  async function updateStatus(newStatus: string, shipping?: { carrier: string; tracking: string; url: string }) {
    setSaving(true)
    setConfirmingStatus(null)
    setShippingModal(false)
    try {
      const res = await fetch('/api/admin/update-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus, shipping }),
      })
      if (res.ok) setCurrentStatus(newStatus)
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-neutral-50 transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-900 text-sm">{title}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${STATUS_STYLES[currentStatus] ?? STATUS_STYLES.submitted}`}>
              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
            </span>
            {isAthlete && <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">Athlete</span>}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">{formatDate(orderDate)} · Ref {ref} · {totalUnits} units</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {!isAthlete && total !== undefined && <span className="font-semibold text-neutral-900 text-sm">{symbol}{total.toFixed(2)}</span>}
          <span className="text-neutral-400 text-sm">{expanded ? '−' : '+'}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-neutral-100 px-4 pb-4">
          <div className="mt-3 mb-4 text-xs text-neutral-500 space-y-1">
            <p><span className="font-medium text-neutral-700">{isAthlete ? 'Athlete' : 'Customer'}:</span> {title}</p>
            <p><span className="font-medium text-neutral-700">Email:</span> {subtitle}</p>
          </div>
          {isAthlete && shippingAddress && (
            <div className="mb-4 p-3 bg-neutral-50 rounded-lg text-xs text-neutral-600">
              <p className="font-medium text-neutral-700 mb-1">Shipping address</p>
              <p>{shippingAddress.name}</p>
              <p>{shippingAddress.line1}{shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}</p>
              <p>{shippingAddress.city}{shippingAddress.county ? `, ${shippingAddress.county}` : ''}, {shippingAddress.postcode}</p>
              <p>{shippingAddress.country}</p>
            </div>
          )}
          <table className="w-full mb-4">
            <thead>
              <tr className="text-xs text-neutral-400 uppercase tracking-wide">
                <th className="text-left pb-2 font-medium">Product</th>
                <th className="text-center pb-2 font-medium">Qty</th>
                {!isAthlete && <th className="text-right pb-2 font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {currentLines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4">
                    <p className="text-sm font-medium text-neutral-900">{line.product_name}</p>
                    <p className="text-xs text-neutral-400">{line.size} · {line.sku}</p>
                  </td>
                  <td className="py-2 text-center text-sm text-neutral-700">{line.qty}</td>
                  {!isAthlete && <td className="py-2 text-right text-sm font-medium">{symbol}{(line.line_total ?? 0).toFixed(2)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!isAthlete && total !== undefined && loyaltyCreditApplied !== undefined && loyaltyCreditApplied > 0 && (
            <div className="mb-3 px-3 py-2 bg-emerald-50 rounded-lg">
              <p className="text-xs text-emerald-700">
                🎁 Loyalty credit applied: -{symbol}{loyaltyCreditApplied.toFixed(2)}
              </p>
              <p className="text-xs text-emerald-600 font-semibold">
                Total after credit: {symbol}{(total - loyaltyCreditApplied).toFixed(2)}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500">Status:</span>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} disabled={s === currentStatus || saving} onClick={() => handleStatusClick(s)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${s === currentStatus ? `${STATUS_STYLES[s]} cursor-default` : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <button
              onClick={() => setEditingOrder(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
            >
              ✏️ Edit order
            </button>
          </div>
        </div>
      )}
      {editingOrder && (
        <OrderEditor
          orderId={orderId}
          initialLines={currentLines}
          currency={currency ?? 'GBP'}
          onClose={() => setEditingOrder(false)}
          onSaved={(updatedLines) => {
            setCurrentLines(updatedLines)
            setEditingOrder(false)
          }}
        />
      )}

      {/* Confirm status modal */}
      {confirmingStatus && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Change status</h3>
            <p className="text-sm text-neutral-500 mb-6">
              Are you sure you want to mark this order as <strong>{confirmingStatus}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmingStatus(null)}
                className="flex-1 rounded-lg border border-neutral-200 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateStatus(confirmingStatus)}
                className="flex-1 rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping modal */}
      {shippingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-4">Mark as shipped</h3>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Carrier (e.g. DHL, FedEx)</label>
                <input type="text" value={shippingInfo.carrier}
                  onChange={(e) => setShippingInfo(p => ({ ...p, carrier: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="DHL" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Tracking number</label>
                <input type="text" value={shippingInfo.tracking}
                  onChange={(e) => setShippingInfo(p => ({ ...p, tracking: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="1Z999AA10123456784" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Tracking URL (optional)</label>
                <input type="url" value={shippingInfo.url}
                  onChange={(e) => setShippingInfo(p => ({ ...p, url: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="https://track.dhl.com/..." />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShippingModal(false)}
                className="flex-1 rounded-lg border border-neutral-200 text-neutral-600 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateStatus('shipped', shippingInfo)}
                className="flex-1 rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 transition-colors">
                Mark as shipped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AthleteRow({ athlete, onSaved }: { athlete: Athlete; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [credits, setCredits] = useState(athlete.credits ?? { sticks: 0, bags: 0, accessories: 0, apparel: 0, shoes: 0, padel: 0 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'athlete_credits', id: athlete.athlete_id, data: credits }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); setEditing(false); onSaved() }
  }

  const creditFields = ['sticks', 'bags', 'accessories', 'shoes', 'padel'] as const

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900 text-sm">{athlete.athlete_name}</p>
          <p className="text-xs text-neutral-400">{athlete.email_login} · {athlete.warehouse} · {athlete.currency}</p>
        </div>
        <button onClick={() => setEditing(!editing)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition-colors">
          {editing ? 'Cancel' : 'Edit credits'}
        </button>
      </div>

      {!editing && athlete.credits && (
        <div className="px-4 pb-3 flex gap-3 flex-wrap">
          {creditFields.map((f) => (
            <div key={f} className="text-center">
              <p className="text-xs text-neutral-400 capitalize">{f}</p>
              <p className="text-sm font-semibold text-neutral-900">{(athlete.credits as any)[f]}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
          <p className="text-xs text-neutral-500 mb-3 font-medium">Credits per category</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {creditFields.map((f) => (
              <div key={f}>
                <label className="block text-xs text-neutral-400 mb-1 capitalize">{f}</label>
                <input type="number" min={0} value={(credits as any)[f]}
                  onChange={(e) => setCredits((prev) => ({ ...prev, [f]: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            className="w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : saved ? '✅ Saved' : 'Save credits'}
          </button>
        </div>
      )}
    </div>
  )
}

function CustomerRow({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [discounts, setDiscounts] = useState(customer.discounts ?? { sticks_pct: 0, bags_pct: 0, accessories_pct: 0, apparel_pct: 0, shoes_pct: 0 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loyaltyEditing, setLoyaltyEditing] = useState(false)
  const [loyaltyForm, setLoyaltyForm] = useState({ spend_threshold: '500', credit_amount: '50', active: false })
  const [loyaltySaving, setLoyaltySaving] = useState(false)
  const [loyaltySaved, setLoyaltySaved] = useState(false)

  async function saveLoyalty() {
    setLoyaltySaving(true)
    await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'loyalty_rule',
        id: customer.customer_id,
        data: {
          spend_threshold: parseFloat(loyaltyForm.spend_threshold),
          credit_amount: parseFloat(loyaltyForm.credit_amount),
          active: loyaltyForm.active,
        }
      }),
    })
    setLoyaltySaving(false)
    setLoyaltySaved(true)
    setTimeout(() => setLoyaltySaved(false), 2000)
    setLoyaltyEditing(false)
    onSaved()
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'customer_discounts', id: customer.customer_id, data: discounts }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); setEditing(false); onSaved() }
  }

  const discountFields = [
    { key: 'sticks_pct', label: 'Sticks' },
    { key: 'bags_pct', label: 'Bags' },
    { key: 'accessories_pct', label: 'Accessories' },
    { key: 'apparel_pct', label: 'Apparel' },
    { key: 'shoes_pct', label: 'Shoes' },
  ] as const

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900 text-sm">{customer.customer_name}</p>
          <p className="text-xs text-neutral-400">{customer.email_login} · {customer.warehouse} · {customer.currency} · {customer.vat_rule}</p>
        </div>
        <button onClick={() => setEditing(!editing)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition-colors">
          {editing ? 'Cancel' : 'Edit discounts'}
        </button>
      </div>

      {!editing && customer.discounts && (
        <div className="px-4 pb-3 flex gap-3 flex-wrap">
          {discountFields.map(({ key, label }) => (
            <div key={key} className="text-center">
              <p className="text-xs text-neutral-400">{label}</p>
              <p className="text-sm font-semibold text-neutral-900">{(customer.discounts as any)[key]}%</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
          <p className="text-xs text-neutral-500 mb-3 font-medium">Additional discount % per category</p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {discountFields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-neutral-400 mb-1">{label}</label>
                <input type="number" min={0} max={100} value={(discounts as any)[key]}
                  onChange={(e) => setDiscounts((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            className="w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : saved ? '✅ Saved' : 'Save discounts'}
          </button>
        </div>
      )}

      {/* Loyalty config */}
      <div className="border-t border-neutral-100 px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-neutral-500">Loyalty rewards</p>
        <button onClick={() => setLoyaltyEditing(!loyaltyEditing)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition-colors">
          {loyaltyEditing ? 'Cancel' : 'Configure'}
        </button>
      </div>
      {loyaltyEditing && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`loyalty-active-${customer.customer_id}`}
              checked={loyaltyForm.active}
              onChange={(e) => setLoyaltyForm(prev => ({ ...prev, active: e.target.checked }))}
              className="rounded" />
            <label htmlFor={`loyalty-active-${customer.customer_id}`} className="text-xs text-neutral-600">Enable loyalty rewards</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Spend threshold</label>
              <input type="number" min={1} value={loyaltyForm.spend_threshold}
                onChange={(e) => setLoyaltyForm(prev => ({ ...prev, spend_threshold: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Credit amount</label>
              <input type="number" min={1} value={loyaltyForm.credit_amount}
                onChange={(e) => setLoyaltyForm(prev => ({ ...prev, credit_amount: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          </div>
          <button onClick={saveLoyalty} disabled={loyaltySaving}
            className="w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {loyaltySaving ? 'Saving...' : loyaltySaved ? '✅ Saved' : 'Save loyalty config'}
          </button>
        </div>
      )}

      {/* Product promotions */}
      <ProductPromos customerId={customer.customer_id} promos={customer.promotions ?? []} onSaved={onSaved} />
    </div>
  )
}

type CatalogProduct = { product_group: string; product_name: string; category: string; subcategory?: string; sku?: string }

function ProductPromos({ customerId, promos, onSaved }: {
  customerId: string; promos: ProductPromotion[]; onSaved: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [localPromos, setLocalPromos] = useState<ProductPromotion[]>(promos)
  const [searchFilter, setSearchFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [discount, setDiscount] = useState('10')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10))
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const CATEGORIES = ['Sticks', 'Bags', 'Accessories', 'Shoes', 'Padel']

  async function loadProducts() {
    setLoadingProducts(true)
    const res = await fetch('/api/admin/edit-order?q=')
    const data = await res.json()
    const seen = new Set<string>()
    const unique = (data.products ?? []).filter((p: any) => {
      if (seen.has(p.product_group)) return false
      seen.add(p.product_group)
      return true
    })
    setAllProducts(unique)
    setLoadingProducts(false)
    setActiveCategory('Sticks')
  }

  function toggleProduct(product_group: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(product_group)) next.delete(product_group)
      else next.add(product_group)
      return next
    })
  }

  async function addPromos() {
    if (selected.size === 0 || !endDate) return
    setSaving(true)
    for (const pg of selected) {
      const product = allProducts.find(p => p.product_group === pg)
      await fetch('/api/admin/update-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'product_promo_add', id: customerId,
          data: { product_group: pg, product_name: product?.product_name ?? pg, discount_pct: discount, start_date: startDate, end_date: endDate }
        }),
      })
    }
    // Update local state immediately
    const newPromos: ProductPromotion[] = []
    for (const pg of selected) {
      const product = allProducts.find(p => p.product_group === pg)
      newPromos.push({
        id: Math.random().toString(),
        product_group: pg,
        product_name: product?.product_name ?? pg,
        discount_pct: parseFloat(discount),
        start_date: startDate,
        end_date: endDate,
        active: true,
      })
    }
    setLocalPromos(prev => [...prev, ...newPromos])
    setSaving(false)
    setAdding(false)
    setSelected(new Set())
    setDiscount('10')
    setEndDate('')
    onSaved()
  }

  async function removePromo(promoId: string) {
    await fetch('/api/admin/update-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product_promo_delete', id: promoId }),
    })
    setLocalPromos(prev => prev.filter(p => p.id !== promoId))
    onSaved()
  }

  const filteredProducts = allProducts.filter(p =>
    p.category === activeCategory &&
    (searchFilter === '' || p.product_name.toLowerCase().includes(searchFilter.toLowerCase()) || (p.subcategory ?? '').toLowerCase().includes(searchFilter.toLowerCase()))
  )

  return (
    <div className="border-t border-neutral-100">
      <div className="px-4 py-3 flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
          Product promotions {localPromos.length > 0 && <span className="ml-1 text-emerald-600 font-medium">({localPromos.length} active)</span>}
        </button>
        <button onClick={() => { setExpanded(true); setAdding(true); loadProducts() }}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition-colors">
          + Add promo
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {localPromos.length > 0 && (
            <div className="space-y-2">
              {localPromos.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-neutral-900">{p.product_name}</p>
                    <p className="text-xs text-neutral-400">{p.discount_pct}% extra · {p.start_date} → {p.end_date}</p>
                  </div>
                  <button onClick={() => removePromo(p.id)}
                    className="text-neutral-300 hover:text-red-400 transition-colors text-lg leading-none ml-3">×</button>
                </div>
              ))}
            </div>
          )}
          {adding && (
            <div className="border border-neutral-200 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Discount %</label>
                  <input type="number" min={1} max={100} value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Start date</label>
                  <input type="date" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">End date *</label>
                  <input type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              </div>

              {/* Search filter */}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter products..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />

              {/* Category tabs */}
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${activeCategory === cat ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product list */}
              {loadingProducts ? (
                <p className="text-xs text-neutral-400 text-center py-4">Loading products...</p>
              ) : (
                <div className="border border-neutral-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No products in this category</p>
                  ) : filteredProducts.map((p) => (
                    <button key={p.product_group} onClick={() => toggleProduct(p.product_group)}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-neutral-100 last:border-0 flex items-center gap-2 transition-colors ${selected.has(p.product_group) ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-neutral-50 text-neutral-700'}`}>
                      <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${selected.has(p.product_group) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-300'}`}>
                        {selected.has(p.product_group) ? '✓' : ''}
                      </span>
                      <span className="flex-1">{p.product_name}</span>
                      {p.subcategory && <span className="text-neutral-400 ml-2 flex-shrink-0">{p.subcategory}</span>}
                    </button>
                  ))}
                </div>
              )}

              {selected.size > 0 && (
                <p className="text-xs text-emerald-600 font-medium">{selected.size} product{selected.size > 1 ? 's' : ''} selected</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); setSelected(new Set()) }}
                  className="flex-1 rounded-lg border border-neutral-200 text-neutral-600 py-1.5 text-xs hover:bg-neutral-50 transition-colors">
                  Cancel
                </button>
                <button onClick={addPromos} disabled={saving || selected.size === 0 || !endDate}
                  className="flex-1 rounded-lg bg-neutral-900 text-white py-1.5 text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving...' : `Add ${selected.size > 0 ? selected.size : ''} promo${selected.size > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const EUROPEAN_COUNTRIES = [
  'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
  'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland',
  'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
  'Norway', 'Poland', 'Portugal', 'Romania', 'San Marino', 'Serbia', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
]

function AddAthleteForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    athlete_name: '', contact_name: '', email: '', country: '', warehouse: 'UK', currency: 'GBP',
    credits_sticks: '0', credits_bags: '0', credits_accessories: '0',
    credits_shoes: '0', credits_padel: '0',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function set(key: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'warehouse') next.currency = value === 'UK' ? 'GBP' : 'EUR'
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const res = await fetch('/api/admin/invite-athlete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong') }
    else {
      setSuccess(`✅ ${form.athlete_name} added (${data.athlete_id}). Invite sent to ${form.email}.`)
      setForm({ athlete_name: '', contact_name: '', email: '', country: '', warehouse: 'UK', currency: 'GBP',
        credits_sticks: '0', credits_bags: '0', credits_accessories: '0', credits_shoes: '0', credits_padel: '0' })
      onSuccess()
    }
  }

  const creditFields = [
    { key: 'credits_sticks', label: 'Sticks' }, { key: 'credits_bags', label: 'Bags' },
    { key: 'credits_accessories', label: 'Accessories' },
    { key: 'credits_shoes', label: 'Shoes' }, { key: 'credits_padel', label: 'Padel' },
  ]

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
      <h3 className="font-semibold text-neutral-900 text-sm">Add new athlete</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Full name *</label>
          <input required value={form.athlete_name} onChange={(e) => set('athlete_name', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="John Smith" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Email *</label>
          <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="athlete@club.com" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Country</label>
          <select value={form.country} onChange={(e) => set('country', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="">Select country</option>
            {EUROPEAN_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Warehouse *</label>
          <select value={form.warehouse} onChange={(e) => set('warehouse', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="UK">UK (£ GBP)</option>
            <option value="EU">EU (€ EUR)</option>
          </select>
        </div>
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-2 font-medium">Credits per category</p>
        <div className="grid grid-cols-3 gap-2">
          {creditFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-neutral-400 mb-1">{label}</label>
              <input type="number" min={0} value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
        {loading ? 'Adding...' : 'Add athlete & send invite'}
      </button>
    </form>
  )
}

function AddCustomerForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    customer_name: '', contact_name: '', email: '', country: '',
    warehouse: 'UK', currency: 'GBP', vat_rule: 'UK_STANDARD', shipping_rule: 'UK_STANDARD',
    customer_type: 'wholesale',
    discount_sticks: '0', discount_bags: '0', discount_accessories: '0', discount_apparel: '0', discount_shoes: '0',
    loyalty_active: 'false', loyalty_threshold: '500', loyalty_credit: '50',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function set(key: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'warehouse') {
        next.currency = value === 'UK' ? 'GBP' : 'EUR'
        next.vat_rule = next.customer_type === 'club' ? 'CLUB_INCLUDED' : (value === 'UK' ? 'UK_STANDARD' : 'EU_EXEMPT')
        next.shipping_rule = value === 'UK' ? 'UK_STANDARD' : 'EU_STANDARD'
      }
      if (key === 'customer_type') {
        next.vat_rule = value === 'club' ? 'CLUB_INCLUDED' : (next.warehouse === 'UK' ? 'UK_STANDARD' : 'EU_EXEMPT')
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const res = await fetch('/api/admin/invite-customer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong') }
    else {
      setSuccess(`✅ ${form.customer_name} added (${data.customer_id}). Invite sent to ${form.email}.`)
      setForm({ customer_name: '', contact_name: '', email: '', country: '', warehouse: 'UK', currency: 'GBP',
        vat_rule: 'UK_STANDARD', shipping_rule: 'UK_STANDARD',
        customer_type: 'wholesale',
        discount_sticks: '0', discount_bags: '0', discount_accessories: '0', discount_apparel: '0', discount_shoes: '0',
        loyalty_active: 'false', loyalty_threshold: '500', loyalty_credit: '50' })
      onSuccess()
    }
  }

  const discountFields = [
    { key: 'discount_sticks', label: 'Sticks' }, { key: 'discount_bags', label: 'Bags' },
    { key: 'discount_accessories', label: 'Accessories' }, { key: 'discount_apparel', label: 'Apparel' },
    { key: 'discount_shoes', label: 'Shoes' },
  ]
  const vatOptions = [
    { value: 'UK_STANDARD', label: 'UK Standard (20%)' },
    { value: 'EU_EXEMPT', label: 'EU Exempt (0%)' },
    { value: 'ES_STANDARD', label: 'Spain (21%)' },
    { value: 'CLUB_INCLUDED', label: 'Club — VAT included in price' },
  ]

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
      <h3 className="font-semibold text-neutral-900 text-sm">Add new customer</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Company name *</label>
          <input required value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Hockey Club Ltd" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Contact name</label>
          <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="John Smith" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Email *</label>
          <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="orders@club.com" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Country</label>
          <select value={form.country} onChange={(e) => set('country', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="">Select country</option>
            {EUROPEAN_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Warehouse *</label>
          <select value={form.warehouse} onChange={(e) => set('warehouse', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="UK">UK (£ GBP)</option>
            <option value="EU">EU (€ EUR)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">VAT rule *</label>
          <select value={form.vat_rule} onChange={(e) => set('vat_rule', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            {vatOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Customer type *</label>
          <select value={form.customer_type} onChange={(e) => set('customer_type', e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="wholesale">Wholesale (base price)</option>
            <option value="club">Club (RRP with discount)</option>
          </select>
        </div>
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-2 font-medium">
          {form.customer_type === 'club' ? 'Club discount % off RRP per category' : 'Additional discount % per category'}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {discountFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-neutral-400 mb-1">{label}</label>
              <input type="number" min={0} max={100} value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="loyalty-active-new"
            checked={form.loyalty_active === 'true'}
            onChange={(e) => set('loyalty_active', e.target.checked ? 'true' : 'false')}
            className="rounded" />
          <label htmlFor="loyalty-active-new" className="text-xs font-medium text-neutral-700">Enable loyalty rewards</label>
        </div>
        {form.loyalty_active === 'true' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Spend threshold ({form.currency === 'GBP' ? '£' : '€'})</label>
              <input type="number" min={1} value={form.loyalty_threshold}
                onChange={(e) => set('loyalty_threshold', e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Credit amount ({form.currency === 'GBP' ? '£' : '€'})</label>
              <input type="number" min={1} value={form.loyalty_credit}
                onChange={(e) => set('loyalty_credit', e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
        {loading ? 'Adding...' : 'Add customer & send invite'}
      </button>
    </form>
  )
}

export default function AdminView({ wholesaleOrders, athleteOrders, customers, athletes }: {
  wholesaleOrders: WholesaleOrder[]; athleteOrders: AthleteOrder[]
  customers: Customer[]; athletes: Athlete[]
}) {
  const [activeTab, setActiveTab] = useState<'wholesale' | 'athlete_orders' | 'customers' | 'clubs' | 'athletes' | 'add'>('wholesale')
  const [addTab, setAddTab] = useState<'athlete' | 'customer'>('athlete')
  const [refreshKey, setRefreshKey] = useState(0)

  const tabs = [
    { key: 'wholesale', label: 'Wholesale', count: wholesaleOrders.length },
    { key: 'athlete_orders', label: 'Athlete orders', count: athleteOrders.length },
    { key: 'customers', label: 'Customers', count: customers.filter(c => c.customer_type !== 'club').length },
    { key: 'clubs', label: 'Clubs', count: customers.filter(c => c.customer_type === 'club').length },
    { key: 'athletes', label: 'Athletes', count: athletes.length },
    { key: 'add', label: '+ Add new', count: null },
  ] as const

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Admin</h1>
        <p className="text-sm text-neutral-500">Order management & user setup</p>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-neutral-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}>
            {tab.label}
            {tab.count !== null && <span className="ml-1.5 text-xs text-neutral-400">({tab.count})</span>}
          </button>
        ))}
      </nav>

      {activeTab === 'wholesale' && (
        <div className="space-y-3">
          {wholesaleOrders.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-12">No wholesale orders yet.</p>
            : wholesaleOrders.map((order) => (
              <OrderCard key={order.order_id} orderId={order.order_id} orderDate={order.order_date}
                status={order.status} title={order.customerName} subtitle={order.customerEmail}
                currency={order.currency} total={order.net_total} lines={order.order_lines} isAthlete={false}
                loyaltyCreditApplied={order.loyalty_credit_applied} />
            ))}
        </div>
      )}

      {activeTab === 'athlete_orders' && (
        <div className="space-y-3">
          {athleteOrders.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-12">No athlete requests yet.</p>
            : athleteOrders.map((order) => (
              <OrderCard key={order.order_id} orderId={order.order_id} orderDate={order.order_date}
                status={order.status} title={order.athleteName} subtitle={order.athleteEmail}
                lines={order.order_lines} shippingAddress={order.shipping_address} isAthlete={true} />
            ))}
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-3">
          {customers.filter(c => c.customer_type !== 'club').length === 0
            ? <p className="text-sm text-neutral-400 text-center py-12">No wholesale customers yet.</p>
            : customers.filter(c => c.customer_type !== 'club').map((c) => (
              <CustomerRow key={c.customer_id} customer={c} onSaved={() => setRefreshKey(k => k + 1)} />
            ))}
        </div>
      )}

      {activeTab === 'clubs' && (
        <div className="space-y-3">
          {customers.filter(c => c.customer_type === 'club').length === 0
            ? <p className="text-sm text-neutral-400 text-center py-12">No clubs yet.</p>
            : customers.filter(c => c.customer_type === 'club').map((c) => (
              <CustomerRow key={c.customer_id} customer={c} onSaved={() => setRefreshKey(k => k + 1)} />
            ))}
        </div>
      )}

      {activeTab === 'athletes' && (
        <div className="space-y-3">
          {athletes.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-12">No athletes yet.</p>
            : athletes.map((a) => <AthleteRow key={a.athlete_id} athlete={a} onSaved={() => setRefreshKey(k => k + 1)} />)}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAddTab('athlete')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === 'athlete' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
              Athlete
            </button>
            <button onClick={() => setAddTab('customer')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === 'customer' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
              Customer
            </button>
          </div>
          {addTab === 'athlete'
            ? <AddAthleteForm key={`a-${refreshKey}`} onSuccess={() => setRefreshKey(k => k + 1)} />
            : <AddCustomerForm key={`c-${refreshKey}`} onSuccess={() => setRefreshKey(k => k + 1)} />}
        </div>
      )}
    </div>
  )
}
