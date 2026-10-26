import React from 'react'
import { RefreshCw } from 'lucide-react'
import { ScanProgress } from '../types'

interface ProgressIndicatorProps {
  progress: ScanProgress
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  if (progress.stage === 'idle' || progress.stage === 'done') return null

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-3 animate-fadeIn">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>{progress.message}</span>
          </div>
          <span className="font-mono text-sky-400 font-bold">{progress.percent}%</span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress.percent)}%` }}
          />
        </div>

        <p className="text-[10px] text-slate-500 mt-2 text-center">
          Работает без API ключа через защищенную очередь запросов TonAPI (1 RPS)
        </p>
      </div>
    </div>
  )
}
