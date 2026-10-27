import { BocParser } from './bocParser'
import { TonApiClient, TonNftItem } from './tonApiClient'
import {
  GiftRentalDetail,
  RentalDashboardResponse,
  RentalPayout,
  RentalSummary,
  ScanProgress
} from '../types'

export interface PersistentWalletState {
  walletAddress: string
  lastScannedLt: number | null
  lastScannedTimestamp: number
  payouts: RentalPayout[]
  cachedGifts: GiftRentalDetail[]
  candidateNfts: string[]
  contractToNftMap: Record<string, string>
  nftAddressToNameMap: Record<string, string>
}

const STORAGE_PREFIX = 'ton_gift_rent_v4_'

export class RentalScanner {
  private client: TonApiClient

  constructor(client: TonApiClient) {
    this.client = client
  }

  /**
   * Resolves raw wallet address and friendly format from user input (raw, friendly, or .ton domain).
   */
  async resolveWallet(input: string): Promise<{ rawAddress: string; friendlyAddress: string }> {
    const clean = input.trim()
    const account = await this.client.getAccount(clean)
    if (!account || !account.address) {
      throw new Error(`Не удалось найти аккаунт для "${clean}". Проверьте адрес кошелька.`)
    }
    return {
      rawAddress: account.address.toLowerCase(),
      friendlyAddress: clean
    }
  }

  /**
   * Loads saved scan state from localStorage if available.
   */
  loadSavedState(walletAddress: string): PersistentWalletState | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${walletAddress.toLowerCase()}`)
      if (!raw) return null
      return JSON.parse(raw) as PersistentWalletState
    } catch {
      return null
    }
  }

  /**
   * Saves updated state to localStorage.
   */
  saveState(state: PersistentWalletState) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${state.walletAddress.toLowerCase()}`, JSON.stringify(state))
    } catch (e) {
      console.warn('[RentalScanner] Failed to save state to localStorage:', e)
    }
  }

  /**
   * Full scan / incremental sync of rental gifts and payouts for the wallet.
   */
  async scanDashboard(
    walletAddress: string,
    onProgress: (progress: ScanProgress) => void,
    forceRefresh = false
  ): Promise<RentalDashboardResponse> {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const targetWallet = walletAddress.toLowerCase()

    onProgress({
      stage: 'resolving',
      message: 'Инициализация и проверка локального кэша...',
      current: 0,
      total: 100,
      percent: 5
    })

    const existingState = this.loadSavedState(targetWallet)
    const hasCachedData = existingState && existingState.cachedGifts && existingState.cachedGifts.length > 0

    // Fast-path: if cached state is fresh (< 2 mins) and not force refresh, recalculate remaining times in memory
    const cacheAgeSeconds = existingState ? (nowSeconds - existingState.lastScannedTimestamp) : 999999
    if (!forceRefresh && hasCachedData && cacheAgeSeconds < 120) {
      onProgress({
        stage: 'done',
        message: 'Загружено из локального кэша',
        current: 100,
        total: 100,
        percent: 100
      })
      return this.buildResponseFromState(existingState, targetWallet, nowSeconds, true)
    }

    const lastScannedLt = (!forceRefresh && existingState) ? existingState.lastScannedLt : null
    const candidateNfts = new Set<string>((!forceRefresh && existingState) ? existingState.candidateNfts : [])
    const contractToNftMap = (!forceRefresh && existingState) ? { ...(existingState.contractToNftMap || {}) } : {}
    const nftAddressToNameMap = (!forceRefresh && existingState) ? { ...(existingState.nftAddressToNameMap || {}) } : {}
    const allPayoutsMap = new Map<string, RentalPayout>()

    if (!forceRefresh && existingState && existingState.payouts) {
      for (const p of existingState.payouts) {
        allPayoutsMap.set(p.eventId, p)
      }
    }

    // --- STEP 1: Scan Events ---
    const newPayouts: RentalPayout[] = []
    const newCandidates = new Set<string>()
    let beforeLt: number | undefined = undefined
    let maxLt: number | null = lastScannedLt
    const maxPages = lastScannedLt ? 3 : 5

    for (let page = 1; page <= maxPages; page++) {
      onProgress({
        stage: 'scanning_events',
        message: `Сканируем историю транзакций (страница ${page} из ${maxPages})...`,
        current: page,
        total: maxPages,
        percent: 5 + page * 5
      })

      const limit = (lastScannedLt && page === 1) ? 25 : 100
      const eventsRes = await this.client.getAccountEvents(targetWallet, limit, beforeLt)
      if (!eventsRes || !eventsRes.events || eventsRes.events.length === 0) break

      let reachedOld = false
      for (const ev of eventsRes.events) {
        const evLt = ev.lt
        if (lastScannedLt && evLt <= lastScannedLt) {
          reachedOld = true
          break
        }

        if (maxLt === null || evLt > maxLt) {
          maxLt = evLt
        }

        // Check actions in event
        if (ev.actions) {
          for (const act of ev.actions) {
            // 1. Detect candidate NFTs transferred out of the wallet (Kotlin parity)
            if (act.type === 'NftItemTransfer' && act.NftItemTransfer) {
              const nftTrans = act.NftItemTransfer
              const nftAddr = nftTrans.nft?.toLowerCase()
              const sender = nftTrans.sender?.address?.toLowerCase()
              const recipient = nftTrans.recipient?.address?.toLowerCase()

              if (nftAddr && sender === targetWallet) {
                newCandidates.add(nftAddr)
                if (recipient) {
                  contractToNftMap[recipient] = nftAddr
                }
              }
            }

            // 2. Detect incoming rental payout (Tonnel or MarketApp)
            if (act.type === 'TonTransfer' && act.TonTransfer) {
              const tt = act.TonTransfer
              const comment = tt.comment || ''
              const recipient = tt.recipient?.address?.toLowerCase()
              const sender = tt.sender?.address?.toLowerCase() || ''

              if (
                recipient === targetWallet &&
                (comment.toLowerCase().includes('rent') || comment.toLowerCase().includes('marketapp.org')) &&
                !comment.toLowerCase().includes('rent settings has been updated')
              ) {
                const amountTon = (tt.amount || 0) / 1_000_000_000
                const dateStr = new Date(ev.timestamp * 1000).toUTCString()

                newPayouts.push({
                  eventId: ev.event_id,
                  timestamp: ev.timestamp,
                  dateUtc: dateStr,
                  amountTon: Math.round(amountTon * 1000) / 1000,
                  senderAddress: sender,
                  comment,
                  explorerUrl: `https://tonviewer.com/transaction/${ev.event_id}`
                })
              }
            }
          }
        }
      }

      if (reachedOld) break
      if (!eventsRes.next_from || eventsRes.next_from === beforeLt) break
      beforeLt = eventsRes.next_from
    }

    // Merge candidates and payouts
    for (const c of newCandidates) {
      candidateNfts.add(c)
    }
    for (const p of newPayouts) {
      allPayoutsMap.set(p.eventId, p)
    }

    // Resolve contract to NFT for all payouts with unknown NFT (deduplicating unique senders)
    const allPayoutsList = Array.from(allPayoutsMap.values())
    const unmappedSenders = Array.from(new Set(
      allPayoutsList
        .filter(p => !p.nftAddress && p.senderAddress && !contractToNftMap[p.senderAddress])
        .map(p => p.senderAddress)
    ))

    if (unmappedSenders.length > 0) {
      let senderIdx = 0
      for (const sender of unmappedSenders) {
        senderIdx++
        onProgress({
          stage: 'scanning_events',
          message: `Распознаем контракты выплат (${senderIdx} из ${unmappedSenders.length})...`,
          current: senderIdx,
          total: unmappedSenders.length,
          percent: 25 + Math.floor((senderIdx / unmappedSenders.length) * 10)
        })

        let resolvedNft: string | null = null

        // 1. Try Tonnel get_params (stack[0] contains the NFT address cell)
        try {
          const getParams = await this.client.runGetMethod(sender, 'get_params')
          if (getParams?.success && getParams.stack && getParams.stack.length >= 1) {
            const cell = getParams.stack[0]?.cell
            if (cell) {
              const parsed = BocParser.parseAddressFromCell(cell)
              if (parsed) {
                resolvedNft = parsed.toLowerCase()
                contractToNftMap[sender] = resolvedNft
                candidateNfts.add(resolvedNft)
              }
            }
          }
        } catch {
          // Ignore
        }

        // 2. Try MarketApp blockchain account data
        if (!resolvedNft) {
          try {
            const acc = await this.client.getBlockchainAccount(sender)
            if (acc?.data) {
              const extracted = BocParser.extractMarketAppNftAddress(acc.data)
              if (extracted) {
                resolvedNft = extracted.toLowerCase()
                contractToNftMap[sender] = resolvedNft
                candidateNfts.add(resolvedNft)
              }
            }
          } catch {
            // Ignore single payout resolve error
          }
        }
      }
    }

    // Now map all payouts to resolved NFT addresses
    for (const payout of allPayoutsList) {
      if (!payout.nftAddress && payout.senderAddress && contractToNftMap[payout.senderAddress]) {
        payout.nftAddress = contractToNftMap[payout.senderAddress]
      }
    }

    // --- STEP 2: Inspect candidate NFTs for active rental ---
    const allCandidatesList = Array.from(candidateNfts)

    onProgress({
      stage: 'inspecting_contracts',
      message: `Запрашиваем статус кандидатов (${allCandidatesList.length} шт.)...`,
      current: 0,
      total: allCandidatesList.length,
      percent: 35
    })

    // Fetch NFT metadata in bulk (1 single request instead of N individual queries!)
    const bulkNfts = await this.client.getNftsBulk(allCandidatesList)
    const nftMap = new Map<string, TonNftItem>()
    for (const item of bulkNfts) {
      if (item.address) {
        const addr = item.address.toLowerCase()
        nftMap.set(addr, item)
        if (item.metadata?.name) {
          const { collectionName, number } = BocParser.parseNameAndNumber(item.metadata.name)
          nftAddressToNameMap[addr] = `${collectionName} #${number}`
        }
      }
    }

    // Filter to NFTs that are currently NOT in the target wallet (i.e. held by rental contracts)
    const activeCandidates = allCandidatesList.filter(nftAddr => {
      const nft = nftMap.get(nftAddr.toLowerCase())
      if (!nft || !nft.owner?.address) return true // Inspect if bulk didn't return owner
      return nft.owner.address.toLowerCase() !== targetWallet
    })

    const totalCandidates = activeCandidates.length
    const activeGifts: GiftRentalDetail[] = []

    let candidateIdx = 0
    for (const nftAddr of activeCandidates) {
      candidateIdx++
      const pct = 40 + Math.floor((candidateIdx / Math.max(1, totalCandidates)) * 50)
      const cachedNft = nftMap.get(nftAddr.toLowerCase())
      const giftLabel = cachedNft?.metadata?.name || `Подарок #${candidateIdx}`

      onProgress({
        stage: 'inspecting_contracts',
        message: `Проверяем аренду: ${giftLabel} (${candidateIdx}/${totalCandidates})...`,
        current: candidateIdx,
        total: totalCandidates,
        percent: pct
      })

      try {
        const giftDetail = await this.inspectNftRental(
          nftAddr,
          targetWallet,
          nowSeconds,
          contractToNftMap,
          cachedNft
        )
        if (giftDetail) {
          activeGifts.push(giftDetail)
          nftAddressToNameMap[nftAddr.toLowerCase()] = giftDetail.name
        }
      } catch (err) {
        console.warn(`[RentalScanner] Error inspecting NFT ${nftAddr}:`, err)
      }
    }

    // --- STEP 3: Assign payouts and calculate total earned per gift ---
    const allPayouts = Array.from(allPayoutsMap.values()).sort((a, b) => b.timestamp - a.timestamp)
    for (const p of allPayouts) {
      if (!p.nftAddress && p.senderAddress && contractToNftMap[p.senderAddress.toLowerCase()]) {
        p.nftAddress = contractToNftMap[p.senderAddress.toLowerCase()]
      }
      if (p.nftAddress && nftAddressToNameMap[p.nftAddress.toLowerCase()]) {
        p.giftName = nftAddressToNameMap[p.nftAddress.toLowerCase()]
      }
    }

    // Group payouts by NFT
    const payoutsByNft: Record<string, RentalPayout[]> = {}
    for (const p of allPayouts) {
      if (p.nftAddress) {
        const key = p.nftAddress.toLowerCase()
        if (!payoutsByNft[key]) {
          payoutsByNft[key] = []
        }
        payoutsByNft[key].push(p)
      }
    }

    // Attach history and earnings to active gifts
    for (const gift of activeGifts) {
      const history = payoutsByNft[gift.nftAddress.toLowerCase()] || []
      gift.history = history
      gift.totalEarnedTon = Math.round(history.reduce((sum, h) => sum + h.amountTon, 0) * 1000) / 1000
      gift.timesRented = Math.max(gift.status === 'Rented' ? 1 : 0, history.length)
    }

    // Sort active gifts: first rented (closest to expiry), then listed
    activeGifts.sort((a, b) => {
      if (a.status === 'Rented' && b.status !== 'Rented') return -1
      if (a.status !== 'Rented' && b.status === 'Rented') return 1
      const remA = a.rentTimeRemainingSeconds ?? Number.MAX_SAFE_INTEGER
      const remB = b.rentTimeRemainingSeconds ?? Number.MAX_SAFE_INTEGER
      return remA - remB
    })

    // Save updated state to localStorage
    const updatedState: PersistentWalletState = {
      walletAddress: targetWallet,
      lastScannedLt: maxLt || existingState?.lastScannedLt || null,
      lastScannedTimestamp: nowSeconds,
      payouts: allPayouts,
      cachedGifts: activeGifts,
      candidateNfts: Array.from(candidateNfts),
      contractToNftMap,
      nftAddressToNameMap
    }
    this.saveState(updatedState)

    onProgress({
      stage: 'done',
      message: 'Синхронизация завершена успешно!',
      current: totalCandidates,
      total: totalCandidates,
      percent: 100
    })

    return this.buildResponseFromState(updatedState, targetWallet, nowSeconds, false)
  }

  /**
   * Checks whether a specific NFT is currently held by a rental smart contract owned by targetWallet.
   */
  private async inspectNftRental(
    nftAddress: string,
    targetWallet: string,
    nowSeconds: number,
    contractToNftMap: Record<string, string>,
    prefetchedNft?: TonNftItem
  ): Promise<GiftRentalDetail | null> {
    const nft = prefetchedNft || await this.client.getNft(nftAddress)
    if (!nft || !nft.owner || !nft.owner.address) return null

    const currentOwner = nft.owner.address.toLowerCase()

    // If held directly in wallet, it's NOT in rent
    if (currentOwner === targetWallet) {
      return null
    }

    contractToNftMap[currentOwner] = nftAddress.toLowerCase()

    const rawName = nft.metadata?.name || `Gift #${nft.index}`
    const { collectionName, number } = BocParser.parseNameAndNumber(rawName)
    const displayName = `${collectionName} #${number}`
    const imageUrl = nft.metadata?.image || nft.previews?.[1]?.url || nft.previews?.[0]?.url

    // 1. Check Tonnel rental get_params
    try {
      const getParams = await this.client.runGetMethod(currentOwner, 'get_params')
      if (getParams?.success && getParams.stack && getParams.stack.length >= 6) {
        const ownerCell = getParams.stack[1]?.cell || ''
        const contractOwner = BocParser.parseAddressFromCell(ownerCell)
        if (contractOwner && contractOwner.toLowerCase() === targetWallet) {
          const startTime = BocParser.parseHexNumber(getParams.stack[2]?.num || '0')
          const durationSeconds = BocParser.parseHexNumber(getParams.stack[3]?.num || '0')
          const priceNano = BocParser.parseHexNumber(getParams.stack[4]?.num || '0')
          const priceTon = Math.round((priceNano / 1_000_000_000) * 1000) / 1000

          const isRented = startTime > 0
          const status: 'Rented' | 'Listed for Rent' = isRented ? 'Rented' : 'Listed for Rent'
          const expireTimestamp = isRented ? startTime + durationSeconds : 0
          const remainingSeconds = isRented && expireTimestamp > 0 ? Math.max(0, expireTimestamp - nowSeconds) : undefined

          return {
            name: displayName,
            collectionName,
            number,
            imageUrl,
            nftAddress,
            status,
            priceTon,
            durationDays: Math.max(1, Math.floor(durationSeconds / 86400)),
            rentStartedAtUtc: isRented ? new Date(startTime * 1000).toUTCString() : undefined,
            rentExpiresAtUtc: isRented && expireTimestamp > 0 ? new Date(expireTimestamp * 1000).toUTCString() : undefined,
            rentTimeRemainingSeconds: remainingSeconds,
            timesRented: isRented ? 1 : 0,
            totalEarnedTon: 0,
            history: [],
            url: `https://tonviewer.com/${nftAddress}`
          }
        }
      }
    } catch {
      // Continue to MarketApp check
    }

    // 2. Check MarketApp rental contract BoC
    try {
      const account = await this.client.getBlockchainAccount(currentOwner)
      if (account?.data) {
        const parsed = BocParser.parseMarketAppRental(account.data, targetWallet, nowSeconds)
        if (parsed) {
          if (parsed.linkedContractAddress) {
            contractToNftMap[parsed.linkedContractAddress.toLowerCase()] = nftAddress.toLowerCase()
          }

          const rentStartedAtUtc = parsed.startTime ? new Date(parsed.startTime * 1000).toUTCString() : undefined
          const rentExpiresAtUtc = parsed.expireTime ? new Date(parsed.expireTime * 1000).toUTCString() : undefined

          return {
            name: displayName,
            collectionName,
            number,
            imageUrl,
            nftAddress,
            status: parsed.status,
            priceTon: parsed.priceTon,
            durationDays: parsed.durationDays,
            rentStartedAtUtc,
            rentExpiresAtUtc,
            rentTimeRemainingSeconds: parsed.remainingSeconds ?? undefined,
            timesRented: parsed.status === 'Rented' ? 1 : 0,
            totalEarnedTon: 0,
            renterAddress: parsed.renterAddress ?? undefined,
            history: [],
            url: `https://tonviewer.com/${nftAddress}`
          }
        }
      }
    } catch {
      // Ignore
    }

    return null
  }

  private buildResponseFromState(
    state: PersistentWalletState,
    walletAddress: string,
    nowSeconds: number,
    isFromCache: boolean
  ): RentalDashboardResponse {
    const updatedGifts = state.cachedGifts.map(gift => {
      // Guard: if a gift has status 'Rented' but no expiration or zero/epoch-1970 expiration, it is Listed for Rent
      if (gift.status === 'Rented' && (!gift.rentExpiresAtUtc || gift.rentExpiresAtUtc.includes('1970'))) {
        return {
          ...gift,
          status: 'Listed for Rent' as const,
          rentStartedAtUtc: undefined,
          rentExpiresAtUtc: undefined,
          rentTimeRemainingSeconds: undefined,
          renterAddress: undefined
        }
      }
      if (gift.status === 'Rented' && gift.rentExpiresAtUtc) {
        const expTime = Math.floor(new Date(gift.rentExpiresAtUtc).getTime() / 1000)
        const remaining = Math.max(0, expTime - nowSeconds)
        return { ...gift, rentTimeRemainingSeconds: remaining }
      }
      return gift
    })

    const totalEarnedTon = Math.round(state.payouts.reduce((sum, p) => sum + p.amountTon, 0) * 1000) / 1000
    const activeRentedCount = updatedGifts.filter(g => g.status === 'Rented').length
    const listedCount = updatedGifts.filter(g => g.status === 'Listed for Rent').length

    const nextReturn = updatedGifts
      .filter(g => g.status === 'Rented' && (g.rentTimeRemainingSeconds ?? -1) > 0)
      .sort((a, b) => (a.rentTimeRemainingSeconds || 0) - (b.rentTimeRemainingSeconds || 0))[0]

    const summary: RentalSummary = {
      totalEarnedTon,
      activeRentedCount,
      listedCount,
      totalRentalsCount: state.payouts.length,
      nextReturnGiftName: nextReturn?.name,
      nextReturnDateUtc: nextReturn?.rentExpiresAtUtc,
      nextReturnRemainingSeconds: nextReturn?.rentTimeRemainingSeconds
    }

    return {
      walletAddress,
      summary,
      gifts: updatedGifts,
      recentPayouts: state.payouts,
      cachedAt: state.lastScannedTimestamp,
      isFromCache
    }
  }
}
