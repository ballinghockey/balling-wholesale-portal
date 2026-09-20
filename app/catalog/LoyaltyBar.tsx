'use client'

type LoyaltyBarProps = {
  creditBalance: number
  totalSpent: number
  spendThreshold: number
  creditAmount: number
  currency: 'GBP' | 'EUR'
}

export default function LoyaltyBar({
  creditBalance,
  totalSpent,
  spendThreshold,
  creditAmount,
  currency,
}: LoyaltyBarProps) {
  const symbol = currency === 'GBP' ? '£' : '€'

  // How much spent in current cycle (after last reward)
  const cyclesCompleted = Math.floor(totalSpent / spendThreshold)
  const spentInCycle = totalSpent - cyclesCompleted * spendThreshold
  const progressPct = Math.min((spentInCycle / spendThreshold) * 100, 100)
  const remaining = spendThreshold - spentInCycle

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-700">Loyalty rewards</span>
          {creditBalance > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {symbol}{creditBalance.toFixed(0)} available
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-400">
          {remaining > 0
            ? `${symbol}${remaining.toFixed(0)} more to earn ${symbol}${creditAmount.toFixed(0)}`
            : `🎉 ${symbol}${creditAmount.toFixed(0)} earned!`}
        </span>
      </div>
      <div className="w-full bg-neutral-100 rounded-full h-2">
        <div
          className="bg-neutral-900 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-neutral-400">{symbol}{spentInCycle.toFixed(0)}</span>
        <span className="text-xs text-neutral-400">{symbol}{spendThreshold.toFixed(0)}</span>
      </div>
    </div>
  )
}
