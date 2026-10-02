import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePresence(workspaceId) {
  const { user } = useAuth()
  const [online, setOnline] = useState([])
  const [typing, setTyping] = useState({}) // userId -> name
  const channelRef = useRef(null)
  const timers = useRef({})

  const name = user.user_metadata?.full_name ?? user.email.split('@')[0]

  useEffect(() => {
    const channel = supabase.channel(`room:${workspaceId}`, {
        config: { private: true, presence: { key: user.id } },
    })

    channel
      // PRESENCE: fires whenever anyone joins/leaves
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnline(Object.entries(state).map(([id, metas]) => ({ id, name: metas[0].name })))
      })
      // BROADCAST: typing events from other users
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === user.id) return
        setTyping((t) => ({ ...t, [payload.userId]: payload.name }))

        clearTimeout(timers.current[payload.userId])
        timers.current[payload.userId] = setTimeout(() => {
          setTyping((t) => {
            const copy = { ...t }
            delete copy[payload.userId]
            return copy
          })
        }, 2000) // hide after 2s of no typing
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name, online_at: new Date().toISOString() })
        }
      })

    channelRef.current = channel
    return () => {
      Object.values(timers.current).forEach(clearTimeout)
      supabase.removeChannel(channel)
    }
  }, [workspaceId, user.id])

  const sendTyping = () =>
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, name },
    })

  return { online, typingNames: Object.values(typing), sendTyping }
}