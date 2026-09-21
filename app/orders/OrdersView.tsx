'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OrderLine = {
  id: string
  sku: string
  product_name: string
  size: string
  qty: number
  list_price: number
  customer_discount_pct: number
  promo_discount_pct: number
  final_unit_price: number
  line_total: number
}

type Order = {
  order_id: string
  order_date: string
  currency: string
  net_total: number
  grand_total: number
  vat_total: number
  status: string
  order_lines: OrderLine[]
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  shipped: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-neutral-100 text-neutral-500',
}

export default function OrdersView({
  orders,
  currency,
  customerName,
  isAthlete = false,
}: {
  orders: Order[]
  currency: 'GBP' | 'EUR'
  customerName: string
  isAthlete?: boolean
}) {
  const router = useRouter()
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const symbol = currency === 'GBP' ? '£' : '€'

  function toggleOrder(orderId: string) {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Order history</h1>
          <p className="text-sm text-neutral-500">{customerName}</p>
        </div>
        <button
          onClick={() => router.push('/catalog')}
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Back to catalog
        </button>
      </header>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-400 text-sm mb-4">No orders yet.</p>
          <button
            onClick={() => router.push('/catalog')}
            className="rounded-lg bg-neutral-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Go to catalog
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrders.has(order.order_id)
            const ref = order.order_id.slice(0, 8).toUpperCase()
            const totalUnits = order.order_lines.reduce((sum, l) => sum + l.qty, 0)

            return (
              <div
                key={order.order_id}
                className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleOrder(order.order_id)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900 text-sm">Ref {ref}</span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_STYLES[order.status] ?? STATUS_STYLES.submitted}`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {formatDate(order.order_date)} · {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-900">
                      {symbol}{order.net_total.toFixed(2)}
                    </span>
                    <span className="text-neutral-400 text-sm">{isExpanded ? '−' : '+'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-100 px-4 pb-4">
                    <table className="w-full mt-3">
                      <thead>
                        <tr className="text-xs text-neutral-400 uppercase tracking-wide">
                          <th className="text-left pb-2 font-medium">Product</th>
                          <th className="text-center pb-2 font-medium">Qty</th>
                          <th className="text-right pb-2 font-medium">Unit</th>
                          <th className="text-right pb-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {order.order_lines.map((line) => (
                          <tr key={line.id}>
                            <td className="py-2.5 pr-4">
                              <p className="text-sm font-medium text-neutral-900">{line.product_name}</p>
                              <p className="text-xs text-neutral-400">{line.size} · SKU: {line.sku}</p>
                              {!isAthlete && line.customer_discount_pct > 0 && (
                                <p className="text-xs text-emerald-600">
                                  -{line.customer_discount_pct}% applied
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 text-center text-sm text-neutral-700">{line.qty}</td>
                            {!isAthlete && (
                              <td className="py-2.5 text-right text-sm text-neutral-700">
                                {symbol}{line.final_unit_price.toFixed(2)}
                              </td>
                            )}
                            {!isAthlete && (
                              <td className="py-2.5 text-right text-sm font-medium text-neutral-900">
                                {symbol}{line.line_total.toFixed(2)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {!isAthlete && (
                        <tr>
                          <td colSpan={3} className="pt-3 text-right text-sm font-semibold text-neutral-900">
                            Subtotal
                          </td>
                          <td className="pt-3 text-right text-sm font-bold text-neutral-900">
                            {symbol}{order.net_total.toFixed(2)}
                          </td>
                        </tr>
                      )}
                        {order.vat_total > 0 && (
                          <tr>
                            <td colSpan={3} className="pt-1 text-right text-xs text-neutral-400">
                              VAT
                            </td>
                            <td className="pt-1 text-right text-xs text-neutral-400">
                              {symbol}{order.vat_total.toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
