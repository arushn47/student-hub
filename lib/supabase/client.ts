import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      // Bypass navigator.locks to prevent deadlocks in privacy-focused browsers like Brave
      lock: async (_name, _acquireTimeout, fn) => {
        return await fn()
      },
    },
  }
)

