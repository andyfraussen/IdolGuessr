'use client'

import Link from 'next/link'

export default function NeedsSupabase({ mode }: { mode: string }) {
    return (
        <div className='fixed inset-0 flex items-center justify-center bg-white px-6 text-center dark:bg-zinc-950'>
            <div className='max-w-md'>
                <h1 className='text-2xl font-bold'>{mode}</h1>
                <p className='mt-3 text-gray-600 dark:text-zinc-400'>
                    {mode} needs the Supabase connection before it can load a
                    puzzle. Live room is ready to play on this app.
                </p>
                <div className='mt-6 flex justify-center gap-3'>
                    <Link
                        href='/'
                        className='rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600'
                    >
                        Home
                    </Link>
                    <Link
                        href='/multiplayer'
                        className='rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white'
                    >
                        Live room
                    </Link>
                </div>
            </div>
        </div>
    )
}
