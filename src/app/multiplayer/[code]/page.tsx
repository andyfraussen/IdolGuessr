'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import copy from 'copy-to-clipboard'
import Confetti from 'react-confetti'
import GameImage from '@/components/game/GameImage'
import GuessInput from '@/components/game/GuessInput'
import IdolTextInput from '@/components/input/IdolTextInput'
import OnScreenKeyboard from '@/components/input/OnScreenKeyboard'
import RoomScoreboard from '@/components/multiplayer/RoomScoreboard'
import FeedbackIcon from '@/components/theme/FeedbackIcon'
import { useColorblind } from '@/components/theme/ColorblindProvider'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { feedbackPalette } from '@/lib/feedbackPalette'
import {
    normalizeRoomCode,
    roomErrorCode,
    roomErrorText,
    type RoomSnapshot,
} from '@/lib/multiplayer'
import idolNames from '@/data/idolNames.json'
import { getDifficultyConfig } from '@/utils/difficulty'
import { useInputMode } from '@/utils/inputMode'

const idolNamesSet = new Set(
    (idolNames as string[]).map((name) => name.toUpperCase())
)

export default function MultiplayerRoomPage() {
    const params = useParams<{ code: string }>()
    const rawCode = Array.isArray(params.code) ? params.code[0] : params.code
    const code = normalizeRoomCode(rawCode ?? '')
    const router = useRouter()
    const roomApi = useMultiplayerRoom(code)
    const { room, onlineIds, loading, error } = roomApi
    const [inputMode, , inputModeReady] = useInputMode()
    const [currentGuess, setCurrentGuess] = useState('')
    const [lastIncorrect, setLastIncorrect] = useState('')
    const [animating, setAnimating] = useState(false)
    const [notInList, setNotInList] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [busy, setBusy] = useState(false)
    const [pops, setPops] = useState<Record<string, number>>({})
    const [confettiKey, setConfettiKey] = useState(0)
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
    const seenStatus = useRef(new Map<string, string>())
    const guessLock = useRef(false)
    const guessRef = useRef('')
    const [keptGuesses, setKeptGuesses] = useState<string[]>([])

    useEffect(() => {
        const measure = () =>
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    useEffect(() => {
        if (!room) return
        let celebrate = false
        const flipped: string[] = []
        for (const player of room.players) {
            const key = `${room.round_index}:${player.status ?? ''}`
            const previous = seenStatus.current.get(player.user_id)
            if (
                previous &&
                previous !== key &&
                previous.startsWith(`${room.round_index}:`) &&
                (player.status === 'won' || player.status === 'lost')
            ) {
                flipped.push(player.user_id)
                if (player.status === 'won') celebrate = true
            }
            seenStatus.current.set(player.user_id, key)
        }
        if (flipped.length > 0) {
            setPops((current) => {
                const next = { ...current }
                for (const id of flipped) next[id] = (next[id] ?? 0) + 1
                return next
            })
        }
        if (celebrate) setConfettiKey((value) => value + 1)
    }, [room])

    useEffect(() => {
        guessRef.current = ''
        setCurrentGuess('')
        setKeptGuesses([])
        setLastIncorrect('')
        setNotInList(false)
        setAnimating(false)
    }, [room?.round_index])

    const showMissing = useCallback(() => {
        setNotInList(true)
        setAnimating(true)
        window.setTimeout(() => {
            setAnimating(false)
            window.setTimeout(() => setNotInList(false), 1000)
        }, 500)
    }, [])

    const me = room?.players.find((player) => player.user_id === room.you)
    const isHost = !!room && room.host_id === room.you
    const maxGuesses = getDifficultyConfig(
        room?.settings.difficulty ?? 'normal'
    ).maxGuesses
    const serverGuesses = me?.guesses ?? []
    const myGuesses =
        serverGuesses.length >= keptGuesses.length ? serverGuesses : keptGuesses
    const canGuess =
        room?.status === 'playing' && me?.status === 'in_progress' && !busy
    const roundEnded = room?.status === 'between_rounds'
    const gameWon = me?.status === 'won'
    const gameLost = me?.status === 'lost' || (roundEnded === true && !gameWon)
    const dots = useMemo(
        () =>
            Array.from({ length: maxGuesses }, (_, index) => {
                if (index >= myGuesses.length) return 'empty' as const
                if (gameWon && index === myGuesses.length - 1)
                    return 'correct' as const
                return 'incorrect' as const
            }),
        [gameWon, maxGuesses, myGuesses]
    )

    const submitGuess = async (raw: string) => {
        const normalized = raw.toUpperCase().trim()
        if (!normalized || !canGuess || guessLock.current) return
        if (!idolNamesSet.has(normalized)) {
            showMissing()
            return
        }
        guessLock.current = true
        setBusy(true)
        setActionError(null)
        try {
            const next = await roomApi.submit(normalized)
            const player = next.players.find((row) => row.user_id === next.you)
            const recorded = player?.guesses ?? []
            if (recorded.length > 0) {
                setKeptGuesses((current) =>
                    recorded.length >= current.length ? recorded : current
                )
            }
            guessRef.current = ''
            setCurrentGuess('')
            if (player?.status !== 'won') {
                setLastIncorrect(normalized)
                setAnimating(true)
                window.setTimeout(() => {
                    setAnimating(false)
                    setLastIncorrect('')
                }, 500)
            }
        } catch (err) {
            if (roomErrorCode(err) === 'not_in_list') showMissing()
            else setActionError(roomErrorText(err))
        } finally {
            guessLock.current = false
            setBusy(false)
        }
    }

    const onKey = (key: string) => {
        if (!canGuess) return
        if (key === 'ENTER') {
            void submitGuess(guessRef.current)
            return
        }
        if (key === '✕') {
            guessRef.current = guessRef.current.slice(0, -1)
            setCurrentGuess(guessRef.current)
            return
        }
        if (guessRef.current.length >= 20 || animating) return
        if (lastIncorrect) setLastIncorrect('')
        guessRef.current += key
        setCurrentGuess(guessRef.current)
    }
    const onKeyRef = useRef(onKey)
    onKeyRef.current = onKey

    useEffect(() => {
        if (!inputModeReady || inputMode !== 'keyboard') return
        const onPhysicalKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable)
            ) {
                return
            }
            if (event.repeat) return
            const key = event.key.toUpperCase()
            if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-Z0-9]$/.test(key)) {
                event.preventDefault()
            }
            if (key === 'ENTER') onKeyRef.current('ENTER')
            else if (key === 'BACKSPACE') onKeyRef.current('✕')
            else if (/^[A-Z0-9]$/.test(key)) onKeyRef.current(key)
        }
        window.addEventListener('keydown', onPhysicalKey)
        return () => window.removeEventListener('keydown', onPhysicalKey)
    }, [inputMode, inputModeReady])

    const hostAction = async (action: () => Promise<RoomSnapshot>) => {
        if (busy) return
        setBusy(true)
        setActionError(null)
        try {
            await action()
        } catch (err) {
            setActionError(roomErrorText(err))
        } finally {
            setBusy(false)
        }
    }

    const leave = async () => {
        try {
            await roomApi.leave()
        } catch (err) {
            console.error('leave room', err)
        }
        router.push('/')
    }

    const copyLink = () => {
        const link = `${window.location.origin}/multiplayer/${code}`
        copy(link)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className='fixed inset-0 flex flex-col justify-center overflow-hidden bg-white dark:bg-zinc-950'>
            <div className='mx-auto flex h-full w-full max-w-none flex-col sm:max-h-[900px] sm:max-w-md sm:rounded-[15px] sm:border sm:border-gray-200 sm:shadow-lg sm:dark:border-zinc-700'>
                <header className='flex shrink-0 items-center justify-between gap-2 p-4'>
                    <button
                        type='button'
                        onClick={() => router.push('/')}
                        className='cursor-pointer'
                        aria-label='Go to home screen'
                    >
                        <Image
                            width={40}
                            height={40}
                            src='/icons/icon.svg'
                            alt='IdolGuessr'
                            className='h-10 w-auto dark:invert'
                        />
                    </button>
                    <div className='rounded-full bg-pink-600 px-3.5 py-1.5 text-sm font-bold tracking-widest text-white uppercase'>
                        Live
                    </div>
                    <button
                        type='button'
                        onClick={() => void leave()}
                        className='cursor-pointer text-sm font-semibold text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-white'
                    >
                        Leave
                    </button>
                </header>

                <div className='flex min-h-0 flex-1 flex-col px-4 pb-4'>
                    {loading ? (
                        <p className='m-auto text-gray-400 dark:text-zinc-500'>
                            Loading...
                        </p>
                    ) : error || !room ? (
                        <div className='m-auto max-w-xs text-center'>
                            <p className='font-semibold'>
                                {roomErrorText(
                                    new Error(error ?? 'room_not_found')
                                )}
                            </p>
                            <button
                                type='button'
                                onClick={() => router.push('/multiplayer')}
                                className='mt-4 cursor-pointer rounded-full bg-pink-600 px-4 py-2 font-semibold text-white'
                            >
                                Back
                            </button>
                        </div>
                    ) : (
                        <>
                            <RoomScoreboard
                                players={room.players}
                                onlineIds={onlineIds}
                                youId={room.you}
                                pops={pops}
                            />

                            {room.status === 'lobby' ||
                            room.status === 'closed' ? (
                                <Lobby
                                    room={room}
                                    isHost={isHost}
                                    busy={busy}
                                    copied={copied}
                                    onCopy={copyLink}
                                    onStart={() =>
                                        void hostAction(roomApi.start)
                                    }
                                />
                            ) : (
                                <div className='flex min-h-0 flex-1 flex-col'>
                                    <div className='flex min-h-0 flex-1 flex-col items-center'>
                                        <GameImage
                                            isLoading={!room.idol}
                                            dailyImage={
                                                room.idol && {
                                                    group_type:
                                                        room.idol.group_type,
                                                    img_bucket:
                                                        room.idol.img_bucket,
                                                    group_category:
                                                        room.idol
                                                            .group_category,
                                                    base64_group:
                                                        room.idol.base64_group,
                                                    zoom_x: room.idol.zoom_x,
                                                    zoom_y: room.idol.zoom_y,
                                                }
                                            }
                                            imageMode={room.settings.image_mode}
                                            remainingGuesses={Math.max(
                                                0,
                                                maxGuesses - myGuesses.length
                                            )}
                                            gameWon={gameWon}
                                            gameLost={gameLost}
                                            gameMode='unlimited'
                                            maxGuesses={maxGuesses}
                                            maxHints={0}
                                            maxSkips={0}
                                            hintsRemaining={0}
                                            skipsRemaining={0}
                                            guesses={dots}
                                        />
                                    </div>

                                    <RoundBanner
                                        room={room}
                                        won={gameWon}
                                        lost={me?.status === 'lost'}
                                        guess={
                                            gameWon
                                                ? (myGuesses[
                                                      myGuesses.length - 1
                                                  ] ?? '')
                                                : ''
                                        }
                                        notInList={notInList}
                                        animating={animating}
                                        lastIncorrect={lastIncorrect}
                                        currentGuess={currentGuess}
                                        showInput={
                                            inputModeReady &&
                                            room.status === 'playing' &&
                                            me?.status === 'in_progress'
                                        }
                                        inputMode={inputMode}
                                        busy={busy}
                                        onSubmit={(guess) =>
                                            void submitGuess(guess)
                                        }
                                        onKey={onKey}
                                    />

                                    {isHost && (
                                        <button
                                            type='button'
                                            disabled={busy}
                                            onClick={() =>
                                                void hostAction(
                                                    room.status === 'playing'
                                                        ? roomApi.advance
                                                        : roomApi.start
                                                )
                                            }
                                            className='mt-2 shrink-0 cursor-pointer rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 dark:bg-white dark:text-zinc-900'
                                        >
                                            {room.status === 'playing'
                                                ? 'End round'
                                                : 'Next round'}
                                        </button>
                                    )}
                                    {isHost && room.status === 'playing' && (
                                        <p className='mt-1 text-center text-xs text-gray-500 dark:text-zinc-500'>
                                            Ending the round marks anyone still
                                            guessing as lost.
                                        </p>
                                    )}
                                </div>
                            )}
                            {actionError && (
                                <p
                                    className='mt-2 text-center text-sm font-medium text-red-600'
                                    role='alert'
                                >
                                    {actionError}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
            {confettiKey > 0 && windowSize.width > 0 && (
                <div className='pointer-events-none fixed inset-0 z-[9999]'>
                    <Confetti
                        key={confettiKey}
                        width={windowSize.width}
                        height={windowSize.height}
                        recycle={false}
                        numberOfPieces={200}
                        gravity={0.3}
                    />
                </div>
            )}
        </div>
    )
}

function Lobby({
    room,
    isHost,
    busy,
    copied,
    onCopy,
    onStart,
}: {
    room: RoomSnapshot
    isHost: boolean
    busy: boolean
    copied: boolean
    onCopy: () => void
    onStart: () => void
}) {
    if (room.status === 'closed') {
        return (
            <p className='m-auto text-center font-semibold'>
                This room is closed.
            </p>
        )
    }
    return (
        <div className='m-auto w-full max-w-sm text-center'>
            <p className='text-sm text-gray-500 dark:text-zinc-400'>
                Room code
            </p>
            <p className='mt-1 text-sm font-bold break-all'>{room.code}</p>
            <button
                type='button'
                onClick={onCopy}
                className='mt-3 cursor-pointer rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold dark:border-zinc-600'
            >
                {copied ? 'Copied' : 'Copy link'}
            </button>
            <p className='mt-4 text-sm text-gray-600 dark:text-zinc-400'>
                {isHost
                    ? 'Start when everyone is here. A green dot means they have the room open.'
                    : 'Waiting for the host to start.'}
            </p>
            {isHost && (
                <button
                    type='button'
                    disabled={busy}
                    onClick={onStart}
                    className='mt-4 cursor-pointer rounded-full bg-pink-600 px-5 py-2 font-semibold text-white hover:bg-pink-700 disabled:opacity-70'
                >
                    Start round
                </button>
            )}
        </div>
    )
}

function RoundBanner({
    room,
    won,
    lost,
    guess,
    notInList,
    animating,
    lastIncorrect,
    currentGuess,
    showInput,
    inputMode,
    busy,
    onSubmit,
    onKey,
}: {
    room: RoomSnapshot
    won: boolean
    lost: boolean
    guess: string
    notInList: boolean
    animating: boolean
    lastIncorrect: string
    currentGuess: string
    showInput: boolean
    inputMode: 'keyboard' | 'text'
    busy: boolean
    onSubmit: (guess: string) => void
    onKey: (key: string) => void
}) {
    const { colorblind } = useColorblind()
    const palette = feedbackPalette(colorblind)
    const revealed = room.answer

    if (revealed) {
        return (
            <div
                className={`mb-3 flex shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-center font-bold text-white ${
                    won ? palette.bannerCorrect : palette.bannerWrong
                }`}
            >
                <FeedbackIcon
                    mark={won ? 'correct' : 'wrong'}
                    className='h-5 w-5 shrink-0'
                />
                <span>
                    {revealed}
                    {room.idol?.group_name ? ` · ${room.idol.group_name}` : ''}
                </span>
            </div>
        )
    }

    if (won) {
        return (
            <div
                className={`mb-3 flex shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-center font-bold text-white ${palette.bannerCorrect}`}
            >
                <FeedbackIcon mark='correct' className='h-5 w-5 shrink-0' />
                <span>{guess}</span>
            </div>
        )
    }

    if (lost) {
        return (
            <div
                className={`mb-3 flex shrink-0 items-center justify-center rounded-md px-4 py-2 text-white ${palette.bannerWrong}`}
                style={{ minHeight: '3rem' }}
            >
                <FeedbackIcon mark='wrong' className='h-5 w-5' />
            </div>
        )
    }

    if (!showInput) return null

    if (inputMode === 'text') {
        return (
            <div className='shrink-0 pb-1'>
                <IdolTextInput
                    onSubmit={onSubmit}
                    disabled={!showInput}
                    busy={busy || animating}
                    isAnimating={animating}
                    notInList={notInList}
                />
            </div>
        )
    }

    return (
        <>
            <GuessInput
                currentGuess={currentGuess}
                gameWon={false}
                gameLost={false}
                lastIncorrectGuess={lastIncorrect}
                isAnimating={animating}
                notInList={notInList}
            />
            <OnScreenKeyboard onKeyPress={onKey} className='shrink-0 pb-1' />
        </>
    )
}
