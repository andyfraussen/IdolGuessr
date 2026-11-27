'use client'

import UnshuffledGame from '@/components/unshuffled/UnshuffledGame'
import NeedsSupabase from '@/components/game/NeedsSupabase'
import { supabaseConfigured } from '@/lib/supabase/env'

export default function UnshuffledPage() {
    if (!supabaseConfigured()) return <NeedsSupabase mode='Unshuffled' />
    return <UnshuffledGame mode='daily' />
}
