import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const path = request.nextUrl.pathname
  console.log('--> Middleware intercepting path:', path)

  // Allow static files, favicons, API auth endpoints, etc.
  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/api/auth')
  ) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null

  try {
    // 3-second timeout for Supabase connection
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase Auth Timeout')), 3000)
    )

    const fetchPromise = supabase.auth.getUser()
    const result = await Promise.race([fetchPromise, timeoutPromise])

    if (result && result.data) {
      user = result.data.user
    }
  } catch (error) {
    console.warn('--> Supabase Auth check failed or timed out:', error)
    // Fallback logic for offline/network issues:
    // If they have a Supabase authentication cookie, allow them through.
    const allCookies = request.cookies.getAll()
    const hasSbCookie = allCookies.some(c => c.name.startsWith('sb-'))
    if (hasSbCookie) {
      console.log('--> sb- cookie found. Allowing bypass fallback.')
      // Assume active user to pass middleware check
      user = { email: 'user@example.com' } as any
    }
  }

  const isLoginPage = path === '/login'

  if (!user) {
    // If not logged in and not on login page, redirect to login
    if (!isLoginPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } else {
    // If logged in and trying to access login page, redirect to dashboard
    if (isLoginPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images/manifest/etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
