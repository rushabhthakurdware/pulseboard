import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MAX_SIZE = 10 * 1024 * 1024

export function useFiles(workspaceId) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('files').select('*, profiles(full_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setFiles(data ?? []))

    const channel = supabase
      .channel(`files:${workspaceId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'files', filter: `workspace_id=eq.${workspaceId}` },
        async ({ new: f }) => {
          // realtime payload has no joined data, so fetch the row with its profile
          const { data } = await supabase.from('files')
            .select('*, profiles(full_name)').eq('id', f.id).single()
          if (data) setFiles((p) => (p.some((x) => x.id === data.id) ? p : [data, ...p]))
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'files' },
        ({ old }) => setFiles((p) => p.filter((x) => x.id !== old.id)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  const upload = async (file) => {
    setError('')
    if (file.size > MAX_SIZE) return setError('File must be under 10 MB')

    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${workspaceId}/${crypto.randomUUID()}-${safeName}`

    // 1. upload the binary to Storage
    const { error: upErr } = await supabase.storage.from('files').upload(path, file)
    if (upErr) { setUploading(false); return setError(upErr.message) }

    // 2. save metadata in the database
    const { error: dbErr } = await supabase.from('files').insert({
      workspace_id: workspaceId,
      name: file.name,
      path,
      size: file.size,
      mime_type: file.type,
    })
    if (dbErr) {
      await supabase.storage.from('files').remove([path]) // roll back
      setError(dbErr.message)
    }
    setUploading(false)
  }

  // private bucket: generate a temporary link (valid 60 seconds)
  const download = async (file) => {
    const { data, error } = await supabase.storage
      .from('files').createSignedUrl(file.path, 60, { download: file.name })
    if (error) return setError(error.message)
    window.open(data.signedUrl, '_blank')
  }

  const remove = async (file) => {
    await supabase.storage.from('files').remove([file.path])
    await supabase.from('files').delete().eq('id', file.id)
    setFiles((p) => p.filter((x) => x.id !== file.id))
  }

  return { files, uploading, error, upload, download, remove }
}