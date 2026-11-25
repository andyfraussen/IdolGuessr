'use client'

import Image from 'next/image'
import localFont from 'next/font/local'
import copy from 'copy-to-clipboard'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import { guessShareLines, idolPortrait, type ClassicAnswer, type ClassicFeedback, type ClassicMode } from '@/lib/classic'

const proximaNovaBold = localFont({
    src: '../../../public/fonts/proximanova_bold.otf',
})

export default function ClassicWinModal({
    open,
    mode,
    answer,
    guesses,
    dailyId,
    onClose,
    onNext,
}: {
    open: boolean
    mode: ClassicMode
    answer: ClassicAnswer | null
    guesses: ClassicFeedback[]
    dailyId: number | null
    onClose: () => void
    onNext?: () => void
}) {
    const [copied, setCopied] = useState(false)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const portrait = answer ? idolPortrait(answer) : ''
    const gaveUp = guesses.every((guess) => guess.id !== answer?.id)

    useEffect(() => {
        if (!open) return
        document.body.style.overflow = 'hidden'
        const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
        update()
        window.addEventListener('resize', update)
        return () => {
            document.body.style.overflow = 'unset'
            window.removeEventListener('resize', update)
        }
    }, [open])

    useEffect(() => {
        if (!copied) return
        const id = window.setTimeout(() => setCopied(false), 1500)
        return () => window.clearTimeout(id)
    }, [copied])

    if (!open || !answer) return null

    const share = () => {
        const heading = mode === 'daily' ? `Classic #${dailyId ?? ''}` : 'Classic'
        const text = [
            heading.trim(),
            guessShareLines(guesses),
            gaveUp ? 'Revealed' : `${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}`,
            mode === 'daily' ? 'https://idolguessr.fun/classic' : 'https://idolguessr.fun/classic/infinite',
        ]
            .filter(Boolean)
            .join('\n')
        setCopied(copy(text))
    }

    return (
        <>
            {!gaveUp && size.width > 0 && (
                <div className='pointer-events-none fixed inset-0 z-[560]'>
                    <Confetti
                        width={size.width}
                        height={size.height}
                        recycle={false}
                        numberOfPieces={200}
                        gravity={0.3}
                    />
                </div>
            )}
            <div className='hide-scrollbar fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-black/50'>
                <motion.div
                    className='relative w-full max-w-md bg-white shadow-xl sm:my-8 sm:rounded-2xl dark:bg-zinc-900'
                    role='dialog'
                    aria-modal='true'
                    aria-labelledby='classic-result-title'
                    initial={{ y: -48, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                    <button
                        type='button'
                        onClick={onClose}
                        className='absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                        aria-label='Close'
                    >
                        <svg className='h-4 w-4 text-gray-600 dark:text-zinc-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>

                    <div className='flex flex-col items-center p-6'>
                        <h2
                            id='classic-result-title'
                            className={`${proximaNovaBold.className} mt-8 mb-1 text-3xl font-extrabold text-black dark:text-zinc-100`}
                        >
                            {gaveUp ? 'NICE TRY!' : 'GOOD JOB!'}
                        </h2>
                        <p className='mb-1 text-base text-gray-700 dark:text-zinc-300'>
                            {gaveUp ? (
                                <>
                                    You failed to guess{' '}
                                    <span className='font-bold text-red-500'>{answer.name}</span>
                                </>
                            ) : (
                                <>
                                    You guessed{' '}
                                    <span className='font-bold text-green-400'>{answer.name}</span> in{' '}
                                    {guesses.length} {guesses.length === 1 ? 'guess!' : 'guesses!'}
                                </>
                            )}
                        </p>
                        <p className='mb-6 text-sm text-gray-500 dark:text-zinc-400'>{answer.group_name}</p>

                        {portrait ? (
                            <div className='mb-4 w-full overflow-hidden sm:rounded-lg'>
                                <div className='relative aspect-square w-full'>
                                    <Image
                                        src={portrait}
                                        alt={answer.name}
                                        fill
                                        className='object-cover'
                                        sizes='(max-width: 448px) 100vw, 448px'
                                        unoptimized
                                    />
                                </div>
                            </div>
                        ) : null}

                        {mode === 'daily' ? (
                            <button
                                type='button'
                                onClick={share}
                                className='mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-pink-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-pink-700'
                            >
                                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z'
                                    />
                                </svg>
                                {copied ? 'Copied' : 'Share'}
                            </button>
                        ) : (
                            <button
                                type='button'
                                onClick={onNext}
                                className='mb-3 w-full cursor-pointer rounded-full bg-green-400 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-green-500'
                            >
                                NEXT IDOL
                            </button>
                        )}
                        <button
                            type='button'
                            onClick={onClose}
                            className='w-full cursor-pointer rounded-full bg-gray-100 px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </>
    )
}
