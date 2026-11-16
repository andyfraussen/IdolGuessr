import type { AttributeStatus } from '@/lib/classic'
import { COUNTRIES } from '@/components/classic/countries'
import Image from 'next/image'

const TONE: Record<AttributeStatus, string> = {
    correct: 'bg-[#3aa346]',
    partial: 'bg-[#e39b2b]',
    wrong: 'bg-[#d64545]',
    higher: 'bg-[#d64545]',
    lower: 'bg-[#d64545]',
}

function formatHeight(value: string | number) {
    const cm = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(cm)) return String(value)
    const totalInches = Math.round(cm / 2.54)
    const feet = Math.floor(totalInches / 12)
    const inches = totalInches % 12
    return `${cm}cm/${feet}'${inches}`
}

function NationalityValue({ value }: { value: string }) {
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
    return (
        <span className='flex flex-col items-center gap-1'>
            {parts.map((part) => {
                const country = COUNTRIES[part]
                if (!country) return <span key={part}>{part}</span>
                return (
                    <span key={part} className='flex flex-col items-center gap-0.5'>
                        <Image
                            src={`/flags/${country.code}.svg`}
                            alt={country.name}
                            width={0}
                            height={0}
                            className='w-10 h-10'
                        />
                        <span className='text-xs leading-none'>{country.name}</span>
                    </span>
                )
            })}
        </span>
    )
}

export function formatAttribute(key: string, value: string | number | null) {
    if (value == null || value === '') return '—'
    if (key === 'height') return formatHeight(value)
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
    const showNationality = column === 'nationality' && typeof value === 'string' && value !== ''

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
                {showNationality ? <NationalityValue value={value} /> : formatAttribute(column, value)}
            </span>
        </div>
    )
}
