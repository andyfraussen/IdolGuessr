import DailyClient from './daily-client'
import { loadCurrentDaily } from '@/lib/game/actions'
import { supabaseConfigured } from '@/lib/supabase/env'

export default async function Home() {
    if (!supabaseConfigured()) {
        return <DailyClient initialDaily={null} offline />
    }
    try {
        const initialDaily = await loadCurrentDaily()
        return <DailyClient initialDaily={initialDaily} />
    } catch {
        return <DailyClient initialDaily={null} offline />
    }
}
