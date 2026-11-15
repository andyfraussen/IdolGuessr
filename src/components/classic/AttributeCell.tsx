import type { AttributeStatus } from '@/lib/classic'

const TONE: Record<AttributeStatus, string> = {
    correct: 'bg-[#3aa346]',
    partial: 'bg-[#e39b2b]',
    wrong: 'bg-[#d64545]',
    higher: 'bg-[#d64545]',
    lower: 'bg-[#d64545]',
}

export function formatAttribute(key: string, value: string | number | null) {
    if (value == null || value === '') return '—'
    if (key === 'height') return `${value} cm`
    return String(value)
}

export default function AttributeCell({
    column,
    value,
    status,
    delay = 0,
}: {
    column: string
    value: string | number | null
    status: AttributeStatus
    delay?: number
}) {
    const direction = status === 'higher' ? 'up' : status === 'lower' ? 'down' : null

    return (
        <div
            className={`relative flex h-[7.5rem] w-full items-center justify-center overflow-hidden rounded-md px-2 text-center text-sm font-semibold text-white ${TONE[status]}`}
            style={delay > 0 ? { animation: `classic-flip 1.5s ease ${delay}ms both` } : undefined}
        >
            {direction && (
                <span
                    aria-hidden
                    className='pointer-events-none absolute inset-0 bg-black/60 mask-contain mask-center mask-no-repeat'
                    style={{
                        maskImage: 'url(/icons/arrow.svg)',
                        WebkitMaskImage: 'url(/icons/arrow.svg)',
                        transform: direction === 'down' ? 'rotate(180deg) scale(1.45)' : 'scale(1.45)',
                    }}
                />
            )}
            <span className='relative z-10 min-w-0 leading-tight break-words'>
                {formatAttribute(column, value)}
            </span>
        </div>
    )
}
