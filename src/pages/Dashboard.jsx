import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AvatarUpload from '../components/AvatarUpload'

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const loadWorkspaces = async () => {
    // RLS automatically returns only workspaces you're a member of
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, invite_code')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setWorkspaces(data)
  }

  useEffect(() => { loadWorkspaces() }, [])

  const createWorkspace = async (e) => {
    e.preventDefault()
    setError('')
    const { data: id, error } = await supabase.rpc('create_workspace', { ws_name: name })
    if (error) return setError(error.message)
    setName('')
    navigate(`/workspace/${id}`)
  }

  const joinWorkspace = async (e) => {
    e.preventDefault()
    setError('')
    const { data: id, error } = await supabase.rpc('join_workspace', { code: code.trim() })
    if (error) return setError(error.message)
    setCode('')
    navigate(`/workspace/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold">PulseBoard</h1>
        <div className="flex items-center gap-4 text-sm">
              <AvatarUpload />

          <span>{user.email}</span>
          <button className="border px-3 py-1 rounded" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {error && <p className="text-red-600">{error}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          <form onSubmit={createWorkspace} className="bg-white p-4 rounded-xl shadow space-y-2">
            <h2 className="font-semibold">Create workspace</h2>
            <input className="w-full border p-2 rounded" placeholder="Workspace name"
              value={name} onChange={(e) => setName(e.target.value)} required />
            <button className="bg-black text-white px-4 py-2 rounded">Create</button>
          </form>

          <form onSubmit={joinWorkspace} className="bg-white p-4 rounded-xl shadow space-y-2">
            <h2 className="font-semibold">Join with invite code</h2>
            <input className="w-full border p-2 rounded" placeholder="Invite code"
              value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="border px-4 py-2 rounded">Join</button>
          </form>
          
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
            
          <h2 className="font-semibold mb-3">Your workspaces</h2>
          {workspaces.length === 0 && <p className="text-gray-500 text-sm">None yet. Create one above.</p>}
          <ul className="space-y-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link to={`/workspace/${w.id}`}
                  className="flex justify-between border p-3 rounded hover:bg-gray-50">
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-gray-500">code: {w.invite_code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
      </div>
    </div>
  )
}