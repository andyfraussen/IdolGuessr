'use client'

import ClassicGame from '@/components/classic/ClassicGame'
import NeedsSupabase from '@/components/game/NeedsSupabase'
import { supabaseConfigured } from '@/lib/supabase/env'

export default function ClassicPage() {
    if (!supabaseConfigured()) return <NeedsSupabase mode='Classic' />
    return <ClassicGame mode='daily' />
}
