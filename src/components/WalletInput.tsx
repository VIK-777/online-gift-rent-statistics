import React, { useState, useEffect } from 'react'
import { Search, Clipboard, History, ArrowRight, X } from 'lucide-react'

interface WalletInputProps {
  onSearch: (wallet: string) => void
  isLoading: boolean
  currentWallet: string
}

const RECENT_WALLETS_KEY = 'ton_gift_recent_wallets'
const DEMO_WALLET = '0:3de8013dcc5fc7f5a662c3dcd2903cd6b82d2a8db74c39d6b6c1062ddab89fe1'

export const WalletInput: React.FC<WalletInputProps> = ({
  onSearch,
  isLoading,
  currentWallet
}) => {
  const [input, setInput] = useState(currentWallet)
  const [recentWallets, setRecentWallets] = useState<string[]>([])
  const [showRecent, setShowRecent] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_WALLETS_KEY)
      if (stored) {
        setRecentWallets(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (currentWallet) {
      setInput(currentWallet)
    }
  }, [currentWallet])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    // Save to recents
    const updated = [trimmed, ...recentWallets.filter(w => w.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5)
    setRecentWallets(updated)
    try {
      localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }

    setShowRecent(false)
    onSearch(trimmed)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setInput(text.trim())
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  }

  const handleSelectRecent = (wallet: string) => {
    setInput(wallet)
    setShowRecent(false)
    onSearch(wallet)
  }

  const handleDemo = () => {
    setInput(DEMO_WALLET)
    setShowRecent(false)
    onSearch(DEMO_WALLET)
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-3 pb-2">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1.5 shadow-xl shadow-black/20 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition">
          <div className="pl-3 pr-2 text-slate-400">
            <Search className="w-5 h-5 text-slate-400" />
          </div>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => recentWallets.length > 0 && setShowRecent(true)}
            placeholder="Адрес TON кошелька (0:..., UQ..., .ton)"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-mono py-1.5"
          />

          <div className="flex items-center gap-1.5 pr-1">
            {input ? (
              <button
                type="button"
                onClick={() => setInput('')}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePaste}
                title="Вставить из буфера"
                className="hidden xs:flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Вставить</span>
              </button>
            )}

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Показать</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdown for recent wallets */}
        {showRecent && recentWallets.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-20">
            <div className="flex items-center justify-between px-3 py-1 text-xs font-medium text-slate-400 border-b border-slate-800/60 mb-1">
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Недавние кошельки
              </span>
              <button
                type="button"
                onClick={() => setShowRecent(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                Закрыть
              </button>
            </div>
            {recentWallets.map((w, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectRecent(w)}
                className="w-full text-left px-3 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl truncate transition flex items-center justify-between"
              >
                <span className="truncate">{w}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Demo helper */}
      {!currentWallet && (
        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Нет под рукой адреса?</span>
          <button
            onClick={handleDemo}
            className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition"
          >
            Загрузить демо-кошелек с арендой
          </button>
        </div>
      )}
    </div>
  )
}
