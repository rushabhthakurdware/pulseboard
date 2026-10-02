import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SummaryButton({ workspaceId }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const summarize = async () => {
    setLoading(true); setError(''); setSummary('')
    const { data, error } = await supabase.functions.invoke('summarize-chat', {
      body: { workspaceId },
    })
    if (error) setError(error.message)
    else if (data?.error) setError(data.error)
    else setSummary(data.summary)
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <button onClick={summarize} disabled={loading}
        className="border bg-white px-3 py-1 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
        {loading ? 'Summarizing...' : '✨ Summarize chat'}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {summary && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm whitespace-pre-wrap">
          {summary}
          <button onClick={() => setSummary('')}
            className="block mt-2 text-xs text-gray-500 underline">Dismiss</button>
        </div>
      )}
    </div>
  )
}