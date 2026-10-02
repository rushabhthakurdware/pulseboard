import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export function useCall(workspaceId) {
  const { user } = useAuth()
  const myName = user.user_metadata?.full_name ?? user.email.split('@')[0]

  const [status, setStatus] = useState('idle') // idle | checking | waiting | inCall
  const [isHost, setIsHost] = useState(false)
  const [requests, setRequests] = useState([]) // [{ id, name }]
  const [localStream, setLocalStream] = useState(null)
  const [remotes, setRemotes] = useState({})
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error, setError] = useState('')

  const pcs = useRef({})
  const pending = useRef({})
  const channelRef = useRef(null)
  const streamRef = useRef(null)
  const statusRef = useRef('idle')     // refs so event handlers never see stale state
  const isHostRef = useRef(false)
  const hostId = useRef(null)
  const trusted = useRef(new Set())    // user ids allowed to take part in the call
  const waitTimer = useRef(null)

  const updateStatus = (s) => { statusRef.current = s; setStatus(s) }

  const broadcast = (event, payload) =>
    channelRef.current?.send({ type: 'broadcast', event, payload })

  const send = (to, data) => broadcast('signal', { from: user.id, to, ...data })

  const removePeer = (id) => {
    pcs.current[id]?.close()
    delete pcs.current[id]
    setRemotes((r) => { const c = { ...r }; delete c[id]; return c })
  }

  const createPeer = (peerId) => {
    const pc = new RTCPeerConnection(ICE)
    streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current))
    pc.onicecandidate = (e) => e.candidate && send(peerId, { candidate: e.candidate })
    pc.ontrack = (e) => setRemotes((r) => ({ ...r, [peerId]: e.streams[0] }))
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) removePeer(peerId)
    }
    pcs.current[peerId] = pc
    return pc
  }

  const flushCandidates = async (id) => {
    for (const c of pending.current[id] ?? []) await pcs.current[id].addIceCandidate(c)
    pending.current[id] = []
  }

  // ---------- leave / cleanup ----------
  const leave = async (message = '') => {
    const ch = channelRef.current
    if (ch) {
      try {
        if (statusRef.current === 'inCall' && isHostRef.current)
          await ch.send({ type: 'broadcast', event: 'end', payload: { from: user.id } })
        else if (statusRef.current === 'inCall')
          await ch.send({ type: 'broadcast', event: 'leave', payload: { from: user.id } })
        else if (statusRef.current === 'waiting')
          await ch.send({ type: 'broadcast', event: 'cancel', payload: { from: user.id } })
      } catch { /* ignore */ }
      supabase.removeChannel(ch)
    }
    clearTimeout(waitTimer.current)
    Object.keys(pcs.current).forEach(removePeer)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    channelRef.current = null
    streamRef.current = null
    hostId.current = null
    trusted.current = new Set()
    isHostRef.current = false
    setIsHost(false)
    setRequests([])
    setLocalStream(null)
    setRemotes({})
    setMuted(false)
    setCamOff(false)
    updateStatus('idle')
    if (message) setError(message)
  }

  // ---------- join (becomes host, or knocks) ----------
  const join = async () => {
    if (statusRef.current !== 'idle') return
    setError('')
    updateStatus('checking')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setLocalStream(stream)
    } catch {
      updateStatus('idle')
      return setError('Camera/microphone permission denied or unavailable')
    }

    const channel = supabase.channel(`call:${workspaceId}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: user.id } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        // if the host disappears (closed tab / lost connection), end for everyone
        if (isHostRef.current || !hostId.current) return
        if (!['waiting', 'inCall'].includes(statusRef.current)) return
        if (!channel.presenceState()[hostId.current]) leave('The host left the call')
      })

      // ---- host receives knocks ----
      .on('broadcast', { event: 'knock' }, ({ payload }) => {
        if (!isHostRef.current) return
        setRequests((r) =>
          r.some((x) => x.id === payload.from) ? r : [...r, { id: payload.from, name: payload.name }])
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }) =>
        setRequests((r) => r.filter((x) => x.id !== payload.from)))

      // ---- guest receives the host's decision ----
      .on('broadcast', { event: 'admit' }, ({ payload }) => {
        if (payload.to === user.id && statusRef.current === 'waiting') {
          clearTimeout(waitTimer.current)
          hostId.current = payload.from
          trusted.current = new Set([...payload.admitted, payload.from, user.id])
          updateStatus('inCall')
          broadcast('join', { from: user.id }) // existing peers now send offers
        } else if (payload.from === hostId.current) {
          trusted.current.add(payload.to)      // someone else was admitted
        }
      })
      .on('broadcast', { event: 'deny' }, ({ payload }) => {
        if (payload.to === user.id && statusRef.current === 'waiting')
          leave('The host declined your request')
      })
      .on('broadcast', { event: 'end' }, ({ payload }) => {
        if (payload.from === hostId.current && !isHostRef.current)
          leave('The host ended the call')
      })

      // ---- WebRTC handshake: only with admitted people ----
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        if (statusRef.current !== 'inCall' || !trusted.current.has(payload.from)) return
        const pc = createPeer(payload.from)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send(payload.from, { sdp: pc.localDescription })
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        removePeer(payload.from)
        trusted.current.delete(payload.from)
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.to !== user.id) return
        if (statusRef.current !== 'inCall' || !trusted.current.has(payload.from)) return
        const from = payload.from

        if (payload.sdp?.type === 'offer') {
          const pc = createPeer(from)
          await pc.setRemoteDescription(payload.sdp)
          await flushCandidates(from)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send(from, { sdp: pc.localDescription })
        } else if (payload.sdp?.type === 'answer') {
          await pcs.current[from]?.setRemoteDescription(payload.sdp)
          await flushCandidates(from)
        } else if (payload.candidate) {
          const pc = pcs.current[from]
          if (pc?.remoteDescription) await pc.addIceCandidate(payload.candidate)
          else (pending.current[from] ??= []).push(payload.candidate)
        }
      })

      .subscribe(async (s) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT')
          return leave('Could not open the call (are you a member of this workspace?)')
        if (s !== 'SUBSCRIBED') return

        await new Promise((r) => setTimeout(r, 800)) // let presence state arrive
        const state = channel.presenceState()
        const existing = Object.entries(state).find(
          ([id, metas]) => id !== user.id && metas.some((m) => m.role === 'host'))

        if (!existing) {
          // nobody is hosting -> I start the call and become the host
          isHostRef.current = true
          setIsHost(true)
          hostId.current = user.id
          trusted.current = new Set([user.id])
          await channel.track({ role: 'host', name: myName })
          updateStatus('inCall')
        } else {
          // a call is running -> knock and wait
          hostId.current = existing[0]
          await channel.track({ role: 'waiting', name: myName })
          updateStatus('waiting')
          broadcast('knock', { from: user.id, name: myName })
          waitTimer.current = setTimeout(() => leave('No response from the host'), 60000)
        }
      })
  }

  // ---------- host actions ----------
  const admit = (id) => {
    broadcast('admit', { from: user.id, to: id, admitted: [...trusted.current] })
    trusted.current.add(id)
    setRequests((r) => r.filter((x) => x.id !== id))
  }

  const deny = (id) => {
    broadcast('deny', { from: user.id, to: id })
    setRequests((r) => r.filter((x) => x.id !== id))
  }

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled))
    setMuted((m) => !m)
  }
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled))
    setCamOff((c) => !c)
  }

  useEffect(() => () => { if (channelRef.current) leave() }, [])

  return {
    status, isHost, requests, localStream, remotes, muted, camOff, error,
    join, leave, admit, deny, toggleMic, toggleCam,
  }
}