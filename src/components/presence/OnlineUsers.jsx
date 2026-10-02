export default function OnlineUsers({ users }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      <span className="text-sm text-gray-600">{users.length} online</span>
      <div className="flex -space-x-2">
        {users.map((u) => (
          <div key={u.id} title={u.name}
            className="h-7 w-7 rounded-full bg-black text-white text-xs flex items-center justify-center border-2 border-white">
            {u.name[0]?.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  )
}