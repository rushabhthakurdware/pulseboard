import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useTasks(workspaceId) {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    supabase.from('tasks').select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at')
      .then(({ data }) => setTasks(data ?? []))

    const channel = supabase
      .channel(`tasks:${workspaceId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        ({ new: t }) => setTasks((p) => (p.some((x) => x.id === t.id) ? p : [...p, t])))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        ({ new: t }) => setTasks((p) => p.map((x) => (x.id === t.id ? t : x))))
      // DELETE events can't be filtered, but removing by id is harmless
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        ({ old }) => setTasks((p) => p.filter((x) => x.id !== old.id)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  const addTask = async (title) => {
    const { error } = await supabase.from('tasks').insert({ workspace_id: workspaceId, title })
    if (error) console.error(error)
  }

  const moveTask = async (id, status) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, status } : t))) // optimistic
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    if (error) console.error(error)
  }

  const deleteTask = async (id) => {
    setTasks((p) => p.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  return { tasks, addTask, moveTask, deleteTask }
}