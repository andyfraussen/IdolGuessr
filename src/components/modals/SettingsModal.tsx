'use client'

import localFont from 'next/font/local'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useInputMode } from '@/utils/inputMode'

const proximaNovaBold = localFont({
    src: '../../../public/fonts/proximanova_bold.otf',
})

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [inputMode, setInputMode] = useInputMode()

    if (!isOpen) return null

    return (
        <div className='bg-opacity-50 fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4'>
            <div className='modal-fade-in relative w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-900'>
                <button
                    onClick={onClose}
                    className='absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    aria-label='Close settings'
                >
                    <svg
                        className='h-4 w-4 text-gray-600 dark:text-zinc-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                    >
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                        />
                    </svg>
                </button>

                <h1 className={`${proximaNovaBold.className} text-2xl uppercase`}>
                    Settings
                </h1>
                <p className='mt-2 text-gray-600 dark:text-zinc-400'>
                    Appearance and how you enter guesses.
                </p>

                <div className='mt-6 border-t border-gray-200 pt-4 dark:border-zinc-700'>
                    <p className='mb-3 text-lg font-semibold text-black dark:text-zinc-100'>
                        Appearance
                    </p>
                    <ThemeToggle />
                </div>

                <div className='mt-6 border-t border-gray-200 pt-4 dark:border-zinc-700'>
                    <div className='flex items-center justify-between gap-4'>
                        <p className='text-lg font-semibold text-black dark:text-zinc-100'>
                            On-screen keyboard
                        </p>
                        <div
                            className='grid shrink-0 grid-cols-2 gap-2'
                            role='group'
                            aria-label='On-screen keyboard'
                        >
                            {(
                                [
                                    { value: 'keyboard', label: 'ON' },
                                    { value: 'text', label: 'OFF' },
                                ] as const
                            ).map((option) => (
                                <button
                                    key={option.value}
                                    type='button'
                                    onClick={() => setInputMode(option.value)}
                                    aria-pressed={inputMode === option.value}
                                    className={`min-w-[3.25rem] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                        inputMode === option.value
                                            ? 'border-green-400 bg-green-400/10 text-black dark:text-zinc-100'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
