import React from 'react'
import { X, ExternalLink, Coins, Calendar, ArrowDownLeft } from 'lucide-react'
import { RentalPayout } from '../types'

interface RentalHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  payouts: RentalPayout[]
  walletAddress: string
}

export const RentalHistoryModal: React.FC<RentalHistoryModalProps> = ({
  isOpen,
  onClose,
  payouts,
  walletAddress
}) => {
  if (!isOpen) return null

  const totalEarned = payouts.reduce((sum, p) => sum + p.amountTon, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">История выплат аренды</h3>
              <p className="text-[11px] text-slate-400">
                Всего выплат: {payouts.length} (+{totalEarned.toFixed(2)} TON)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {payouts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Выплат аренды на этом кошельке не найдено
            </div>
          ) : (
            payouts.map((p, idx) => (
              <div
                key={p.eventId || idx}
                className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/70 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-emerald-400">
                        +{p.amountTon} TON
                      </span>
                      {p.giftName && (
                        <span className="text-[11px] font-medium text-slate-300 truncate">
                          &bull; {p.giftName}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(p.timestamp * 1000).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {p.comment && (
                      <p className="text-[10px] text-slate-400 font-mono mt-1 truncate max-w-[240px] sm:max-w-xs">
                        {p.comment}
                      </p>
                    )}
                  </div>
                </div>

                <a
                  href={p.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Посмотреть в блокчейне"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-center">
          <a
            href={`https://tonviewer.com/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
          >
            <span>Открыть кошелек в Tonviewer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
