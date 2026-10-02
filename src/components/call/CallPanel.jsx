import { useEffect, useRef } from 'react'

function Tile({ stream, label, mirror }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
      <video ref={ref} autoPlay playsInline muted={mirror}
        className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
      <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  )
}

export default function CallPanel({ call, names }) {
    const { localStream, remotes, muted, camOff, isHost, requests,
          leave, admit, deny, toggleMic, toggleCam } = call
  return (
    
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
         {isHost && requests.map((r) => (
        <div key={r.id}
          className="bg-white rounded-lg p-3 flex items-center justify-between gap-3">
          <span className="text-sm"><b>{r.name}</b> wants to join the call</span>
          <div className="flex gap-2">
            <button onClick={() => admit(r.id)}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm">Admit</button>
            <button onClick={() => deny(r.id)}
              className="border px-3 py-1 rounded text-sm">Deny</button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile stream={localStream} label="You" mirror />
        {Object.entries(remotes).map(([id, stream]) => (
          <Tile key={id} stream={stream} label={names[id] ?? 'Teammate'} />
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <button onClick={toggleMic}
          className={`px-4 py-2 rounded-full text-sm ${muted ? 'bg-red-600 text-white' : 'bg-white'}`}>
          {muted ? '🔇 Unmute' : '🎤 Mute'}
        </button>
        <button onClick={toggleCam}
          className={`px-4 py-2 rounded-full text-sm ${camOff ? 'bg-red-600 text-white' : 'bg-white'}`}>
          {camOff ? '📷 Camera on' : '📷 Camera off'}
        </button>
        <button onClick={leave} className="px-4 py-2 rounded-full text-sm bg-red-600 text-white">
          📞 Leave
        </button>
        <button onClick={() => leave()} className="px-4 py-2 rounded-full text-sm bg-red-600 text-white">
        {isHost ? '📞 End call for all' : '📞 Leave'}
      </button>
      </div>
    </div>
  )
}