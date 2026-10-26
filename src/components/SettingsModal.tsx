import React, { useState } from 'react'
import { X, Key, Trash2, ShieldCheck, Check, ExternalLink } from 'lucide-react'
import { AppSettings } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onSaveSettings: (settings: AppSettings) => void
  onClearCache: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearCache
}) => {
  const [apiKey, setApiKey] = useState(settings.customApiKey)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSaveSettings({
      ...settings,
      customApiKey: apiKey.trim()
    })
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Key className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-white">Настройки приложения</h3>
        </div>

        {/* Info card */}
        <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-500/20 mb-4 text-xs text-sky-200/90 leading-relaxed">
          <p className="font-semibold text-sky-300 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4" />
            100% Client-Side (Без бэкенда)
          </p>
          Сайт работает прямо в вашем браузере и по умолчанию выполняет запросы к TonAPI без ключа с автоматической очередью (1 RPS).
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Optional API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Свой ключ TonAPI (опционально)
              </label>
              <a
                href="https://tonconsole.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
              >
                <span>Получить бесплатно</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AFUYJZHLL2..."
              spellCheck={false}
              autoCapitalize="none"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Ключ сохраняется только в памяти вашего браузера (localStorage) и не отправляется на сторонние серверы.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center justify-center gap-1"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Сохранено!</span>
                </>
              ) : (
                <span>Сохранить настройки</span>
              )}
            </button>
          </div>
        </form>

        {/* Clear cache section */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-300">Локальный кэш</p>
            <p className="text-[10px] text-slate-500">Сбросить сохраненные данные кошельков</p>
          </div>
          <button
            onClick={() => {
              onClearCache()
              onClose()
            }}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium transition active:scale-95 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Очистить</span>
          </button>
        </div>
      </div>
    </div>
  )
}
