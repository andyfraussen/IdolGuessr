'use client'

import type { ClassicMode } from '@/lib/classic'

export default function ClassicModeModal({
    open,
    active,
    onClose,
    onDaily,
    onUnlimited,
}: {
    open: boolean
    active?: ClassicMode
    onClose: () => void
    onDaily: () => void
    onUnlimited: () => void
}) {
    if (!open) return null

    return (
        <div className='fixed inset-0 z-[600] flex items-center justify-center bg-black/40 px-4'>
            <div
                className='modal-fade-in relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-zinc-900'
                role='dialog'
                aria-modal='true'
                aria-labelledby='classic-mode-title'
            >
                <button
                    type='button'
                    onClick={onClose}
                    className='absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    aria-label='Close'
                >
                    <CloseIcon />
                </button>
                <h2 id='classic-mode-title' className='text-2xl font-bold'>
                    Classic
                </h2>
                <p className='mt-2 text-sm text-gray-500 dark:text-zinc-400'>
                    Guess an idol from their group, age, and the rest.
                </p>
                <div className='mt-6 flex flex-col gap-3'>
                    <ModeButton
                        active={active === 'daily'}
                        onClick={onDaily}
                        title='Daily'
                    />
                    <ModeButton
                        active={active === 'infinite'}
                        onClick={onUnlimited}
                        title='Unlimited'
                    />
                </div>
            </div>
        </div>
    )
}

function ModeButton({
    active,
    onClick,
    title,
}: {
    active: boolean
    onClick: () => void
    title: string
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`w-full cursor-pointer rounded-full py-3 font-semibold ${
                active ? 'bg-pink-500 text-white' : 'bg-gray-100 text-black dark:bg-zinc-800 dark:text-white'
            }`}
        >
            {title}
        </button>
    )
}

function CloseIcon() {
    return (
        <svg className='h-4 w-4 text-gray-600 dark:text-zinc-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
        </svg>
    )
}
