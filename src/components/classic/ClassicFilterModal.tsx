'use client'

import { useEffect, useState } from 'react'
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

    useEffect(() => {
        if (open) setSelected(value)
    }, [open, value])

    if (!open) return null

    return (
        <div className='fixed inset-0 z-[600] flex items-center justify-center bg-black/40 px-4'>
            <div
                className='w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-900'
                role='dialog'
                aria-modal='true'
                aria-labelledby='classic-filter-title'
            >
                <h2 id='classic-filter-title' className='text-2xl font-bold'>
                    Groups
                </h2>
                <p className='mt-2 text-sm text-gray-500 dark:text-zinc-400'>
                    Choose who to guess. You can change this when you start a new game.
                </p>
                <div className='mt-6 flex flex-col gap-3'>
                    {OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type='button'
                            onClick={() => setSelected(option.id)}
                            className={`w-full cursor-pointer rounded-full py-3 font-semibold ${
                                selected === option.id
                                    ? 'bg-pink-500 text-white'
                                    : 'bg-gray-100 text-black dark:bg-zinc-800 dark:text-white'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type='button'
                    disabled={busy}
                    onClick={() => onStart(selected)}
                    className='mt-4 w-full cursor-pointer rounded-full bg-black py-3 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black'
                >
                    Start
                </button>
                {onClose && (
                    <button
                        type='button'
                        onClick={onClose}
                        className='mt-2 w-full cursor-pointer rounded-full py-3 text-sm text-gray-500 dark:text-zinc-400'
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    )
}
