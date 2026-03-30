'use client'
import { useState } from 'react'

interface Props {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleCard({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-border/40 transition-colors"
      >
        <div className="text-left">
          <h3 className="text-brand-cream text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-brand-light text-sm mt-0.5">{subtitle}</p>}
        </div>
        <span aria-hidden="true" className="text-brand-cream text-base">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}
