'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react' // 1. Added useState

export default function Login() {
  const router = useRouter()
  // 2. Create a state to hold the origin URL, default to empty string
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    // 3. Once mounted in the browser, set the origin safely
    setOrigin(window.location.origin)

    // Check if already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // 4. Ensure we don't render the Auth component until we have the origin
  //    (This prevents the redirect URL from being invalid during hydration)
  if (!origin) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8">Calendar App</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          // 5. Use the safe 'origin' state variable here
          redirectTo={`${origin}/dashboard`}
        />
      </div>
    </div>
  )
}
