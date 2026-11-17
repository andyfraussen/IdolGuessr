'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClassicGroup } from '@/lib/classic'

const OPTIONS: Array<{ id: ClassicGroup; label: string }> = [
    { id: 'both', label: 'All groups' },
    { id: 'girl-group', label: 'Girl groups' },
    { id: 'boy-group', label: 'Boy groups' },
]

export default function ClassicFilterModal({
    open,
    value,
    busy = false,
    onClose,
    onStart,
}: {
    open: boolean
    value: ClassicGroup
    busy?: boolean
    onClose?: () => void
    onStart: (group: ClassicGroup) => void
}) {
    const [selected, setSelected] = useState<ClassicGroup>(value)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) {
            setSelected(value)
            setMenuOpen(false)
        }
    }, [open, value])

    useEffect(() => {
        if (!menuOpen) return
        const close = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [menuOpen])

    if (!open) return null

    const selectedLabel = OPTIONS.find((option) => option.id === selected)?.label ?? 'All groups'

    return (
        <div className='fixed inset-0 z-[600] flex items-center justify-center bg-black/40 px-4'>
            <div
                className='modal-fade-in relative w-full max-w-sm rounded-md bg-white p-10 text-left shadow-xl dark:bg-zinc-900'
                role='dialog'
                aria-modal='true'
                aria-labelledby='classic-filter-title'
            >
                {onClose && (
                    <button
                        type='button'
                        onClick={onClose}
                        className='absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        aria-label='Close'
                    >
                        <CloseIcon />
                    </button>
                )}
                <h2 id='classic-filter-title' className='text-center text-xl font-bold uppercase md:text-2xl'>
                    Filters
                </h2>
                <p className='mt-2 text-center text-sm text-gray-500 dark:text-zinc-400'>
                    Choose who to guess. You can change this when you start a new game.
                </p>
                <div className='mt-6 mb-6'>
                    <label className='mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300'>
                        Group type
                    </label>
                    <div ref={menuRef} className='relative'>
                        <button
                            type='button'
                            onClick={() => setMenuOpen((openMenu) => !openMenu)}
                            className='flex w-full cursor-pointer items-center justify-between border-2 border-gray-200 bg-white px-3 py-2 text-left font-medium transition-all hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
                            aria-expanded={menuOpen}
                        >
                            <span>{selectedLabel}</span>
                            <ChevronDownIcon className={`h-5 w-5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {menuOpen && (
                            <div className='absolute z-10 mt-1 w-full border-2 border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900'>
                                {OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type='button'
                                        onClick={() => {
                                            setSelected(option.id)
                                            setMenuOpen(false)
                                        }}
                                        className={`w-full cursor-pointer px-3 py-2 text-left font-medium transition-all hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                                            selected === option.id ? 'bg-gray-100 dark:bg-zinc-800' : ''
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className='flex justify-center'>
                    <button
                        type='button'
                        disabled={busy}
                        onClick={() => onStart(selected)}
                        className='w-[200px] cursor-pointer rounded-full bg-pink-600 hover:bg-pink-700 transition-colors font-bold px-4 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50'
                    >
                        Start
                    </button>
                </div>
            </div>
        </div>
    )
}

function ChevronDownIcon({ className }: { className?: string }) {
    return (
        <svg xmlns='http://www.w3.org/2000/svg' className={className} viewBox='0 0 20 20' fill='currentColor'>
            <path
                fillRule='evenodd'
                d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                clipRule='evenodd'
            />
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
        </svg>
    )
}
