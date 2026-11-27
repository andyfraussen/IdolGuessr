import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from './env'

export async function createServerSupabase() {
    if (!supabaseConfigured()) {
        const error = { message: 'supabase_unconfigured' }
        const settled = Promise.resolve({ data: null, error, count: null })
        const query = () => {
            const builder: Record<string, unknown> = {}
            const chain = () => builder
            for (const method of ['select', 'eq', 'lte', 'gte', 'order', 'limit', 'maybeSingle']) {
                builder[method] = chain
            }
            builder.then = (
                resolve: (value: unknown) => unknown,
                reject: (reason: unknown) => unknown
            ) => settled.then(resolve, reject)
            return builder
        }
        return {
            rpc: async () => ({ data: null, error }),
            from: query,
            auth: {
                getUser: async () => ({ data: { user: null }, error: null }),
                exchangeCodeForSession: async () => ({ data: { session: null }, error }),
                verifyOtp: async () => ({ data: {}, error }),
            },
        } as unknown as Awaited<ReturnType<typeof createServerClient>>
    }
    const cookieStore = await cookies()
    return createServerClient(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                    })
                } catch {
                    // Server Components cannot always write cookies. Middleware refreshes the session.
                }
            },
        },
    })
}
