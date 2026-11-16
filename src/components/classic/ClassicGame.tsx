'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import ColorLegend from '@/components/classic/ColorLegend'
import GuessGrid from '@/components/classic/GuessGrid'
import ClassicFilterModal from '@/components/classic/ClassicFilterModal'
import ClassicWinModal from '@/components/classic/ClassicWinModal'
import IdolSearchInput from '@/components/classic/IdolSearchInput'
import GameHeader from '@/components/game/GameHeader'
import AccountModal from '@/components/modals/AccountModal'
import FeedbackModal from '@/components/modals/FeedbackModal'
import HelpModal from '@/components/modals/HelpModal'
import InfoModal from '@/components/modals/InfoModal'
import {
    getClassicPool,
    giveUpClassic,
    loadClassicDaily,
    startClassicRound,
    submitClassic,
    type ClassicCandidate,
    type ClassicGame as ClassicState,
    type ClassicGroup,
    type ClassicMode,
} from '@/lib/classic'
import { getClassicGame, subscribePlayer } from '@/lib/player'

function friendly(error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    if (message.includes('already_guessed')) return 'You already guessed that idol'
    if (message.includes('no_idol')) return 'No idols match this filter yet'
    if (message.includes('no_active_game')) return 'This round is already finished'
    if (message.includes('round_in_progress')) return 'Finish this idol before starting another'
    return message
}

function formatCountdown(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':')
}

function filterLabel(group: ClassicGroup) {
    if (group === 'girl-group') return 'Girl groups'
    if (group === 'boy-group') return 'Boy groups'
    return 'All groups'
}

export default function ClassicGame({ mode }: { mode: ClassicMode }) {
    const router = useRouter()
    const [game, setGame] = useState<ClassicState | null>(null)
    const [pool, setPool] = useState<ClassicCandidate[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [newestId, setNewestId] = useState<number | null>(null)
    const [endAt, setEndAt] = useState<string | null>(null)
    const [serverOffset, setServerOffset] = useState(0)
    const [now, setNow] = useState(() => Date.now())
    const [resultOpen, setResultOpen] = useState(true)
    const [confirmGiveUp, setConfirmGiveUp] = useState(false)
    const [filterOpen, setFilterOpen] = useState(false)
    const [showAccount, setShowAccount] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const [showFeedback, setShowFeedback] = useState(false)
    const rolled = useRef(false)
    const busyRef = useRef(false)

    useEffect(() => {
        const sync = () => setGame(getClassicGame(mode))
        sync()
        return subscribePlayer(sync)
    }, [mode])

    useEffect(() => {
        let cancel = false
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const idols = await getClassicPool()
                if (cancel) return
                setPool(idols)
                if (mode === 'daily') {
                    const daily = await loadClassicDaily()
                    if (cancel) return
                    setEndAt(daily.endAt)
                    setServerOffset(new Date(daily.serverNow).getTime() - Date.now())
                } else if (!getClassicGame('infinite')?.status) {
                    setFilterOpen(true)
                }
            } catch (err) {
                if (!cancel) setError(friendly(err))
            } finally {
                if (!cancel) setLoading(false)
            }
        }
        void load()
        return () => {
            cancel = true
        }
    }, [mode])

    useEffect(() => {
        if (mode !== 'daily' || !endAt) return
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [mode, endAt])

    const remaining = endAt ? new Date(endAt).getTime() - (now + serverOffset) : null

    useEffect(() => {
        if (mode !== 'daily' || remaining == null || remaining > 0 || rolled.current) return
        rolled.current = true
        void loadClassicDaily()
            .then((daily) => {
                const offset = new Date(daily.serverNow).getTime() - Date.now()
                setEndAt(daily.endAt)
                setServerOffset(offset)
                setResultOpen(true)
                rolled.current = new Date(daily.endAt).getTime() - (Date.now() + offset) <= 0
            })
            .catch((err) => setError(friendly(err)))
    }, [mode, remaining])

    const finished = game?.status === 'won' || game?.status === 'gave_up'
    const countdown = remaining == null ? null : formatCountdown(remaining)
    const suggestions = useMemo(() => {
        const filter = game?.groupFilter ?? 'both'
        if (filter === 'both') return pool
        return pool.filter((idol) => idol.groupCategory === filter)
    }, [pool, game?.groupFilter])

    const pick = async (idol: ClassicCandidate) => {
        if (busyRef.current || game?.status !== 'in_progress') return
        busyRef.current = true
        setBusy(true)
        setError('')
        try {
            await submitClassic(mode, idol.id)
            setNewestId(idol.id)
            setResultOpen(true)
        } catch (err) {
            setError(friendly(err))
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }

    const reveal = async () => {
        setBusy(true)
        setError('')
        try {
            await giveUpClassic()
            setConfirmGiveUp(false)
            setResultOpen(true)
        } catch (err) {
            setError(friendly(err))
        } finally {
            setBusy(false)
        }
    }

    const next = () => {
        setResultOpen(false)
        setFilterOpen(true)
    }

    const begin = async (group: ClassicGroup) => {
        if (busyRef.current || game?.status === 'in_progress') return
        busyRef.current = true
        setBusy(true)
        setError('')
        try {
            await startClassicRound(group)
            setNewestId(null)
            setConfirmGiveUp(false)
            setFilterOpen(false)
            setResultOpen(false)
        } catch (err) {
            setError(friendly(err))
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }

    const groupLabel = filterLabel(game?.groupFilter ?? 'both')

    return (
        <div className='min-h-screen bg-white dark:bg-zinc-950'>
            <div className='mx-auto w-full sm:max-w-md'>
            <GameHeader
                timer={mode === 'daily' && countdown ? countdown : ''}
                onShowAccount={() => setShowAccount(true)}
                onShowInfo={() => setShowInfo(true)}
                gameMode='classic'
                onGameModeChange={() => {}}
                showModeToggle={false}
                onLogoClick={() => router.push('/')}
            />
            </div>

            <div className='mx-auto w-full max-w-7xl px-4 pb-6'>
            <div className='mt-4 text-center'>
                {mode === 'infinite' &&
                    (game?.status === 'in_progress' ? (
                        <p className='mt-3 text-sm font-semibold text-gray-500 dark:text-zinc-400'>{groupLabel}</p>
                    ) : (
                        <button
                            type='button'
                            onClick={() => setFilterOpen(true)}
                            className='mt-3 cursor-pointer text-sm font-semibold text-gray-500 underline dark:text-zinc-400'
                        >
                            {groupLabel}
                        </button>
                    ))}
            </div>

            {loading ? (
                <p className='mt-10 text-center text-sm text-gray-500 dark:text-zinc-400'>Loading...</p>
            ) : (
                <>
                    <IdolSearchInput
                        pool={suggestions}
                        excludedIds={game?.guesses.map((guess) => guess.id) ?? []}
                        disabled={busy || game?.status !== 'in_progress'}
                        pending={busy && game?.status === 'in_progress'}
                        onPick={(idol) => void pick(idol)}
                    />
                    <ColorLegend />
                    {error && <p className='mt-3 text-center text-sm text-red-600'>{error}</p>}
                    <GuessGrid guesses={game?.guesses ?? []} newestId={newestId} />
                    {mode === 'infinite' && game?.status === 'in_progress' && (
                        <div className='mt-4 flex justify-center'>
                            {confirmGiveUp ? (
                                <div className='flex items-center gap-2 text-sm'>
                                    <span>Reveal the answer?</span>
                                    <button
                                        type='button'
                                        onClick={() => void reveal()}
                                        disabled={busy}
                                        className='cursor-pointer rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white'
                                    >
                                        Reveal
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setConfirmGiveUp(false)}
                                        className='cursor-pointer rounded-full bg-gray-200 px-3 py-1.5 dark:bg-zinc-800'
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type='button'
                                    onClick={() => setConfirmGiveUp(true)}
                                    className='cursor-pointer text-sm text-gray-500 underline dark:text-zinc-400'
                                >
                                    Give up
                                </button>
                            )}
                        </div>
                    )}
                    {finished && !resultOpen && (
                        <div className='mt-4 flex justify-center'>
                            <button
                                type='button'
                                onClick={() => setResultOpen(true)}
                                className='cursor-pointer rounded-full bg-pink-600 hover:bg-pink-700 font-bold px-4 py-2 text-white'
                            >
                                Result
                            </button>
                        </div>
                    )}
                </>
            )}
            </div>

            <ClassicWinModal
                open={!loading && finished && resultOpen}
                mode={mode}
                answer={game?.answer ?? null}
                guesses={game?.guesses ?? []}
                dailyId={game?.dailyId ?? null}
                onClose={() => setResultOpen(false)}
                onNext={() => void next()}
            />
            <AccountModal isOpen={showAccount} onClose={() => setShowAccount(false)} />
            <InfoModal
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                onShowFeedback={() => {
                    setShowInfo(false)
                    setShowFeedback(true)
                }}
                onShowHelp={() => {
                    setShowInfo(false)
                    setShowHelp(true)
                }}
                onShowHistory={() => {}}
                gameMode='unlimited'
            />
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                onBack={() => {
                    setShowHelp(false)
                    setShowInfo(true)
                }}
            />
            <FeedbackModal
                isOpen={showFeedback}
                onClose={() => setShowFeedback(false)}
                onBack={() => {
                    setShowFeedback(false)
                    setShowInfo(true)
                }}
            />
            {mode === 'infinite' && (
                <ClassicFilterModal
                    open={filterOpen && game?.status !== 'in_progress'}
                    value={game?.groupFilter ?? 'both'}
                    busy={busy}
                    onClose={
                        game?.status
                            ? () => {
                                  setFilterOpen(false)
                                  if (finished) setResultOpen(true)
                              }
                            : undefined
                    }
                    onStart={(group) => void begin(group)}
                />
            )}
        </div>
    )
}
