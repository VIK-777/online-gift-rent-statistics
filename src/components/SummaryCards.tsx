import React from 'react'
import { Coins, Timer, Sparkles, Tag, Clock } from 'lucide-react'
import { RentalSummary } from '../types'

interface SummaryCardsProps {
  summary: RentalSummary
  tonPriceUsd: number | null
  onOpenPayouts: () => void
}

function formatCountdown(remainingSeconds?: number): string {
  if (remainingSeconds === undefined || remainingSeconds === null || remainingSeconds <= 0) {
    return 'Скоро'
  }
  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60

  if (days > 0) {
    return `${days}д ${hours.toString().padStart(2, '0')}ч ${minutes.toString().padStart(2, '0')}м`
  }
  return `${hours.toString().padStart(2, '0')}ч ${minutes.toString().padStart(2, '0')}м ${seconds.toString().padStart(2, '0')}с`
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  tonPriceUsd,
  onOpenPayouts
}) => {
  const earnedUsd = tonPriceUsd ? summary.totalEarnedTon * tonPriceUsd : null

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Card 1: Total Earned */}
        <button
          onClick={onOpenPayouts}
          className="text-left bg-gradient-to-br from-slate-900/90 to-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 shadow-lg relative overflow-hidden transition active:scale-[0.98] group"
        >
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-sky-500/10 rounded-full blur-xl group-hover:bg-sky-500/20 transition" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400">Всего заработано</span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              +{summary.totalEarnedTon.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-sky-400">TON</span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span>{earnedUsd ? `≈ $${earnedUsd.toFixed(2)}` : `${summary.totalRentalsCount} выплат`}</span>
            <span className="text-[10px] text-sky-400 group-hover:underline">История &rarr;</span>
          </div>
        </button>

        {/* Card 2: Active Rented Count */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-900/60 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400">В аренде сейчас</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {summary.activeRentedCount}
            </span>
            <span className="text-xs font-medium text-slate-400">подарков</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Tag className="w-3 h-3 text-amber-400" />
            <span>Выставлено: {summary.listedCount} шт</span>
          </div>
        </div>

        {/* Card 3: Next Return Timer (Spans 2 columns on mobile for prominence) */}
        <div className="col-span-2 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-500/20 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Timer className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                Ближайший возврат
              </span>
            </div>

            {summary.nextReturnDateUtc && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(summary.nextReturnDateUtc).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>

          {summary.nextReturnGiftName ? (
            <div className="flex items-center justify-between gap-2 mt-1">
              <div>
                <p className="text-xs text-slate-400">Подарок:</p>
                <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                  {summary.nextReturnGiftName}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400">Осталось:</p>
                <span className="inline-block px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-sm sm:text-base">
                  {formatCountdown(summary.nextReturnRemainingSeconds)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-slate-500">
              {summary.listedCount > 0
                ? 'Подарки выставлены в аренду, но арендаторов пока нет'
                : 'Нет активных аренд в данный момент'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
