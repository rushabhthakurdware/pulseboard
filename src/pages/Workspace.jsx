import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ChatBox from "../components/chat/ChatBox";
import Board from "../components/tasks/Board";
import OnlineUsers from "../components/presence/OnlineUsers";
import { usePresence } from "../hooks/usePresence";
import FileManager from "../components/files/FileManager";
import SummaryButton from "../components/chat/SummaryButton";
import CallPanel from "../components/call/CallPanel";
import { useCall } from "../hooks/useCall";

export default function Workspace() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("chat");
  const { online, typingNames, sendTyping } = usePresence(id);

  const call = useCall(id);
  const names = Object.fromEntries(online.map((u) => [u.id, u.name]));

  useEffect(() => {
    supabase
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setWorkspace(data));
  }, [id]);

  const tabClass = (t) =>
    `px-4 py-2 rounded ${tab === t ? "bg-black text-white" : "bg-white border"}`;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-blue-600">
            ← Back
          </Link>
          <h1 className="text-xl font-bold">
            {workspace?.name ?? "Loading..."}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <OnlineUsers users={online} />
          {workspace && (
            <span className="text-sm bg-gray-100 px-3 py-1 rounded">
              Invite code: <b>{workspace.invite_code}</b>
            </span>
          )}
        </div>
        {call.status === "idle" && (
          <button
            onClick={call.join}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm"
          >
            📹 Join call
          </button>
        )}
      </nav>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex gap-2">
          <button className={tabClass("chat")} onClick={() => setTab("chat")}>
            💬 Chat
          </button>
          <button className={tabClass("tasks")} onClick={() => setTab("tasks")}>
            📋 Tasks
          </button>
          <button className={tabClass("files")} onClick={() => setTab("files")}>
            📁 Files
          </button>
        </div>
        {call.error && <p className="text-red-600 text-sm">{call.error}</p>}

        {["checking", "waiting"].includes(call.status) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm">
              {call.status === "checking"
                ? "Checking for a running call..."
                : "Asking to join... waiting for the host to let you in"}
            </span>
            <button
              onClick={() => call.leave()}
              className="border px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {call.status === "inCall" && <CallPanel call={call} names={names} />}
        {call.error && <p className="text-red-600 text-sm">{call.error}</p>}
        {call.inCall && <CallPanel call={call} names={names} />}
        {tab === "chat" && (
          <>
            <SummaryButton workspaceId={id} />
            <ChatBox
              workspaceId={id}
              typingNames={typingNames}
              onTyping={sendTyping}
            />
          </>
        )}
        {tab === "tasks" && <Board workspaceId={id} />}
        {tab === "files" && <FileManager workspaceId={id} />}
      </div>
    </div>
  );
}
