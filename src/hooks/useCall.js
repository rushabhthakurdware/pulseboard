import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export function useCall(workspaceId) {
  const { user } = useAuth()
  const [inCall, setInCall] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remotes, setRemotes] = useState({}) // userId -> MediaStream
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error, setError] = useState('')

  const pcs = useRef({})        // userId -> RTCPeerConnection
  const pending = useRef({})    // ICE candidates that arrived early
  const channelRef = useRef(null)
  const streamRef = useRef(null)

  const send = (to, data) =>
    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { from: user.id, to, ...data },
    })

  const removePeer = (id) => {
    pcs.current[id]?.close()
    delete pcs.current[id]
    setRemotes((r) => {
      const copy = { ...r }
      delete copy[id]
      return copy
    })
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

  const join = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setLocalStream(stream)
    } catch {
      return setError('Camera/microphone permission denied or unavailable')
    }

    const channel = supabase.channel(`call:${workspaceId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      // someone new joined -> WE (the existing peer) send them an offer
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        const pc = createPeer(payload.from)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send(payload.from, { sdp: pc.localDescription })
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => removePeer(payload.from))
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.to !== user.id) return
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'join', payload: { from: user.id } })
        }
      })

    channelRef.current = channel
    setInCall(true)
  }

  const leave = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: { from: user.id } })
    Object.keys(pcs.current).forEach(removePeer)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = null
    streamRef.current = null
    setLocalStream(null)
    setRemotes({})
    setInCall(false)
    setMuted(false)
    setCamOff(false)
  }

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled))
    setMuted((m) => !m)
  }

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled))
    setCamOff((c) => !c)
  }

  // hang up if the user navigates away
  useEffect(() => () => { if (streamRef.current) leave() }, [])

  return { inCall, localStream, remotes, muted, camOff, error, join, leave, toggleMic, toggleCam }
}