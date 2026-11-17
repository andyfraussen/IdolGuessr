import GuessRow from '@/components/classic/GuessRow'
import { GUESS_COLUMNS } from '@/components/classic/columns'
import type { ClassicFeedback } from '@/lib/classic'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
})

export default function GuessGrid({
    guesses,
    newestId,
    onRevealEnd,
}: {
    guesses: ClassicFeedback[]
    newestId: number | null
    onRevealEnd?: () => void
}) {
    if (guesses.length === 0) {
        return (
            <p className='mt-8 text-center text-sm text-gray-500 dark:text-zinc-400'>
                Type an idol to see how close you are.
            </p>
        )
    }

    const rows = [...guesses].reverse()

    return (
        <div className='mt-6 min-w-0 overflow-x-auto pb-2'>
            <div
                className={`mx-auto grid w-max grid-cols-[7.5rem_repeat(8,7.5rem)] gap-x-1.5 gap-y-1.5 ${spaceGrotesk.className}`}
                style={{ perspective: '1200px' }}
            >
                <div className='flex items-end justify-center px-1 text-center text-sm font-semibold tracking-wide text-black dark:text-white uppercase'>
                    Idol
                </div>
                {GUESS_COLUMNS.map((column) => (
                    <div
                        key={column.key}
                        className='flex items-end justify-center px-1 text-center text-sm font-semibold tracking-wide text-black dark:text-white uppercase'
                    >
                        {column.label}
                    </div>
                ))}
                {rows.map((guess) => (
                    <GuessRow
                        key={guess.id}
                        guess={guess}
                        animate={guess.id === newestId}
                        onRevealEnd={guess.id === newestId ? onRevealEnd : undefined}
                    />
                ))}
            </div>
        </div>
    )
}
