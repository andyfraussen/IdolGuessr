'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile } from '@/lib/player'
import {
    createRoom,
    normalizeRoomCode,
    roomErrorText,
    visualSettings,
} from '@/lib/multiplayer'
import {
    DIFFICULTIES,
    DIFFICULTY_LABELS,
    IMAGE_MODE_LABELS,
    isImageMode,
    isInfiniteDifficulty,
    type ImageMode,
    type InfiniteDifficulty,
} from '@/utils/difficulty'
import {
    DEFAULT_INFINITE_GEN_FILTER,
    INFINITE_GEN_OPTIONS,
    INFINITE_GEN_VALUES,
    isValidInfiniteGenFilter,
} from '@/utils/genFilter'

type GroupFilter = 'boy-group' | 'girl-group' | 'both'

const GROUPS: { value: GroupFilter; label: string }[] = [
    { value: 'both', label: 'Both' },
    { value: 'boy-group', label: 'Boy groups' },
    { value: 'girl-group', label: 'Girl groups' },
]

const IMAGE_MODES: ImageMode[] = ['pixelated', 'zoom']

export default function MultiplayerCreatePage() {
    const router = useRouter()
    const [difficulty, setDifficulty] = useState<InfiniteDifficulty>('normal')
    const [imageMode, setImageMode] = useState<ImageMode>('pixelated')
    const [groupFilter, setGroupFilter] = useState<GroupFilter>('both')
    const [gens, setGens] = useState<number[]>(DEFAULT_INFINITE_GEN_FILTER)
    const [joinCode, setJoinCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const profile = getProfile()
        if (!profile) return
        if (isInfiniteDifficulty(profile.difficulty))
            setDifficulty(profile.difficulty)
        if (isImageMode(profile.image_mode)) setImageMode(profile.image_mode)
        if (
            profile.group_filter === 'boy-group' ||
            profile.group_filter === 'girl-group' ||
            profile.group_filter === 'both'
        ) {
            setGroupFilter(profile.group_filter)
        }
        if (isValidInfiniteGenFilter(profile.gen_filter))
            setGens(profile.gen_filter)
    }, [])

    const toggleGen = (gen: number) => {
        setGens((current) => {
            if (current.includes(gen)) {
                if (current.length === 1) return current
                return current.filter((value) => value !== gen)
            }
            return [...current, gen].sort((a, b) => a - b)
        })
    }

    const create = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const code = await createRoom(
                visualSettings({
                    difficulty,
                    imageMode,
                    groupFilter,
                    genFilter: gens,
                })
            )
            router.push(`/multiplayer/${code}`)
        } catch (err) {
            setError(roomErrorText(err))
            setBusy(false)
        }
    }

    const join = () => {
        const code = normalizeRoomCode(joinCode)
        if (!code) return
        router.push(`/multiplayer/${code}`)
    }

    return (
        <div className='fixed inset-0 overflow-y-auto bg-white dark:bg-zinc-950'>
            <div className='mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6 sm:my-6 sm:min-h-0 sm:rounded-[15px] sm:border sm:border-gray-200 sm:shadow-lg sm:dark:border-zinc-700'>
                <button
                    type='button'
                    onClick={() => router.push('/')}
                    className='mb-4 w-fit cursor-pointer text-sm font-semibold text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-white'
                >
                    Home
                </button>
                <h1 className='text-2xl font-bold uppercase'>Live room</h1>
                <p className='mt-2 text-sm text-gray-600 dark:text-zinc-400'>
                    One shared idol. Everyone guesses on their own. During a
                    round, the room only sees who solved it and who ran out.
                </p>
                <p className='mt-2 text-sm text-gray-600 dark:text-zinc-400'>
                    Hints and skips stay off. Challenger is 3 guesses. Easy,
                    normal, and hard are 6. A room lasts 24 hours and holds 8
                    players.
                </p>

                <fieldset className='mt-6'>
                    <legend className='mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300'>
                        Difficulty
                    </legend>
                    <div className='grid grid-cols-2 gap-2'>
                        {DIFFICULTIES.map((value) => (
                            <Choice
                                key={value}
                                selected={difficulty === value}
                                onClick={() => setDifficulty(value)}
                                label={DIFFICULTY_LABELS[value]}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset className='mt-4'>
                    <legend className='mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300'>
                        Image
                    </legend>
                    <div className='grid grid-cols-2 gap-2'>
                        {IMAGE_MODES.map((value) => (
                            <Choice
                                key={value}
                                selected={imageMode === value}
                                onClick={() => setImageMode(value)}
                                label={IMAGE_MODE_LABELS[value]}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset className='mt-4'>
                    <legend className='mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300'>
                        Groups
                    </legend>
                    <div className='grid grid-cols-3 gap-2'>
                        {GROUPS.map((option) => (
                            <Choice
                                key={option.value}
                                selected={groupFilter === option.value}
                                onClick={() => setGroupFilter(option.value)}
                                label={option.label}
                            />
                        ))}
                    </div>
                </fieldset>

                <fieldset className='mt-4'>
                    <legend className='mb-2 text-sm font-medium text-gray-700 dark:text-zinc-300'>
                        Generations
                    </legend>
                    <div className='grid grid-cols-4 gap-2'>
                        {INFINITE_GEN_OPTIONS.map((option) => (
                            <Choice
                                key={option.value}
                                selected={gens.includes(option.value)}
                                onClick={() => toggleGen(option.value)}
                                label={option.label.replace('Gen ', '')}
                            />
                        ))}
                    </div>
                    <p className='mt-1 text-xs text-gray-500 dark:text-zinc-500'>
                        {gens.length === INFINITE_GEN_VALUES.length
                            ? 'All generations'
                            : gens.map((gen) => `Gen ${gen}`).join(', ')}
                    </p>
                </fieldset>

                <button
                    type='button'
                    onClick={() => void create()}
                    disabled={busy}
                    className='mt-6 cursor-pointer rounded-full bg-pink-600 px-4 py-2.5 font-semibold text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-70'
                >
                    {busy ? 'Creating...' : 'Create room'}
                </button>

                <div className='mt-8 border-t border-gray-200 pt-6 dark:border-zinc-800'>
                    <label
                        htmlFor='room-code'
                        className='mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300'
                    >
                        Join with a code
                    </label>
                    <div className='flex gap-2'>
                        <input
                            id='room-code'
                            value={joinCode}
                            onChange={(event) =>
                                setJoinCode(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') join()
                            }}
                            placeholder='Paste a code or link'
                            className='min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
                            autoCapitalize='none'
                            autoCorrect='off'
                            spellCheck={false}
                        />
                        <button
                            type='button'
                            onClick={join}
                            className='cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900'
                        >
                            Join
                        </button>
                    </div>
                </div>

                {error && (
                    <p
                        className='mt-4 text-sm font-medium text-red-600'
                        role='alert'
                    >
                        {error}
                    </p>
                )}
            </div>
        </div>
    )
}

function Choice({
    selected,
    onClick,
    label,
}: {
    selected: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-pressed={selected}
            className={`cursor-pointer rounded-md border px-2 py-2 text-sm font-semibold ${
                selected
                    ? 'border-pink-600 bg-pink-600 text-white'
                    : 'border-gray-300 bg-white text-black hover:border-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
            }`}
        >
            {label}
        </button>
    )
}
