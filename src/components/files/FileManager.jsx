import { useFiles } from '../../hooks/useFiles'
import { useAuth } from '../../context/AuthContext'

const formatSize = (b = 0) =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export default function FileManager({ workspaceId }) {
  const { user } = useAuth()
  const { files, uploading, error, upload, download, remove } = useFiles(workspaceId)

  const onPick = (e) => {
    const file = e.target.files[0]
    if (file) upload(file)
    e.target.value = '' // allow re-selecting the same file
  }

  const onDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="block border-2 border-dashed border-gray-400 rounded-xl p-8 text-center bg-white cursor-pointer hover:bg-gray-50">
        <input type="file" className="hidden" onChange={onPick} disabled={uploading} />
        {uploading ? 'Uploading...' : 'Click or drag a file here (max 10 MB)'}
      </label>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-xl shadow divide-y">
        {files.length === 0 && <p className="p-4 text-gray-500 text-sm">No files yet.</p>}
        {files.map((f) => (
          <div key={f.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{f.name}</p>
              <p className="text-xs text-gray-500">
                {formatSize(f.size)} · {f.profiles?.full_name ?? 'Unknown'} ·{' '}
                {new Date(f.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => download(f)} className="border px-3 py-1 rounded text-sm">
                Download
              </button>
              {f.user_id === user.id && (
                <button onClick={() => remove(f)} className="text-gray-400 hover:text-red-600">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}