const ITEMS = [
    { label: 'Correct', className: 'bg-[#3aa346]' },
    { label: 'Partial', className: 'bg-[#e39b2b]' },
    { label: 'Incorrect', className: 'bg-[#d64545]' },
    { label: 'Higher', className: 'bg-[#d64545]', direction: 'up' as const },
    { label: 'Lower', className: 'bg-[#d64545]', direction: 'down' as const },
]

export default function ColorLegend() {
    return (
        <div className='mt-6'>
            <div className='mt-3 flex flex-wrap items-end justify-center gap-4'>
                {ITEMS.map((item) => (
                    <div key={item.label} className='flex w-16 flex-col items-center gap-1'>
                        <div className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded text-white ${item.className}`}>
                            {item.direction && (
                                <span
                                    aria-hidden
                                    className='h-8 w-8 bg-black/60 mask-contain mask-center mask-no-repeat'
                                    style={{
                                        maskImage: 'url(/icons/arrow.svg)',
                                        WebkitMaskImage: 'url(/icons/arrow.svg)',
                                        transform: item.direction === 'down' ? 'rotate(180deg) scale(1.35)' : 'scale(1.35)',
                                    }}
                                />
                            )}
                        </div>
                        <span className='whitespace-pre-line text-center text-xs leading-tight text-[#fff]'>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
