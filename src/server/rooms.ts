import 'server-only'
import catalog from '@/server/roomIdols.json'
import { withTx, type Sql } from '@/lib/db'
import type {
    RoomIdol,
    RoomPlayer,
    RoomSnapshot,
    RoomStatus,
    VisualRoomSettings,
} from '@/lib/multiplayer'
import { INFINITE_GEN_VALUES } from '@/utils/genFilter'

type CatalogIdol = {
    id: number
    name: string
    group_name: string
    group_category: string
    base64_group: string
    img_bucket: string
    group_type: string
}

const idols = catalog as CatalogIdol[]

export class RoomError extends Error {
    constructor(code: string) {
        super(code)
        this.name = 'RoomError'
    }
}

type RoomRow = {
    id: string
    code: string
    host_id: string
    mode: string
    settings: VisualRoomSettings
    status: RoomStatus
    round_index: number
    revision: number
    expires_at: string | Date
    idol_id: number | null
    idol_name: string | null
    idol_group_name: string | null
    idol_clue: RoomIdol | null
    used_ids: number[]
}

type MemberRow = {
    user_id: string
    display_name: string
    joined_at: string | Date
    last_seen_at: string | Date
    status: 'in_progress' | 'won' | 'lost'
    guesses: string[]
    wins: number
}

function nameKey(value: string | null | undefined): string | null {
    if (!value) return null
    const cleaned = value.toUpperCase().trim().replace(/\s+/g, ' ')
    return cleaned.length > 0 ? cleaned : null
}

function namesMatch(guess: string, candidate: string | null | undefined): boolean {
    const key = nameKey(guess)
    if (!key || !candidate) return false
    if (nameKey(candidate) === key) return true
    return candidate.split(/[,/|;]/).some((piece) => nameKey(piece) === key)
}

function knownName(guess: string): boolean {
    return idols.some((idol) => namesMatch(guess, idol.name))
}

function maxGuesses(difficulty: string): number {
    return difficulty === 'challenger' ? 3 : 6
}

export function sanitizeName(value: unknown): string {
    const cleaned = String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24)
    return cleaned.length > 0 ? cleaned : 'Guest'
}

function asSettings(value: unknown): VisualRoomSettings {
    if (!value || typeof value !== 'object') throw new RoomError('invalid_settings')
    const row = value as Record<string, unknown>
    const difficulty = row.difficulty
    const imageMode = row.image_mode
    const group = row.group_filter
    if (
        difficulty !== 'easy' &&
        difficulty !== 'normal' &&
        difficulty !== 'hard' &&
        difficulty !== 'challenger'
    ) {
        throw new RoomError('invalid_settings')
    }
    if (imageMode !== 'pixelated' && imageMode !== 'zoom') {
        throw new RoomError('invalid_settings')
    }
    if (group !== 'boy-group' && group !== 'girl-group' && group !== 'both') {
        throw new RoomError('invalid_settings')
    }
    let gens: number[] | null = null
    if (Array.isArray(row.gen_filter)) {
        const picked = [...new Set(row.gen_filter.filter((gen): gen is number => typeof gen === 'number'))]
        if (picked.length === 0 || picked.some((gen) => !INFINITE_GEN_VALUES.includes(gen as 2 | 3 | 4 | 5))) {
            throw new RoomError('invalid_settings')
        }
        const all = INFINITE_GEN_VALUES.every((gen) => picked.includes(gen))
        gens = all ? null : picked.sort((a, b) => a - b)
    }
    return {
        difficulty,
        image_mode: imageMode,
        group_filter: group,
        gen_filter: gens,
    }
}

function stamp(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function fresh(value: string | Date): boolean {
    return Date.now() - new Date(value).getTime() < 30_000
}

function jsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[]
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as unknown
            return Array.isArray(parsed) ? (parsed as T[]) : []
        } catch {
            return []
        }
    }
    return []
}

function snapshot(room: RoomRow, members: MemberRow[], viewer: string): RoomSnapshot {
    const playing = room.status === 'playing'
    const reveal =
        (room.status === 'between_rounds' || room.status === 'closed') &&
        typeof room.idol_name === 'string' &&
        room.idol_name.length > 0
    const players: RoomPlayer[] = [...members]
        .sort((a, b) => {
            if (a.user_id === room.host_id) return -1
            if (b.user_id === room.host_id) return 1
            return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        })
        .map((member) => ({
            user_id: member.user_id,
            display_name: member.display_name,
            ...(room.round_index > 0 ? { status: member.status } : {}),
            wins: member.wins,
            here: fresh(member.last_seen_at),
            ...(!playing || member.user_id === viewer
                ? { guesses: jsonArray<string>(member.guesses) }
                : {}),
        }))
    const idol = room.idol_clue
        ? {
              ...room.idol_clue,
              ...(reveal && room.idol_group_name ? { group_name: room.idol_group_name } : {}),
          }
        : null
    return {
        code: room.code,
        room_id: room.id,
        revision: room.revision,
        mode: 'visual',
        settings: room.settings,
        status: room.status,
        round_index: room.round_index,
        expires_at: stamp(room.expires_at),
        host_id: room.host_id,
        idol,
        answer: reveal ? room.idol_name : null,
        you: viewer,
        players,
    }
}

async function lockRoom(query: Sql, code: string): Promise<RoomRow> {
    const rows = await query<RoomRow>(
        'select * from rooms where code = $1 for update',
        [code.trim().toLowerCase()]
    )
    const room = rows[0]
    if (!room) throw new RoomError('room_not_found')
    room.used_ids = jsonArray<number>(room.used_ids)
    room.settings = room.settings as VisualRoomSettings
    return room
}

async function membersOf(query: Sql, roomId: string): Promise<MemberRow[]> {
    const rows = await query<MemberRow>(
        'select * from room_members where room_id = $1 order by joined_at',
        [roomId]
    )
    return rows.map((row) => ({ ...row, guesses: jsonArray<string>(row.guesses) }))
}

async function requireMember(query: Sql, roomId: string, userId: string): Promise<MemberRow> {
    const rows = await query<MemberRow>(
        'select * from room_members where room_id = $1 and user_id = $2 for update',
        [roomId, userId]
    )
    const member = rows[0]
    if (!member) throw new RoomError('not_a_member')
    member.guesses = jsonArray<string>(member.guesses)
    return member
}

async function bump(query: Sql, room: RoomRow): Promise<void> {
    const rows = await query<{ revision: number }>(
        'update rooms set revision = revision + 1 where id = $1 returning revision',
        [room.id]
    )
    room.revision = rows[0]?.revision ?? room.revision + 1
}

function pickIdol(settings: VisualRoomSettings, used: number[]): CatalogIdol | null {
    const pool = idols.filter((idol) => {
        if (used.includes(idol.id)) return false
        if (!idol.name || !idol.img_bucket || !idol.group_category || !idol.base64_group) return false
        if (settings.group_filter !== 'both' && idol.group_category !== settings.group_filter) return false
        return true
    })
    if (pool.length === 0) return null
    return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function maybeFinish(query: Sql, room: RoomRow, members: MemberRow[]): Promise<boolean> {
    if (room.status !== 'playing') return false
    const present = members.filter((member) => fresh(member.last_seen_at))
    if (present.length === 0) return false
    if (present.some((member) => member.status === 'in_progress')) return false
    await query('update rooms set status = $2 where id = $1', [room.id, 'between_rounds'])
    room.status = 'between_rounds'
    await bump(query, room)
    return true
}

export async function createRoom(
    userId: string,
    displayName: string,
    settingsInput: unknown
): Promise<RoomSnapshot> {
    const settings = asSettings(settingsInput)
    const id = crypto.randomUUID()
    const code = crypto.randomUUID()
    return withTx(async (query) => {
        await query(
            `insert into rooms (id, code, host_id, mode, settings, status, expires_at)
             values ($1, $2, $3, 'visual', $4::jsonb, 'lobby', now() + interval '24 hours')`,
            [id, code, userId, JSON.stringify(settings)]
        )
        await query(
            `insert into room_members (room_id, user_id, display_name) values ($1, $2, $3)`,
            [id, userId, displayName]
        )
        const room = await lockRoom(query, code)
        await bump(query, room)
        return snapshot(room, await membersOf(query, room.id), userId)
    })
}

export async function enterOrJoin(
    code: string,
    userId: string,
    displayName: string
): Promise<RoomSnapshot> {
    return withTx(async (query) => {
        const room = await lockRoom(query, code)
        const existing = await query<MemberRow>(
            'select * from room_members where room_id = $1 and user_id = $2',
            [room.id, userId]
        )
        if (existing[0]) {
            await query(
                'update room_members set display_name = $3, last_seen_at = now() where room_id = $1 and user_id = $2',
                [room.id, userId, displayName]
            )
            return snapshot(room, await membersOf(query, room.id), userId)
        }
        if (new Date(room.expires_at).getTime() <= Date.now()) throw new RoomError('room_expired')
        if (room.status === 'closed') throw new RoomError('room_closed')
        if (room.status !== 'lobby' && room.status !== 'playing') throw new RoomError('room_not_joinable')
        const count = await query<{ count: string }>('select count(*)::text as count from room_members where room_id = $1', [
            room.id,
        ])
        if (Number(count[0]?.count ?? 0) >= 8) throw new RoomError('room_full')
        await query(
            'insert into room_members (room_id, user_id, display_name) values ($1, $2, $3)',
            [room.id, userId, displayName]
        )
        await bump(query, room)
        return snapshot(room, await membersOf(query, room.id), userId)
    })
}

export async function getRoom(code: string, userId: string, displayName: string): Promise<RoomSnapshot> {
    return withTx(async (query) => {
        const room = await lockRoom(query, code)
        await requireMember(query, room.id, userId)
        await query(
            'update room_members set display_name = $3, last_seen_at = now() where room_id = $1 and user_id = $2',
            [room.id, userId, displayName]
        )
        let members = await membersOf(query, room.id)
        const finished = await maybeFinish(query, room, members)
        if (finished) members = await membersOf(query, room.id)
        return snapshot(room, members, userId)
    })
}

export async function leaveRoom(code: string, userId: string): Promise<void> {
    await withTx(async (query) => {
        const room = await lockRoom(query, code)
        const member = await query(
            'select user_id from room_members where room_id = $1 and user_id = $2',
            [room.id, userId]
        )
        if (!member[0]) return
        await query('delete from room_members where room_id = $1 and user_id = $2', [room.id, userId])
        if (room.host_id === userId) {
            const next = await query<{ user_id: string }>(
                'select user_id from room_members where room_id = $1 order by joined_at limit 1',
                [room.id]
            )
            if (!next[0]) {
                await query('update rooms set status = $2 where id = $1', [room.id, 'closed'])
                room.status = 'closed'
            } else {
                await query('update rooms set host_id = $2 where id = $1', [room.id, next[0].user_id])
                room.host_id = next[0].user_id
            }
        }
        if (room.status !== 'closed') {
            const members = await membersOf(query, room.id)
            const finished = await maybeFinish(query, room, members)
            if (!finished) await bump(query, room)
        } else {
            await bump(query, room)
        }
    })
}

export async function startRound(code: string, userId: string): Promise<RoomSnapshot> {
    return withTx(async (query) => {
        const room = await lockRoom(query, code)
        await requireMember(query, room.id, userId)
        if (room.host_id !== userId) throw new RoomError('not_host')
        if (new Date(room.expires_at).getTime() <= Date.now()) throw new RoomError('room_expired')
        if (room.status === 'closed') throw new RoomError('room_closed')
        if (room.status !== 'lobby' && room.status !== 'between_rounds') {
            throw new RoomError('not_between_rounds')
        }
        const idol = pickIdol(room.settings, room.used_ids)
        if (!idol) throw new RoomError('not_enough_idols')
        const clue: RoomIdol = {
            img_bucket: idol.img_bucket,
            group_category: idol.group_category,
            base64_group: idol.base64_group,
            group_type: idol.group_type || idol.group_category,
            zoom_x: null,
            zoom_y: null,
        }
        await query(
            `update rooms
             set status = 'playing',
                 round_index = round_index + 1,
                 idol_id = $2,
                 idol_name = $3,
                 idol_group_name = $4,
                 idol_clue = $5::jsonb,
                 used_ids = $6::jsonb
             where id = $1`,
            [
                room.id,
                idol.id,
                idol.name,
                idol.group_name,
                JSON.stringify(clue),
                JSON.stringify([...room.used_ids, idol.id]),
            ]
        )
        await query(
            `update room_members set status = 'in_progress', guesses = '[]'::jsonb where room_id = $1`,
            [room.id]
        )
        const next = await lockRoom(query, room.code)
        await bump(query, next)
        return snapshot(next, await membersOf(query, next.id), userId)
    })
}

export async function submitGuess(
    code: string,
    userId: string,
    guessInput: string
): Promise<RoomSnapshot> {
    const guess = nameKey(guessInput)
    if (!guess || guess.length > 40) throw new RoomError('invalid_guess')
    return withTx(async (query) => {
        const room = await lockRoom(query, code)
        const member = await requireMember(query, room.id, userId)
        if (new Date(room.expires_at).getTime() <= Date.now()) throw new RoomError('room_expired')
        if (room.status === 'closed') throw new RoomError('room_closed')
        if (room.status !== 'playing') throw new RoomError('not_playing')
        await query(
            'update room_members set last_seen_at = now() where room_id = $1 and user_id = $2',
            [room.id, userId]
        )
        if (member.status !== 'in_progress' || member.guesses.includes(guess)) {
            return snapshot(room, await membersOf(query, room.id), userId)
        }
        if (!knownName(guess) && !namesMatch(guess, room.idol_name)) {
            throw new RoomError('not_in_list')
        }
        const correct = namesMatch(guess, room.idol_name)
        const nextGuesses = [...member.guesses, guess]
        const status = correct
            ? 'won'
            : nextGuesses.length >= maxGuesses(room.settings.difficulty)
              ? 'lost'
              : 'in_progress'
        await query(
            `update room_members
             set guesses = $3::jsonb, status = $4, wins = wins + $5
             where room_id = $1 and user_id = $2`,
            [room.id, userId, JSON.stringify(nextGuesses), status, status === 'won' ? 1 : 0]
        )
        let members = await membersOf(query, room.id)
        if (status !== 'in_progress') {
            const finished = await maybeFinish(query, room, members)
            if (!finished) await bump(query, room)
            if (finished) members = await membersOf(query, room.id)
        }
        return snapshot(room, members, userId)
    })
}

export async function advanceRound(code: string, userId: string): Promise<RoomSnapshot> {
    return withTx(async (query) => {
        const room = await lockRoom(query, code)
        await requireMember(query, room.id, userId)
        if (room.host_id !== userId) throw new RoomError('not_host')
        if (room.status === 'closed') throw new RoomError('room_closed')
        if (room.status !== 'playing') throw new RoomError('not_playing')
        await query(
            `update room_members set status = 'lost' where room_id = $1 and status = 'in_progress'`,
            [room.id]
        )
        await query('update rooms set status = $2 where id = $1', [room.id, 'between_rounds'])
        room.status = 'between_rounds'
        await bump(query, room)
        return snapshot(room, await membersOf(query, room.id), userId)
    })
}
