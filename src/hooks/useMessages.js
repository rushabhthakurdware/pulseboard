import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMessages(workspaceId) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({}) // id -> profile cache

  const fetchProfile = async (id) => {
    const { data } = await supabase
      .from('profiles').select('id, full_name, avatar_url').eq('id', id).single()
    if (data) setProfiles((p) => ({ ...p, [id]: data }))
  }

  useEffect(() => {
    if (!workspaceId) return

    // 1. load history (with author profile joined)
    supabase
      .from('messages')
      .select('id, content, created_at, user_id, profiles(id, full_name, avatar_url)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!data) return
        setMessages(data)
        const map = {}
        data.forEach((m) => { if (m.profiles) map[m.user_id] = m.profiles })
        setProfiles(map)
      })

    // 2. subscribe to new / deleted messages
    const channel = supabase
      .channel(`messages:${workspaceId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          )
          fetchProfile(payload.new.user_id)
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  const sendMessage = async (content) => {
    const { error } = await supabase.from('messages').insert({ workspace_id: workspaceId, content })
    if (error) console.error(error)
  }

  return { messages, profiles, sendMessage }
}