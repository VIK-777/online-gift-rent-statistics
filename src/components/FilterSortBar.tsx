import React from 'react'
import { ArrowUpDown, Search } from 'lucide-react'

export type FilterStatus = 'all' | 'rented' | 'listed'
export type SortField = 'expiry' | 'earned' | 'price' | 'name'

interface FilterSortBarProps {
  statusFilter: FilterStatus
  onStatusChange: (status: FilterStatus) => void
  sortField: SortField
  onSortChange: (field: SortField) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  totalCount: number
  rentedCount: number
  listedCount: number
}

export const FilterSortBar: React.FC<FilterSortBarProps> = ({
  statusFilter,
  onStatusChange,
  sortField,
  onSortChange,
  searchQuery,
  onSearchChange,
  totalCount,
  rentedCount,
  listedCount
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2 space-y-2">
      {/* Search Input for gifts */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по названию или номеру (#1402)..."
          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Status Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <button
            onClick={() => onStatusChange('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              statusFilter === 'all'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Все ({totalCount})
          </button>
          <button
            onClick={() => onStatusChange('rented')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              statusFilter === 'rented'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            В аренде ({rentedCount})
          </button>
          <button
            onClick={() => onStatusChange('listed')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              statusFilter === 'listed'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Выставлены ({listedCount})
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 rounded-xl px-2 py-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField)}
            className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer pr-1"
          >
            <option value="expiry" className="bg-slate-900 text-white">По возврату</option>
            <option value="earned" className="bg-slate-900 text-white">По доходу</option>
            <option value="price" className="bg-slate-900 text-white">По цене</option>
            <option value="name" className="bg-slate-900 text-white">По имени</option>
          </select>
        </div>
      </div>
    </div>
  )
}
