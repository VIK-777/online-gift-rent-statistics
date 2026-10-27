/**
 * Pure TypeScript parser for MarketApp & Tonnel rental smart contracts
 * Operates without external heavy dependencies directly on BoC cells and TL-B bitstreams.
 */

export interface MarketAppRentalInfo {
  nftAddress: string
  status: 'Rented' | 'Listed for Rent'
  priceTon: number
  durationDays: number
  startTime: number | null
  expireTime: number | null
  remainingSeconds: number | null
  renterAddress: string | null
  linkedContractAddress: string | null
}

interface RawCell {
  idx: number
  refs: number[]
  data: Uint8Array
}

export class BocParser {
  /**
   * Parses MarketApp rental contract data BoC hex.
   * Returns parsed rental detail if contract is valid and owned by expectedOwner.
   */
  static parseMarketAppRental(
    bocHex: string,
    expectedOwner: string,
    nowSeconds: number = Math.floor(Date.now() / 1000)
  ): MarketAppRentalInfo | null {
    try {
      const cells = this.parseBocCells(bocHex)
      if (cells.length < 4) return null

      // Cell 1: owner (bit 0..267), nftAddress (bit 267..534), startTime (bit 833..865)
      const c1Bits = this.toBits(cells[1].data)
      if (c1Bits.length < 865) return null

      const ownerRes = this.readAddress(c1Bits, 0)
      if (!ownerRes) return null
      const ownerAddr = ownerRes.address
      if (ownerAddr.toLowerCase() !== expectedOwner.toLowerCase()) {
        return null
      }

      const nftRes = this.readAddress(c1Bits, 267)
      if (!nftRes) return null
      const nftAddr = nftRes.address

      const startTime = this.readUint32(c1Bits, 833)

      // Cell 2: isListed flag (bit 0), expireTime (bit 67..99), renter (bit 135..402), linkedContract (bit 402..669)
      const c2Bits = this.toBits(cells[2].data)
      const isListedBit = c2Bits.length > 0 && c2Bits[0] === '1'
      const expireTime = c2Bits.length >= 99 ? this.readUint32(c2Bits, 67) : 0

      let renterAddr: string | null = null
      if (c2Bits.length >= 135 + 267) {
        const renterRes = this.readAddress(c2Bits, 135)
        renterAddr = renterRes ? renterRes.address : null
      }

      // A gift is actively rented ONLY if it is not relisted, has a non-zero expireTime, and has an assigned renter
      const isRented = !isListedBit && expireTime > 0 && renterAddr !== null
      const status: 'Rented' | 'Listed for Rent' = isRented ? 'Rented' : 'Listed for Rent'

      let linkedContract: string | null = null
      if (c2Bits.length >= 402 + 267) {
        const linkedRes = this.readAddress(c2Bits, 402)
        linkedContract = linkedRes ? linkedRes.address : null
      }

      // Cell 3: minDuration (bit 1..33), maxDuration (bit 33..65), priceNano (bit 65..)
      const c3Bits = this.toBits(cells[3].data)
      if (c3Bits.length < 69) return null

      const minDuration = this.readUint32(c3Bits, 1)
      const coinsLen = parseInt(c3Bits.substring(65, 69), 2)
      const coinsEnd = 69 + coinsLen * 8
      if (c3Bits.length < coinsEnd) return null

      let priceNano = 0n
      if (coinsLen > 0) {
        priceNano = BigInt('0b' + c3Bits.substring(69, coinsEnd))
      }
      const rawPrice = Number(priceNano) / 1_000_000_000
      const priceTon = Math.round(rawPrice * 1000) / 1000

      if (!isRented) {
        const durationDays = Math.max(1, Math.floor(minDuration / 86400))
        return {
          nftAddress: nftAddr,
          status,
          priceTon,
          durationDays,
          startTime: null,
          expireTime: null,
          remainingSeconds: null,
          renterAddress: null,
          linkedContractAddress: linkedContract
        }
      } else {
        const durationSeconds = Math.max(minDuration, expireTime - startTime)
        const durationDays = Math.max(1, Math.floor(durationSeconds / 86400))
        const remainingSeconds = expireTime > 0 ? Math.max(0, expireTime - nowSeconds) : null

        return {
          nftAddress: nftAddr,
          status,
          priceTon,
          durationDays,
          startTime: startTime > 0 ? startTime : null,
          expireTime: expireTime > 0 ? expireTime : null,
          remainingSeconds,
          renterAddress: renterAddr,
          linkedContractAddress: linkedContract
        }
      }
    } catch {
      return null
    }
  }

  /**
   * Extracts NFT address from Cell 1 of a MarketApp contract data BoC hex.
   */
  static extractMarketAppNftAddress(bocHex: string): string | null {
    try {
      const cells = this.parseBocCells(bocHex)
      if (cells.length < 2) return null
      const c1Bits = this.toBits(cells[1].data)
      if (c1Bits.length < 534) return null
      const res = this.readAddress(c1Bits, 267)
      return res ? res.address : null
    } catch {
      return null
    }
  }

  /**
   * Parses standard 0:hex address from Ton BoC cell hex representation (TL-B MsgAddressInt).
   */
  static parseAddressFromCell(cellBocHex: string): string | null {
    try {
      const idx = cellBocHex.indexOf('80')
      if (idx === -1) return null
      const dataHex = cellBocHex.substring(idx)
      let bits = ''
      for (let i = 0; i < dataHex.length; i++) {
        const d = parseInt(dataHex[i], 16)
        if (isNaN(d)) continue
        bits += d.toString(2).padStart(4, '0')
      }
      if (bits.length < 267) return null
      const tag = bits.substring(0, 2)
      if (tag !== '10') return null

      let pos = 3
      const anycast = bits[2]
      if (anycast === '1') {
        const depth = parseInt(bits.substring(pos, pos + 5), 2)
        pos += 5 + depth
      }

      if (pos + 8 + 256 > bits.length) return null
      const wcBits = bits.substring(pos, pos + 8)
      // signed 8-bit workchain
      const wcUnsigned = parseInt(wcBits, 2)
      const workchain = wcUnsigned >= 128 ? wcUnsigned - 256 : wcUnsigned
      pos += 8

      const addrBits = bits.substring(pos, pos + 256)
      const addrBigInt = BigInt('0b' + addrBits)
      const hexAddress = addrBigInt.toString(16).padStart(64, '0')

      return `${workchain}:${hexAddress}`
    } catch {
      return null
    }
  }

  /**
   * Splits a gift name like "Scared Cat #16073" into collection and number.
   */
  static parseNameAndNumber(rawName: string): { collectionName: string; number: number } {
    const parts = rawName.split(' #')
    if (parts.length >= 2) {
      const collectionName = parts[0].trim()
      const number = parseInt(parts[1].trim(), 10) || 0
      return { collectionName, number }
    }
    return { collectionName: rawName.trim(), number: 0 }
  }

  static parseHexNumber(hexStr: string): number {
    const clean = hexStr.toLowerCase().startsWith('0x') ? hexStr.substring(2) : hexStr
    return parseInt(clean, 16) || 0
  }

  // ---- Low-level helpers ----

  private static readUint32(bits: string, startBit: number): number {
    if (startBit + 32 > bits.length) return 0
    return parseInt(bits.substring(startBit, startBit + 32), 2)
  }

  private static readAddress(bits: string, pos: number): { address: string; nextPos: number } | null {
    if (pos + 2 > bits.length) return null
    const tag = bits.substring(pos, pos + 2)
    if (tag === '00') return { address: 'None', nextPos: pos + 2 }
    if (tag !== '10') return null

    let p = pos + 2
    if (p >= bits.length) return null
    const anycast = bits[p]
    p++
    if (anycast === '1') {
      if (p + 5 > bits.length) return null
      const depth = parseInt(bits.substring(p, p + 5), 2)
      p += 5 + depth
    }

    if (p + 8 + 256 > bits.length) return null
    const wcBits = bits.substring(p, p + 8)
    const wcUnsigned = parseInt(wcBits, 2)
    const wc = wcUnsigned >= 128 ? wcUnsigned - 256 : wcUnsigned
    p += 8

    const addrBits = bits.substring(p, p + 256)
    const addrBigInt = BigInt('0b' + addrBits)
    const hexAddr = addrBigInt.toString(16).padStart(64, '0')
    return { address: `${wc}:${hexAddr}`, nextPos: p + 256 }
  }

  private static parseBocCells(bocHex: string): RawCell[] {
    const b = this.hexToBytes(bocHex)
    if (b.length < 10) return []
    // magic 0xb5ee9c72
    if (b[0] !== 0xb5 || b[1] !== 0xee || b[2] !== 0x9c || b[3] !== 0x72) {
      return []
    }

    const h = b[4]
    const hasIdx = (h & 0x80) !== 0
    const size = h & 7
    if (size <= 0) return []
    const offBytes = b[5]

    let pos = 6
    const readInt = (bytesCount: number): number => {
      let res = 0
      for (let i = 0; i < bytesCount; i++) {
        res = (res << 8) | b[pos + i]
      }
      pos += bytesCount
      return res
    }

    const cellsNum = readInt(size)
    const rootsNum = readInt(size)
    // absent
    readInt(size)
    // totCellsSize
    readInt(offBytes)

    // skip roots
    pos += rootsNum * size
    // skip index if present
    if (hasIdx) {
      pos += cellsNum * offBytes
    }

    const cells: RawCell[] = []
    for (let i = 0; i < cellsNum; i++) {
      if (pos + 2 > b.length) break
      const d1 = b[pos]
      const d2 = b[pos + 1]
      pos += 2
      const refsCnt = d1 & 7
      const dataLen = (d2 >> 1) + ((d2 & 1) !== 0 ? 1 : 0)

      if (pos + dataLen > b.length) break
      const cdata = b.slice(pos, pos + dataLen)
      pos += dataLen

      const refs: number[] = []
      for (let r = 0; r < refsCnt; r++) {
        if (pos + size > b.length) break
        refs.push(readInt(size))
      }
      cells.push({ idx: i, refs, data: cdata })
    }
    return cells
  }

  private static toBits(bytes: Uint8Array): string {
    let s = ''
    for (let i = 0; i < bytes.length; i++) {
      const v = bytes[i]
      for (let j = 7; j >= 0; j--) {
        s += ((v & (1 << j)) !== 0) ? '1' : '0'
      }
    }
    return s
  }

  private static hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.trim()
    const len = cleanHex.length
    const bytes = new Uint8Array(len / 2)
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
    }
    return bytes
  }
}
