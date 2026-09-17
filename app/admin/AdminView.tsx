'use client'

import { useState } from 'react'

type OrderLine = {
  sku: string
  product_name: string
  size: string
  qty: number
  final_unit_price?: number
  line_total?: number
}

type WholesaleOrder = {
  order_id: string
  order_date: string
  currency: string
  net_total: number
  grand_total: number
  status: string
  customer_id: string
  customerName: string
  customerEmail: string
  order_lines: OrderLine[]
}

type AthleteOrder = {
  order_id: string
  order_date: string
  currency: string
  status: string
  customer_id: string
  athleteName: string
  athleteEmail: string
  shipping_address: Record<string, string> | null
  order_lines: OrderLine[]
}

const STATUS_OPTIONS = ['submitted', 'confirmed', 'shipped', 'cancelled']

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function OrderCard({
  orderId,
  orderDate,
  status,
  title,
  subtitle,
  currency,
  total,
  lines,
  shippingAddress,
  isAthlete,
}: {
  orderId: string
  orderDate: string
  status: string
  title: string
  subtitle: string
  currency?: string
  total?: number
  lines: OrderLine[]
  shippingAddress?: Record<string, string> | null
  isAthlete: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [saving, setSaving] = useState(false)
  const ref = orderId.slice(0, 8).toUpperCase()
  const symbol = currency === 'GBP' ? '£' : '€'
  const totalUnits = lines.reduce((sum, l) => sum + l.qty, 0)

  async function updateStatus(newStatus: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      })
      if (res.ok) setCurrentStatus(newStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-neutral-900 text-sm">{title}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${STATUS_STYLES[currentStatus] ?? STATUS_STYLES.submitted}`}>
                {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
              </span>
              {isAthlete && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">Athlete</span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">
              {formatDate(orderDate)} · Ref {ref} · {totalUnits} units
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {!isAthlete && total !== undefined && (
            <span className="font-semibold text-neutral-900 text-sm">{symbol}{total.toFixed(2)}</span>
          )}
          <span className="text-neutral-400 text-sm">{expanded ? '−' : '+'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 pb-4">
          {/* Customer/Athlete info */}
          <div className="mt-3 mb-4 text-xs text-neutral-500 space-y-1">
            <p><span className="font-medium text-neutral-700">{isAthlete ? 'Athlete' : 'Customer'}:</span> {title}</p>
            <p><span className="font-medium text-neutral-700">Email:</span> {subtitle}</p>
          </div>

          {/* Shipping address for athletes */}
          {isAthlete && shippingAddress && (
            <div className="mb-4 p-3 bg-neutral-50 rounded-lg text-xs text-neutral-600">
              <p className="font-medium text-neutral-700 mb-1">Shipping address</p>
              <p>{shippingAddress.name}</p>
              <p>{shippingAddress.line1}{shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}</p>
              <p>{shippingAddress.city}{shippingAddress.county ? `, ${shippingAddress.county}` : ''}</p>
              <p>{shippingAddress.postcode}, {shippingAddress.country}</p>
            </div>
          )}

          {/* Order lines */}
          <table className="w-full mb-4">
            <thead>
              <tr className="text-xs text-neutral-400 uppercase tracking-wide">
                <th className="text-left pb-2 font-medium">Product</th>
                <th className="text-center pb-2 font-medium">Qty</th>
                {!isAthlete && <th className="text-right pb-2 font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4">
                    <p className="text-sm font-medium text-neutral-900">{line.product_name}</p>
                    <p className="text-xs text-neutral-400">{line.size} · {line.sku}</p>
                  </td>
                  <td className="py-2 text-center text-sm text-neutral-700">{line.qty}</td>
                  {!isAthlete && (
                    <td className="py-2 text-right text-sm font-medium text-neutral-900">
                      {symbol}{(line.line_total ?? 0).toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Status update */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Update status:</span>
            <div className="flex gap-1 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={s === currentStatus || saving}
                  onClick={() => updateStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    s === currentStatus
                      ? `${STATUS_STYLES[s]} cursor-default`
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {saving && <span className="text-xs text-neutral-400">Saving...</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminView({
  wholesaleOrders,
  athleteOrders,
}: {
  wholesaleOrders: WholesaleOrder[]
  athleteOrders: AthleteOrder[]
}) {
  const [activeTab, setActiveTab] = useState<'wholesale' | 'athletes'>('wholesale')

  const tabs = [
    { key: 'wholesale', label: 'Wholesale orders', count: wholesaleOrders.length },
    { key: 'athletes', label: 'Athlete requests', count: athleteOrders.length },
  ] as const

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Admin</h1>
        <p className="text-sm text-neutral-500">Order management</p>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-neutral-400">({tab.count})</span>
          </button>
        ))}
      </nav>

      {activeTab === 'wholesale' && (
        <div className="space-y-3">
          {wholesaleOrders.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-12">No wholesale orders yet.</p>
          ) : (
            wholesaleOrders.map((order) => (
              <OrderCard
                key={order.order_id}
                orderId={order.order_id}
                orderDate={order.order_date}
                status={order.status}
                title={order.customerName}
                subtitle={order.customerEmail}
                currency={order.currency}
                total={order.net_total}
                lines={order.order_lines}
                isAthlete={false}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'athletes' && (
        <div className="space-y-3">
          {athleteOrders.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-12">No athlete requests yet.</p>
          ) : (
            athleteOrders.map((order) => (
              <OrderCard
                key={order.order_id}
                orderId={order.order_id}
                orderDate={order.order_date}
                status={order.status}
                title={order.athleteName}
                subtitle={order.athleteEmail}
                lines={order.order_lines}
                shippingAddress={order.shipping_address}
                isAthlete={true}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
