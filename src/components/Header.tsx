import React from 'react'
import { Gift, RefreshCw, Settings, Sparkles } from 'lucide-react'

interface HeaderProps {
  tonPriceUsd: number | null
  isLoading: boolean
  onRefresh: () => void
  onOpenSettings: () => void
  hasData: boolean
}

export const Header: React.FC<HeaderProps> = ({
  tonPriceUsd,
  isLoading,
  onRefresh,
  onOpenSettings,
  hasData
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0B111A]/85 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white flex-shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1">
                Gifts Rental
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                TON
              </span>
            </div>
            <p className="text-xs text-slate-400">Статистика подарков в аренде</p>
          </div>
        </div>

        {/* Actions & Price */}
        <div className="flex items-center gap-2">
          {tonPriceUsd !== null && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
              <span className="text-sky-400 font-semibold">TON</span>
              <span>${tonPriceUsd.toFixed(2)}</span>
            </div>
          )}

          {hasData && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Обновить данные"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-200 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            title="Настройки"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-200 transition active:scale-95"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
