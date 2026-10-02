import { useEffect, useRef, useState } from 'react'
import { useMessages } from '../../hooks/useMessages'
import { useAuth } from '../../context/AuthContext'

export default function ChatBox({ workspaceId, typingNames, onTyping }) {

    // 2. add this ref near the other hooks
const lastTyping = useRef(0)

// 3. add this handler
const handleChange = (e) => {
  setText(e.target.value)
  const now = Date.now()
  if (now - lastTyping.current > 1000) { // throttle to 1 event/sec
    lastTyping.current = now
    onTyping()
  }
}

  const { user } = useAuth()
  const { messages, profiles, sendMessage } = useMessages(workspaceId)
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const content = text
    setText('')
    await sendMessage(content)
  }

  return (
    <div className="bg-white rounded-xl shadow flex flex-col h-[75vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const mine = m.user_id === user.id
          const author = profiles[m.user_id]?.full_name ?? '...'
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-lg ${mine ? 'bg-black text-white' : 'bg-gray-100'}`}>
                {!mine && <p className="text-xs font-semibold mb-1">{author}</p>}
                <p className="break-words">{m.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

        <div className="px-4 h-5 text-xs text-gray-500 italic">
  {typingNames.length > 0 && `${typingNames.join(', ')} ${typingNames.length > 1 ? 'are' : 'is'} typing...`}
</div>
      <form onSubmit={submit} className="border-t p-3 flex gap-2">
        <input className="flex-1 border p-2 rounded" placeholder="Type a message..."
          value={text} onChange={handleChange} />
        <button className="bg-black text-white px-4 rounded">Send</button>
      </form>
    </div>
  )
}