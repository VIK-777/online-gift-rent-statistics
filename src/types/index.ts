export interface RentalPayout {
  eventId: string
  timestamp: number
  dateUtc: string
  amountTon: number
  senderAddress: string
  comment: string
  nftAddress?: string
  giftName?: string
  explorerUrl: string
}

export interface GiftRentalDetail {
  name: string
  collectionName: string
  number: number
  imageUrl?: string
  nftAddress: string
  status: 'Rented' | 'Listed for Rent'
  priceTon: number
  durationDays: number
  rentStartedAtUtc?: string
  rentExpiresAtUtc?: string
  rentTimeRemainingSeconds?: number
  timesRented: number
  totalEarnedTon: number
  renterAddress?: string
  history: RentalPayout[]
  url: string
}

export interface RentalSummary {
  totalEarnedTon: number
  totalEarnedUsd?: number
  activeRentedCount: number
  listedCount: number
  totalRentalsCount: number
  nextReturnGiftName?: string
  nextReturnDateUtc?: string
  nextReturnRemainingSeconds?: number
}

export interface RentalDashboardResponse {
  walletAddress: string
  summary: RentalSummary
  gifts: GiftRentalDetail[]
  recentPayouts: RentalPayout[]
  cachedAt?: number
  isFromCache?: boolean
}

export interface ScanProgress {
  stage: 'idle' | 'resolving' | 'scanning_events' | 'inspecting_contracts' | 'fetching_metadata' | 'done' | 'error'
  message: string
  current: number
  total: number
  percent: number
}

export interface AppSettings {
  customApiKey: string
  throttleMs: number
  cacheTtlMinutes: number
}
