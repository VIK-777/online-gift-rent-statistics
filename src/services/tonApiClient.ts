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
  private throttleMs: number = 900 // Default 900ms safe interval for anonymous tier (1 RPS)
  private queue: Promise<unknown> = Promise.resolve()
  private lastRequestTime: number = 0

  constructor(settings?: Partial<AppSettings>) {
    if (settings?.customApiKey) {
      this.apiKey = settings.customApiKey.trim()
      this.throttleMs = settings.throttleMs || 700
    } else {
      this.throttleMs = settings?.throttleMs || 900
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim()
    this.throttleMs = this.apiKey ? 700 : 900
  }

  setThrottle(ms: number) {
    this.throttleMs = ms
  }

  /**
   * Enqueues an HTTP request to TonAPI with rate limiting and retry-on-429 logic.
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, retries = 3): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        const now = Date.now()
        const wait = Math.max(0, this.throttleMs - (now - this.lastRequestTime))
        if (wait > 0) {
          await new Promise(r => setTimeout(r, wait))
        }
        this.lastRequestTime = Date.now()

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
            console.warn(`[TonApiClient] 429 Rate limit reached on ${endpoint}. Retrying... (retries left: ${retries})`)
            if (retries > 0) {
              // Wait 1.5 seconds for leaky bucket to refill, then retry
              await new Promise(r => setTimeout(r, 1500))
              const retryRes = await this.request<T>(endpoint, options, retries - 1)
              resolve(retryRes)
              return
            } else {
              console.error(`[TonApiClient] Rate limit exceeded, no retries left for ${endpoint}`)
              resolve(null)
              return
            }
          }

          if (!res.ok) {
            console.warn(`[TonApiClient] HTTP ${res.status} on ${endpoint}: ${res.statusText}`)
            resolve(null)
            return
          }

          const data = await res.json()
          resolve(data as T)
        } catch (err) {
          console.error(`[TonApiClient] Network error on ${endpoint}:`, err)
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000))
            const retryRes = await this.request<T>(endpoint, options, retries - 1)
            resolve(retryRes)
          } else {
            resolve(null)
          }
        }
      }).catch(reject)
    })
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
   * Executes a get-method on an account (e.g. get_params for Tonnel rental contracts).
   */
  async runGetMethod(address: string, method: string): Promise<TonGetMethodResult | null> {
    return this.request<TonGetMethodResult>(`/blockchain/accounts/${encodeURIComponent(address)}/methods/${encodeURIComponent(method)}`)
  }

  /**
   * Fetches latest TON/USD price.
   */
  async getTonPriceUsd(): Promise<number | null> {
    try {
      const data = await this.request<{ rates: { TON: { prices: { USD: number } } } }>('/rates?tokens=ton&currencies=usd')
      return data?.rates?.TON?.prices?.USD ?? null
    } catch {
      return null
    }
  }
}
