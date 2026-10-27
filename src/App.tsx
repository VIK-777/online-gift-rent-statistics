import { useEffect, useState, useMemo } from 'react'
import { Header } from './components/Header'
import { WalletInput } from './components/WalletInput'
import { SummaryCards } from './components/SummaryCards'
import { GiftCard } from './components/GiftCard'
import { FilterSortBar, FilterStatus, SortField } from './components/FilterSortBar'
import { ProgressIndicator } from './components/ProgressIndicator'
import { RentalHistoryModal } from './components/RentalHistoryModal'
import { SettingsModal } from './components/SettingsModal'
import { TonApiClient } from './services/tonApiClient'
import { RentalScanner } from './services/rentalScanner'
import {
  RentalDashboardResponse,
  ScanProgress,
  AppSettings
} from './types'
import { Gift, ShieldCheck, Zap, AlertCircle } from 'lucide-react'

const SETTINGS_KEY = 'ton_gift_app_settings'
const LAST_WALLET_KEY = 'ton_gift_last_wallet'

const defaultSettings: AppSettings = {
  customApiKey: '',
  throttleMs: 900,
  cacheTtlMinutes: 10
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })

  const [currentWallet, setCurrentWallet] = useState<string>(() => {
    // Check URL query param or hash first (e.g. ?wallet=...)
    const params = new URLSearchParams(window.location.search)
    const urlWallet = params.get('wallet') || window.location.hash.replace('#', '')
    if (urlWallet) return urlWallet
    return localStorage.getItem(LAST_WALLET_KEY) || ''
  })

  const [data, setData] = useState<RentalDashboardResponse | null>(null)
  const [tonPriceUsd, setTonPriceUsd] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [progress, setProgress] = useState<ScanProgress>({
    stage: 'idle',
    message: '',
    current: 0,
    total: 0,
    percent: 0
  })

  // Filter & Sort
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sortField, setSortField] = useState<SortField>('expiry')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isPayoutsModalOpen, setIsPayoutsModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  // Initialize clients
  const apiClient = useMemo(() => new TonApiClient(settings), [settings])
  const scanner = useMemo(() => new RentalScanner(apiClient), [apiClient])

  // 1. Fetch TON price (load cached immediately, update in background after 3s)
  useEffect(() => {
    const cached = localStorage.getItem('ton_cached_price_usd')
    if (cached) {
      setTonPriceUsd(parseFloat(cached))
    }
    const timer = setTimeout(() => {
      apiClient.getTonPriceUsd().then(price => {
        if (price) setTonPriceUsd(price)
      }).catch(() => {})
    }, 3000)
    return () => clearTimeout(timer)
  }, [apiClient])

  // 2. Auto-load wallet if present on start
  useEffect(() => {
    if (currentWallet) {
      handleSearch(currentWallet, false)
    }
  }, [])

  // 3. Live 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setData(prev => {
        if (!prev) return null
        const nowSec = Math.floor(Date.now() / 1000)

        const updatedGifts = prev.gifts.map(gift => {
          if (gift.status === 'Rented' && gift.rentExpiresAtUtc) {
            const expTime = Math.floor(new Date(gift.rentExpiresAtUtc).getTime() / 1000)
            const remaining = Math.max(0, expTime - nowSec)
            return { ...gift, rentTimeRemainingSeconds: remaining }
          }
          return gift
        })

        const nextReturn = updatedGifts
          .filter(g => g.status === 'Rented' && (g.rentTimeRemainingSeconds ?? -1) > 0)
          .sort((a, b) => (a.rentTimeRemainingSeconds || 0) - (b.rentTimeRemainingSeconds || 0))[0]

        return {
          ...prev,
          summary: {
            ...prev.summary,
            nextReturnGiftName: nextReturn?.name,
            nextReturnDateUtc: nextReturn?.rentExpiresAtUtc,
            nextReturnRemainingSeconds: nextReturn?.rentTimeRemainingSeconds
          },
          gifts: updatedGifts
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleSearch = async (inputWallet: string, forceRefresh = false) => {
    if (!inputWallet.trim()) return
    setIsLoading(true)
    setError(null)

    try {
      // Step A: resolve target wallet
      setProgress({
        stage: 'resolving',
        message: `Поиск кошелька "${inputWallet.trim()}"...`,
        current: 0,
        total: 100,
        percent: 10
      })

      const resolved = await scanner.resolveWallet(inputWallet)
      setCurrentWallet(resolved.rawAddress)
      localStorage.setItem(LAST_WALLET_KEY, resolved.rawAddress)

      // Update URL hash without full reload
      try {
        window.history.replaceState(null, '', `?wallet=${encodeURIComponent(inputWallet.trim())}`)
      } catch {}

      // Step B: Scan dashboard
      const result = await scanner.scanDashboard(
        resolved.rawAddress,
        (p) => setProgress(p),
        forceRefresh
      )

      setData(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      console.error(err)
    } finally {
      setIsLoading(false)
      setProgress(prev => ({ ...prev, stage: 'done', percent: 100 }))
    }
  }

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
    } catch {}
  }

  const handleClearCache = () => {
    if (currentWallet) {
      localStorage.removeItem(`ton_gift_rent_${currentWallet.toLowerCase()}`)
    }
    setData(null)
    setError(null)
  }

  // Filtered and sorted gifts
  const filteredGifts = useMemo(() => {
    if (!data) return []

    return data.gifts
      .filter(g => {
        // Status filter
        if (statusFilter === 'rented' && g.status !== 'Rented') return false
        if (statusFilter === 'listed' && g.status !== 'Listed for Rent') return false

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchName = g.name.toLowerCase().includes(q)
          const matchNumber = g.number.toString().includes(q)
          return matchName || matchNumber
        }
        return true
      })
      .sort((a, b) => {
        if (sortField === 'expiry') {
          // Rented first with closest return, then listed
          if (a.status === 'Rented' && b.status !== 'Rented') return -1
          if (a.status !== 'Rented' && b.status === 'Rented') return 1
          const remA = a.rentTimeRemainingSeconds ?? Number.MAX_SAFE_INTEGER
          const remB = b.rentTimeRemainingSeconds ?? Number.MAX_SAFE_INTEGER
          return remA - remB
        }
        if (sortField === 'earned') {
          return b.totalEarnedTon - a.totalEarnedTon
        }
        if (sortField === 'price') {
          return b.priceTon - a.priceTon
        }
        if (sortField === 'name') {
          return a.name.localeCompare(b.name)
        }
        return 0
      })
  }, [data, statusFilter, sortField, searchQuery])

  return (
    <div className="min-h-screen flex flex-col bg-[#0B111A]">
      <Header
        tonPriceUsd={tonPriceUsd}
        isLoading={isLoading}
        onRefresh={() => handleSearch(currentWallet, true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        hasData={data !== null}
      />

      <main className="flex-1 pb-16">
        <WalletInput
          onSearch={(w) => handleSearch(w, false)}
          isLoading={isLoading}
          currentWallet={currentWallet}
        />

        {/* Progress indicator during scanning */}
        {isLoading && <ProgressIndicator progress={progress} />}

        {/* Error message */}
        {error && (
          <div className="w-full max-w-2xl mx-auto px-4 py-3">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {data && (
          <>
            <SummaryCards
              summary={data.summary}
              tonPriceUsd={tonPriceUsd}
              onOpenPayouts={() => setIsPayoutsModalOpen(true)}
            />

            <FilterSortBar
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              sortField={sortField}
              onSortChange={setSortField}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalCount={data.gifts.length}
              rentedCount={data.summary.activeRentedCount}
              listedCount={data.summary.listedCount}
            />

            {/* Gifts list */}
            <div className="w-full max-w-2xl mx-auto px-4 py-2">
              {filteredGifts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {searchQuery ? 'Подарков по вашему запросу не найдено' : 'Нет подарков в этой категории'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {filteredGifts.map((gift) => (
                    <GiftCard
                      key={gift.nftAddress}
                      gift={gift}
                      tonPriceUsd={tonPriceUsd}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state when no wallet is selected yet */}
        {!data && !isLoading && !error && (
          <div className="w-full max-w-md mx-auto px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-sky-400 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Gift className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-white mb-1">
              Отслеживайте аренду подарков
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto mb-6">
              Введите адрес вашего TON кошелька выше. Приложение покажет список всех подарков в аренде, таймеры возврата и точную сумму заработка с каждого.
            </p>

            <div className="grid grid-cols-2 gap-2.5 text-left max-w-xs mx-auto">
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <p className="text-xs font-semibold text-white">Без бэкенда</p>
                <p className="text-[10px] text-slate-500">Прямое подключение к TON прямо из браузера</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <Zap className="w-4 h-4 text-sky-400 mb-1" />
                <p className="text-xs font-semibold text-white">Без API ключа</p>
                <p className="text-[10px] text-slate-500">Работает бесплатно и сразу на любом телефоне</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <RentalHistoryModal
        isOpen={isPayoutsModalOpen}
        onClose={() => setIsPayoutsModalOpen(false)}
        payouts={data?.recentPayouts || []}
        walletAddress={currentWallet}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onClearCache={handleClearCache}
      />
    </div>
  )
}
export default App
