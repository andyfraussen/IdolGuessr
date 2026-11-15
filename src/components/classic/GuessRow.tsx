import Image from 'next/image'
import AttributeCell from '@/components/classic/AttributeCell'
import { idolPortrait, type ClassicFeedback } from '@/lib/classic'
import { GUESS_COLUMNS } from '@/components/classic/columns'

export default function GuessRow({ guess, animate = false }: { guess: ClassicFeedback; animate?: boolean }) {
    const portrait = idolPortrait(guess)

    return (
        <div className='contents' style={{ perspective: '600px' }}>
            <div className='relative h-[7.5rem] w-full overflow-hidden rounded-md border border-zinc-300 bg-zinc-900 dark:border-zinc-700'>
                {portrait ? (
                    <Image
                        src={portrait}
                        alt=''
                        width={120}
                        height={120}
                        className='h-full w-full object-cover'
                    />
                ) : (
                    <div className='h-full w-full bg-zinc-200 dark:bg-zinc-800' />
                )}
                <span className='absolute bottom-0 left-1/2 max-w-[calc(100%-0.75rem)] -translate-x-1/2 truncate bg-pink-700 px-1.5 py-0.5 text-center text-xs rounded-t-md font-semibold text-white'>
                    {guess.name}
                </span>
            </div>
            {GUESS_COLUMNS.map((column, index) => (
                <AttributeCell
                    key={column.key}
                    column={column.key}
                    value={guess[column.key].value}
                    status={guess[column.key].status}
                    delay={animate ? 70 * (index + 1) : 0}
                />
            ))}
        </div>
    )
}
