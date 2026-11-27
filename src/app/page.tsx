import { redirect } from 'next/navigation'
import DailyClient from './daily-client'
import { loadCurrentDaily } from '@/lib/game/actions'
import { supabaseConfigured } from '@/lib/supabase/env'

export default async function Home() {
    if (!supabaseConfigured()) redirect('/multiplayer')
    const initialDaily = await loadCurrentDaily()
    return <DailyClient initialDaily={initialDaily} />
}
