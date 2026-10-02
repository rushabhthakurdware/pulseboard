import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Avatarupload() {
  const { user } = useAuth()
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => setUrl(data?.avatar_url ?? null))
  }, [user.id])

  const onPick = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBusy(true)

    const path = `${user.id}/avatar`
    const { error } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { setBusy(false); return alert(error.message) }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${data.publicUrl}?t=${Date.now()}` // bust the browser cache
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setUrl(publicUrl)
    setBusy(false)
  }

  return (
    <label className="cursor-pointer" title="Change avatar">
      <input type="file" accept="image/*" className="hidden" onChange={onPick} />
      {url
        ? <img src={url} className={`h-8 w-8 rounded-full object-cover ${busy ? 'opacity-50' : ''}`} />
        : <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-xs">
            {busy ? '...' : '+'}
          </div>}
    </label>
  )
}