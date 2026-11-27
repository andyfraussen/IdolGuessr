import {
    INFINITE_GEN_VALUES,
    isValidInfiniteGenFilter,
} from '@/utils/genFilter'
import {
    isImageMode,
    isInfiniteDifficulty,
    type ImageMode,
    type InfiniteDifficulty,
} from '@/utils/difficulty'

export type RoomMode = 'visual'
export type RoomStatus = 'lobby' | 'playing' | 'between_rounds' | 'closed'
export type PlayerStatus = 'in_progress' | 'won' | 'lost'
export type GroupFilter = 'boy-group' | 'girl-group' | 'both'

export interface VisualRoomSettings {
    difficulty: InfiniteDifficulty
    image_mode: ImageMode
    group_filter: GroupFilter
    gen_filter: number[] | null
}

export interface RoomIdol {
    img_bucket: string
    group_category: string
    base64_group: string
    group_type: string
    zoom_x: number | null
    zoom_y: number | null
    group_name?: string
}

export interface RoomPlayer {
    user_id: string
    display_name: string
    status?: PlayerStatus
    wins: number
    here?: boolean
    guesses?: string[]
}

export interface RoomSnapshot {
    code: string
    room_id: string
    revision: number
    mode: RoomMode
    settings: VisualRoomSettings
    status: RoomStatus
    round_index: number
    expires_at: string
    host_id: string
    idol: RoomIdol | null
    answer: string | null
    you: string
    players: RoomPlayer[]
}

const ROOM_ERRORS = [
    'not_authenticated',
    'room_not_found',
    'room_expired',
    'room_closed',
    'room_full',
    'room_not_joinable',
    'not_a_member',
    'not_host',
    'not_playing',
    'not_between_rounds',
    'not_enough_idols',
    'not_in_list',
    'invalid_settings',
    'invalid_guess',
    'mode_not_available',
    'request_failed',
] as const

export function roomErrorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return (
        ROOM_ERRORS.find((code) => message.includes(code)) ?? 'request_failed'
    )
}

export function roomErrorText(error: unknown): string {
    switch (roomErrorCode(error)) {
        case 'room_full':
            return 'This room is full.'
        case 'room_expired':
            return 'This room has expired.'
        case 'room_closed':
            return 'This room is closed.'
        case 'room_not_found':
            return 'No room uses that code.'
        case 'room_not_joinable':
            return 'This room is not taking new players.'
        case 'not_enough_idols':
            return 'Not enough idols for these filters.'
        case 'not_host':
            return 'Only the host can do that.'
        case 'not_playing':
            return 'The round is not in progress.'
        case 'not_between_rounds':
            return 'The round already started.'
        case 'invalid_settings':
            return 'Choose a difficulty, image style, and at least one generation.'
        case 'mode_not_available':
            return 'Only visual rooms are open right now.'
        case 'not_authenticated':
            return 'Could not start a guest session.'
        default:
            return 'Something went wrong. Try again.'
    }
}

export function normalizeRoomCode(value: string): string {
    const trimmed = value.trim()
    const fromLink = trimmed.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    )
    if (fromLink) return fromLink[1].toLowerCase()
    return trimmed.toLowerCase()
}

export function visualSettings(input: {
    difficulty: InfiniteDifficulty
    imageMode: ImageMode
    groupFilter: GroupFilter
    genFilter: number[]
}): VisualRoomSettings {
    const gens = isValidInfiniteGenFilter(input.genFilter)
        ? [...new Set(input.genFilter)].sort((a, b) => a - b)
        : [...INFINITE_GEN_VALUES]
    const includesAll = INFINITE_GEN_VALUES.every((gen) => gens.includes(gen))
    return {
        difficulty: input.difficulty,
        image_mode: input.imageMode,
        group_filter: input.groupFilter,
        gen_filter: includesAll ? null : gens,
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
}

function parseSettings(value: unknown): VisualRoomSettings {
    const row = isRecord(value) ? value : {}
    const gens = row.gen_filter
    return {
        difficulty: isInfiniteDifficulty(row.difficulty)
            ? row.difficulty
            : 'normal',
        image_mode: isImageMode(row.image_mode) ? row.image_mode : 'pixelated',
        group_filter:
            row.group_filter === 'boy-group' ||
            row.group_filter === 'girl-group' ||
            row.group_filter === 'both'
                ? row.group_filter
                : 'both',
        gen_filter: Array.isArray(gens)
            ? gens.filter((gen): gen is number => typeof gen === 'number')
            : null,
    }
}

function parseIdol(value: unknown): RoomIdol | null {
    if (!isRecord(value)) return null
    const bucket = text(value.img_bucket)
    const category = text(value.group_category)
    const base64 = text(value.base64_group)
    if (!bucket || !category || !base64) return null
    const zoom = (field: unknown) => (typeof field === 'number' ? field : null)
    const groupName = text(value.group_name)
    return {
        img_bucket: bucket,
        group_category: category,
        base64_group: base64,
        group_type: text(value.group_type) ?? '',
        zoom_x: zoom(value.zoom_x),
        zoom_y: zoom(value.zoom_y),
        ...(groupName ? { group_name: groupName } : {}),
    }
}

function parsePlayer(value: unknown): RoomPlayer | null {
    if (!isRecord(value) || typeof value.user_id !== 'string') return null
    const status = value.status
    return {
        user_id: value.user_id,
        display_name: text(value.display_name) ?? 'Guest',
        ...(status === 'in_progress' || status === 'won' || status === 'lost'
            ? { status }
            : {}),
        wins: typeof value.wins === 'number' ? value.wins : 0,
        ...(typeof value.here === 'boolean' ? { here: value.here } : {}),
        ...(Array.isArray(value.guesses)
            ? {
                  guesses: value.guesses.filter(
                      (guess): guess is string => typeof guess === 'string'
                  ),
              }
            : {}),
    }
}

export function parseRoom(value: unknown): RoomSnapshot {
    const data = typeof value === 'string' ? safeJson(value) : value
    if (!isRecord(data)) throw new Error('request_failed')
    const status = data.status
    if (
        status !== 'lobby' &&
        status !== 'playing' &&
        status !== 'between_rounds' &&
        status !== 'closed'
    ) {
        throw new Error('request_failed')
    }
    const code = text(data.code)
    const roomId = text(data.room_id)
    const hostId = text(data.host_id)
    const you = text(data.you)
    if (!code || !roomId || !hostId || !you) throw new Error('request_failed')
    return {
        code,
        room_id: roomId,
        revision: typeof data.revision === 'number' ? data.revision : 0,
        mode: 'visual',
        settings: parseSettings(data.settings),
        status,
        round_index:
            typeof data.round_index === 'number' ? data.round_index : 0,
        expires_at: text(data.expires_at) ?? '',
        host_id: hostId,
        idol: parseIdol(data.idol),
        answer: text(data.answer),
        you,
        players: Array.isArray(data.players)
            ? data.players.flatMap((player) => {
                  const parsed = parsePlayer(player)
                  return parsed ? [parsed] : []
              })
            : [],
    }
}

function safeJson(value: string): unknown {
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

async function callRoom(
    path: string,
    init?: { method?: string; body?: unknown }
): Promise<unknown> {
    const response = await fetch(path, {
        method: init?.method ?? 'GET',
        headers: init?.body ? { 'content-type': 'application/json' } : undefined,
        body: init?.body ? JSON.stringify(init.body) : undefined,
    })
    const payload = (await response.json().catch(() => null)) as {
        error?: string
    } | null
    if (!response.ok) {
        const code = payload?.error
        if (!code || !ROOM_ERRORS.includes(code as (typeof ROOM_ERRORS)[number])) {
            console.error(path, payload)
        }
        throw new Error(
            code && ROOM_ERRORS.includes(code as (typeof ROOM_ERRORS)[number])
                ? code
                : 'request_failed'
        )
    }
    return payload
}

export async function createRoom(
    settings: VisualRoomSettings,
    displayName?: string
): Promise<string> {
    const data = parseRoom(
        await callRoom('/api/multiplayer', {
            method: 'POST',
            body: { settings, displayName },
        })
    )
    return data.code
}

export async function joinRoom(code: string): Promise<RoomSnapshot> {
    return parseRoom(
        await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}/join`, {
            method: 'POST',
            body: {},
        })
    )
}

export async function leaveRoom(code: string): Promise<void> {
    await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}/leave`, {
        method: 'POST',
        body: {},
    })
}

export async function startRound(code: string): Promise<RoomSnapshot> {
    return parseRoom(
        await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}/start`, {
            method: 'POST',
            body: {},
        })
    )
}

export async function advanceRound(code: string): Promise<RoomSnapshot> {
    return parseRoom(
        await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}/advance`, {
            method: 'POST',
            body: {},
        })
    )
}

export async function submitRoomGuess(
    code: string,
    guess: string
): Promise<RoomSnapshot> {
    return parseRoom(
        await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}/guess`, {
            method: 'POST',
            body: { guess },
        })
    )
}

export async function getRoom(code: string): Promise<RoomSnapshot> {
    return parseRoom(
        await callRoom(`/api/multiplayer/${normalizeRoomCode(code)}`)
    )
}

export async function enterRoom(code: string): Promise<RoomSnapshot> {
    const normalized = normalizeRoomCode(code)
    try {
        return await getRoom(normalized)
    } catch (error) {
        if (roomErrorCode(error) !== 'not_a_member') throw error
        return joinRoom(normalized)
    }
}
