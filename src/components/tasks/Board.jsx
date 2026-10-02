import { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'In progress' },
  { key: 'done', label: 'Done' },
]

export default function Board({ workspaceId }) {
  const { tasks, addTask, moveTask, deleteTask } = useTasks(workspaceId)
  const [title, setTitle] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await addTask(title.trim())
    setTitle('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input className="flex-1 border p-2 rounded bg-white" placeholder="New task..."
          value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="bg-black text-white px-4 rounded">Add</button>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => moveTask(e.dataTransfer.getData('id'), col.key)}
            className="bg-gray-200 rounded-xl p-3 min-h-[300px]">
            <h3 className="font-semibold mb-3">
              {col.label} <span className="text-gray-500 text-sm">
                ({tasks.filter((t) => t.status === col.key).length})
              </span>
            </h3>
            <div className="space-y-2">
              {tasks.filter((t) => t.status === col.key).map((t) => (
                <div key={t.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData('id', t.id)}
                  className="bg-white p-3 rounded shadow cursor-grab flex justify-between gap-2">
                  <span className="break-words">{t.title}</span>
                  <button onClick={() => deleteTask(t.id)}
                    className="text-gray-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}