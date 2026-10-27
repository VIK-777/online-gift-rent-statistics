import { AppSettings } from '../types'

export interface TonAccountInfo {
  address: string
  balance: number
  status: string
  name?: string
  data?: string
}

export interface TonEventAction {
  type: string
  TonTransfer?: {
    amount: number
    comment?: string
    recipient: { address: string; name?: string }
    sender: { address: string; name?: string }
  }
  NftItemTransfer?: {
    nft: string
    recipient?: { address: string }
    sender?: { address: string }
    comment?: string
  }
  SmartContractExec?: {
    operation?: string
    executor?: { address: string }
    contract?: { address: string }
  }
}

export interface TonAccountEvent {
  event_id: string
  timestamp: number
  lt: number
  actions: TonEventAction[]
}

export interface TonEventsResponse {
  events: TonAccountEvent[]
  next_from: number
}

export interface TonNftItem {
  address: string
  index: number
  owner?: { address: string; name?: string }
  collection?: { address: string; name?: string }
  metadata?: {
    name?: string
    description?: string
    image?: string
    attributes?: Array<{ trait_type: string; value: string }>
  }
  previews?: Array<{ resolution: string; url: string }>
}

export interface TonGetMethodResult {
  success: boolean
  exit_code: number
  stack?: Array<{ type: string; num?: string; cell?: string }>
}

export class TonApiClient {
  private baseUrl = 'https://tonapi.io/v2'
  private apiKey: string = ''
  private throttleMs: number = 1200 // Default 1.2s safe interval for anonymous tier (<1 RPS)
  private queue: Array<() => Promise<void>> = []
  private isProcessingQueue = false
  private lastRequestEndTime: number = 0

  constructor(settings?: Partial<AppSettings>) {
    if (settings?.customApiKey) {
      this.apiKey = settings.customApiKey.trim()
      this.throttleMs = settings.throttleMs || 750
    } else {
      this.throttleMs = settings?.throttleMs || 1200
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim()
    this.throttleMs = this.apiKey ? 750 : 1200
  }

  setThrottle(ms: number) {
    this.throttleMs = ms
  }

  /**
   * Safe asynchronous task queue that strictly prevents concurrent requests,
   * enforces inter-request delay, and handles 429 retries inline without deadlock.
   */
  private request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      this.queue.push(async () => {
        const result = await this.executeWithRetry<T>(endpoint, options)
        resolve(result)
      })
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessingQueue) return
    this.isProcessingQueue = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        // Enforce safe throttle delay from completion of the previous request
        const now = Date.now()
        const timeSinceLast = now - this.lastRequestEndTime
        if (timeSinceLast < this.throttleMs) {
          const waitTime = this.throttleMs - timeSinceLast
          await new Promise(r => setTimeout(r, waitTime))
        }

        try {
          await task()
        } catch (err) {
          console.error('[TonApiClient] Unhandled task error in queue:', err)
        } finally {
          this.lastRequestEndTime = Date.now()
        }
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Executes fetch with inline retry loop on 429 (exponential backoff, no queue deadlock).
   */
  private async executeWithRetry<T>(endpoint: string, options: RequestInit = {}, maxRetries = 3): Promise<T | null> {
    let attemptsLeft = maxRetries

    while (attemptsLeft >= 0) {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(options.headers as Record<string, string> || {})
      }

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      try {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers
        })

        if (res.status === 429) {
          console.warn(`[TonApiClient] 429 Rate limit on ${endpoint}. Attempts left: ${attemptsLeft}`)
          if (attemptsLeft > 0) {
            attemptsLeft--
            // Pause 2.5 seconds to let the TonAPI token bucket refill
            await new Promise(r => setTimeout(r, 2500))
            continue
          } else {
            console.error(`[TonApiClient] 429 Rate limit exceeded permanently on ${endpoint}`)
            return null
          }
        }

        if (!res.ok) {
          console.warn(`[TonApiClient] HTTP ${res.status} on ${endpoint}: ${res.statusText}`)
          return null
        }

        const data = await res.json()
        return data as T
      } catch (err) {
        console.warn(`[TonApiClient] Network fetch error on ${endpoint}:`, err)
        if (attemptsLeft > 0) {
          attemptsLeft--
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        return null
      }
    }

    return null
  }

  /**
   * Resolves address (raw, user-friendly, or .ton domain) and gets account state.
   */
  async getAccount(address: string): Promise<TonAccountInfo | null> {
    return this.request<TonAccountInfo>(`/accounts/${encodeURIComponent(address)}`)
  }

  /**
   * Fetches account events with pagination.
   */
  async getAccountEvents(
    address: string,
    limit: number = 100,
    beforeLt?: number
  ): Promise<TonEventsResponse | null> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (beforeLt && beforeLt > 0) {
      params.append('before_lt', beforeLt.toString())
    }
    return this.request<TonEventsResponse>(`/accounts/${encodeURIComponent(address)}/events?${params.toString()}`)
  }

  /**
   * Fetches NFT item metadata and owner details.
   */
  async getNft(nftAddress: string): Promise<TonNftItem | null> {
    return this.request<TonNftItem>(`/nfts/${encodeURIComponent(nftAddress)}`)
  }

  /**
   * Fetches multiple NFT items in a single batch request via POST /v2/nfts/_bulk.
   */
  async getNftsBulk(nftAddresses: string[]): Promise<TonNftItem[]> {
    if (nftAddresses.length === 0) return []
    try {
      const res = await this.request<{ nft_items: TonNftItem[] }>('/nfts/_bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_ids: nftAddresses })
      })
      return res?.nft_items || []
    } catch {
      return []
    }
  }

  /**
   * Executes a get-method on an account (e.g. get_params for Tonnel rental contracts).
   */
  async runGetMethod(address: string, method: string): Promise<TonGetMethodResult | null> {
    return this.request<TonGetMethodResult>(`/blockchain/accounts/${encodeURIComponent(address)}/methods/${encodeURIComponent(method)}`)
  }

  /**
   * Fetches latest TON/USD price with simple memory/local caching.
   */
  async getTonPriceUsd(): Promise<number | null> {
    try {
      const cached = localStorage.getItem('ton_cached_price_usd')
      const cachedTime = localStorage.getItem('ton_cached_price_time')
      const now = Date.now()

      // If cached less than 30 minutes ago, return cached price immediately
      if (cached && cachedTime && (now - parseInt(cachedTime, 10) < 30 * 60 * 1000)) {
        return parseFloat(cached)
      }

      const data = await this.request<{ rates: { TON: { prices: { USD: number } } } }>('/rates?tokens=ton&currencies=usd')
      const price = data?.rates?.TON?.prices?.USD
      if (price) {
        localStorage.setItem('ton_cached_price_usd', price.toString())
        localStorage.setItem('ton_cached_price_time', now.toString())
        return price
      }
      return cached ? parseFloat(cached) : null
    } catch {
      return null
    }
  }
}
