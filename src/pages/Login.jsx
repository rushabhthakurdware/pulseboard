import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }, // picked up by our trigger
      })
      if (error) return setError(error.message)
      if (!data.session) setMsg('Check your email to confirm your account.')
      else navigate('/')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return setError(error.message)
      navigate('/')
    }
  }

  const signInWithGithub = () =>
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-96 space-y-4">
        <h1 className="text-2xl font-bold">PulseBoard</h1>

        {isSignUp && (
          <input className="w-full border p-2 rounded" placeholder="Full name"
            value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        )}
        <input className="w-full border p-2 rounded" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full border p-2 rounded" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {msg && <p className="text-green-600 text-sm">{msg}</p>}

        <button className="w-full bg-black text-white p-2 rounded">
          {isSignUp ? 'Sign up' : 'Log in'}
        </button>
        <button type="button" onClick={signInWithGithub}
          className="w-full border p-2 rounded">Continue with GitHub</button>

        <p className="text-sm text-center cursor-pointer text-blue-600"
          onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log in' : 'New here? Sign up'}
        </p>
      </form>
    </div>
  )
}