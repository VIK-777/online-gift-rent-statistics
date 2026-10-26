import React, { useState } from 'react'
import {
  ExternalLink,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react'
import { GiftRentalDetail } from '../types'

interface GiftCardProps {
  gift: GiftRentalDetail
  tonPriceUsd: number | null
}

function formatCountdown(remainingSeconds?: number): string {
  if (remainingSeconds === undefined || remainingSeconds === null || remainingSeconds <= 0) {
    return 'Возвращается...'
  }
  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60

  if (days > 0) {
    return `${days}д ${hours}ч ${minutes}м`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const GiftCard: React.FC<GiftCardProps> = ({
  gift,
  tonPriceUsd
}) => {
  const [showHistory, setShowHistory] = useState(false)
  const isRented = gift.status === 'Rented'
  const earnedUsd = tonPriceUsd ? gift.totalEarnedTon * tonPriceUsd : null

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-3.5 shadow-md transition overflow-hidden">
      {/* Top row: Preview + Name & Status */}
      <div className="flex items-start gap-3">
        {/* Gift Image / Avatar */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {gift.imageUrl ? (
            <img
              src={gift.imageUrl}
              alt={gift.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback if image fails to load
                ;(e.target as HTMLElement).style.display = 'none'
              }}
            />
          ) : (
            <Tag className="w-6 h-6 text-slate-500" />
          )}

          {/* Mini status dot overlay */}
          <span
            className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
              isRented ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">
              {gift.name}
            </h3>
            <a
              href={gift.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть в Tonviewer"
              className="text-slate-400 hover:text-sky-400 p-1 -mr-1 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                isRented
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRented ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isRented ? 'В аренде' : 'Выставлен'}
            </span>

            {/* Price badge */}
            <span className="text-[11px] text-slate-400">
              {gift.priceTon} TON / {gift.durationDays}д
            </span>
          </div>

          {/* Return countdown / expiry (if rented) */}
          {isRented && (
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                Возврат:
              </span>
              <span className="font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px]">
                {formatCountdown(gift.rentTimeRemainingSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Middle row: Earnings & History toggle */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
        {/* Total earned from this gift */}
        <div>
          <span className="text-[11px] text-slate-400 block">Заработано с подарка</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-bold text-white tracking-tight">
              +{gift.totalEarnedTon.toFixed(2)} TON
            </span>
            {earnedUsd && (
              <span className="text-[10px] text-slate-500">
                (≈${earnedUsd.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Payouts count & button */}
        {gift.history.length > 0 ? (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition active:scale-95"
          >
            <History className="w-3 h-3 text-sky-400" />
            <span>{gift.history.length} выплат</span>
            {showHistory ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 italic">
            {isRented ? 'Первая аренда' : 'Пока без выплат'}
          </span>
        )}
      </div>

      {/* Collapsible history list */}
      {showHistory && gift.history.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 space-y-1.5 animate-fadeIn">
          {gift.history.map((payout, idx) => (
            <div
              key={payout.eventId || idx}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 text-[11px] border border-slate-800/50"
            >
              <div className="min-w-0 pr-2">
                <span className="font-semibold text-emerald-400 block">
                  +{payout.amountTon} TON
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  {new Date(payout.timestamp * 1000).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <a
                href={payout.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-sky-400 p-1 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 text-[10px]"
              >
                <span>Транзакция</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
