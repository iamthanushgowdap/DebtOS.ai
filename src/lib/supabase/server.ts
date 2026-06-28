import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export const createClient = async () => {
  // Check if there is a Bearer token in the Authorization header (mobile app)
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearerToken) {
    // Mobile client: use token-based auth, no cookies needed
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    )
  }

  // Browser client: use cookies
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Can be ignored if handled by middleware
          }
        },
      },
    }
  )
}
