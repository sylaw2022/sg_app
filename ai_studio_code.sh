#!/bin/bash

# setup-custom-chat.sh
APP_NAME="custom-chat-app"

echo "=== Generating Custom Schema Chat App ==="

# 1. Create Next.js App
npx create-next-app@latest $APP_NAME \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm

cd $APP_NAME

# 2. Install Dependencies
npm install @supabase/supabase-js @supabase/ssr lucide-react simple-peer clsx tailwind-merge
npm install -D encoding

# 3. Create Directory Structure
mkdir -p lib components types

# 4. Create .env.local
cat <<EOF > .env.local
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_UNSIGNED_PRESET
EOF

# 5. Config Next.js for Cloudinary
cat <<EOF > next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};
export default nextConfig;
EOF

# 6. Library Files

# --- lib/supabase.ts ---
cat <<EOF > lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
EOF

# --- lib/utils.ts ---
cat <<EOF > lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

# 7. TypeScript Definitions (Matching your SQL)
cat <<EOF > types/index.ts
export interface User {
  id: number;
  username: string;
  password?: string; // Only needed for auth logic
  role: 'user' | 'admin';
  nickname: string;
  avatar: string;
  isVisible: boolean;
  createdAt: string;
}

export interface Group {
  id: number;
  name: string;
  avatar: string;
  admin_id: number;
  createdAt: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id?: number | null;
  group_id?: number | null;
  content: string;
  fileUrl?: string;
  type: 'text' | 'image' | 'audio' | 'video';
  timestamp: string;
  // Joins
  sender?: User;
}
EOF

# 8. Components

# --- components/Auth.tsx ---
cat <<EOF > components/Auth.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/types'

interface AuthProps {
  onLogin: (user: User) => void
}

export default function Auth({ onLogin }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        // Custom Register
        const { data, error } = await supabase
          .from('users')
          .insert({
            username,
            password, // In production, hash this!
            nickname,
            role: 'user',
            avatar: \`https://ui-avatars.com/api/?name=\${nickname || username}\`
          })
          .select()
          .single()

        if (error) throw error
        alert('Account created! Please log in.')
        setIsSignUp(false)
      } else {
        // Custom Login
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password) // In production, verify hash!
          .single()

        if (error || !data) throw new Error('Invalid credentials')
        onLogin(data as User)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center">{isSignUp ? 'Register' : 'Login'}</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            className="w-full p-3 rounded bg-slate-700 border border-slate-600"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full p-3 rounded bg-slate-700 border border-slate-600"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {isSignUp && (
            <input
              className="w-full p-3 rounded bg-slate-700 border border-slate-600"
              placeholder="Nickname"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
            />
          )}
          <button disabled={loading} className="w-full bg-blue-600 py-3 rounded hover:bg-blue-500 font-bold">
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400 cursor-pointer hover:text-white" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log In' : 'Need an account? Register'}
        </p>
      </div>
    </div>
  )
}
EOF

# --- components/VideoCall.tsx ---
cat <<EOF > components/VideoCall.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/types'
import { Phone, PhoneOff, Video } from 'lucide-react'

// Simple Peer Config
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export default function VideoCall({ currentUser, activeChat, isGroup }: { currentUser: User, activeChat: any, isGroup: boolean }) {
  const [inCall, setInCall] = useState(false)
  const [peers, setPeers] = useState<any[]>([])
  const localVideo = useRef<HTMLVideoElement>(null)
  const localStream = useRef<MediaStream | null>(null)
  const peerConnections = useRef<{[key: string]: RTCPeerConnection}>({})
  const supabase = createClient()

  // Unique Room ID: if group, use group_id. if DM, sort IDs to ensure unique channel
  const roomId = isGroup 
    ? \`group-\${activeChat.id}\`
    : \`dm-\${[currentUser.id, activeChat.id].sort().join('-')}\`

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStream.current = stream
      if (localVideo.current) localVideo.current.srcObject = stream
      setInCall(true)

      const channel = supabase.channel(\`call:\${roomId}\`)
      
      channel
        .on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload, channel))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'join', senderId: currentUser.id } })
          }
        })
    } catch (err) { console.error(err) }
  }

  const handleSignal = async (payload: any, channel: any) => {
    const { type, senderId, sdp, candidate } = payload
    if (senderId === currentUser.id) return

    if (!peerConnections.current[senderId]) createPeer(senderId, channel)
    const pc = peerConnections.current[senderId]

    if (type === 'join') {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer, senderId: currentUser.id, targetId: senderId } })
    } else if (type === 'offer' && payload.targetId === currentUser.id) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer, senderId: currentUser.id, targetId: senderId } })
    } else if (type === 'answer' && payload.targetId === currentUser.id) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    } else if (type === 'candidate' && payload.targetId === currentUser.id) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  const createPeer = (remoteId: number, channel: any) => {
    const pc = new RTCPeerConnection(rtcConfig)
    localStream.current?.getTracks().forEach(track => pc.addTrack(track, localStream.current!))
    
    pc.onicecandidate = e => {
      if (e.candidate) channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'candidate', candidate: e.candidate, senderId: currentUser.id, targetId: remoteId } })
    }
    
    pc.ontrack = e => {
      setPeers(prev => prev.find(p => p.id === remoteId) ? prev : [...prev, { id: remoteId, stream: e.streams[0] }])
    }
    peerConnections.current[remoteId] = pc
  }

  const endCall = () => {
    setInCall(false)
    localStream.current?.getTracks().forEach(t => t.stop())
    Object.values(peerConnections.current).forEach(pc => pc.close())
    peerConnections.current = {}
    setPeers([])
    supabase.channel(\`call:\${roomId}\`).unsubscribe()
  }

  return (
    <div className="border-b border-gray-700 p-2 bg-gray-800">
      {!inCall ? (
        <button onClick={startCall} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded text-white text-sm">
          <Phone size={16} /> Start Call
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-green-400 text-sm font-bold flex gap-2"><Video size={16}/> Live</span>
            <button onClick={endCall} className="bg-red-600 p-2 rounded text-white"><PhoneOff size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <video ref={localVideo} autoPlay muted playsInline className="w-full h-32 bg-black rounded object-cover" />
            {peers.map(p => (
              <VideoPlayer key={p.id} stream={p.stream} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const VideoPlayer = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  return <video ref={ref} autoPlay playsInline className="w-full h-32 bg-black rounded object-cover" />
}
EOF

# --- components/ChatWindow.tsx ---
cat <<EOF > components/ChatWindow.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Message } from '@/types'
import { Send, Image as ImageIcon } from 'lucide-react'
import VideoCall from './VideoCall'

export default function ChatWindow({ user, activeChat, isGroup }: { user: User, activeChat: any, isGroup: boolean }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeChat) return
    
    // 1. Fetch History
    const fetchMsgs = async () => {
      let query = supabase.from('messages').select('*, sender:users!sender_id(username, avatar)').order('timestamp', { ascending: true })
      
      if (isGroup) {
        query = query.eq('group_id', activeChat.id)
      } else {
        // For DMs, we need (sender=me AND recipient=them) OR (sender=them AND recipient=me)
        query = query.or(\`and(sender_id.eq.\${user.id},recipient_id.eq.\${activeChat.id}),and(sender_id.eq.\${activeChat.id},recipient_id.eq.\${user.id})\`)
      }

      const { data } = await query
      if (data) setMessages(data as any)
    }
    fetchMsgs()

    // 2. Realtime Subscription
    const channel = supabase
      .channel('chat-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as Message
        
        // Filter logic: Only add if it belongs to this chat
        const isRelevant = isGroup 
          ? newMsg.group_id === activeChat.id
          : (newMsg.sender_id === activeChat.id && newMsg.recipient_id === user.id) || (newMsg.sender_id === user.id && newMsg.recipient_id === activeChat.id)

        if (isRelevant) {
           // Fetch sender info for display
           const { data: senderData } = await supabase.from('users').select('username, avatar').eq('id', newMsg.sender_id).single()
           setMessages(prev => [...prev, { ...newMsg, sender: senderData as any }])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeChat, isGroup, user.id])

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async (fileUrl?: string, type: 'text'|'image' = 'text') => {
    if (!text.trim() && !fileUrl) return

    const msgData: any = {
      sender_id: user.id,
      content: text,
      type,
      fileUrl,
      timestamp: new Date().toISOString()
    }

    if (isGroup) msgData.group_id = activeChat.id
    else msgData.recipient_id = activeChat.id

    const { error } = await supabase.from('messages').insert(msgData)
    if (error) console.error(error)
    else setText('')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)

    try {
      const res = await fetch(\`https://api.cloudinary.com/v1_1/\${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload\`, { method: 'POST', body: formData })
      const data = await res.json()
      await handleSend(data.secure_url, 'image')
    } catch(e) { console.error(e) } 
    finally { setUploading(false) }
  }

  if (!activeChat) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a chat</div>

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
        <div className="flex items-center gap-3">
          <img src={activeChat.avatar || activeChat.avatar_url} className="w-10 h-10 rounded-full bg-gray-700" />
          <h2 className="font-bold text-white">{activeChat.name || activeChat.nickname || activeChat.username}</h2>
        </div>
      </div>

      <VideoCall currentUser={user} activeChat={activeChat} isGroup={isGroup} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id
          return (
            <div key={msg.id} className={\`flex \${isMe ? 'justify-end' : 'justify-start'}\`}>
              <div className={\`max-w-[70%] p-3 rounded-lg \${isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}\`}>
                {!isMe && isGroup && <p className="text-xs text-orange-400 mb-1">{msg.sender?.username}</p>}
                {msg.type === 'image' && <img src={msg.fileUrl} className="mb-2 rounded max-w-full" />}
                <p>{msg.content}</p>
                <p className="text-[10px] opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800 flex gap-2 items-center">
        <label className="cursor-pointer p-2 text-gray-400 hover:text-white">
          <ImageIcon size={20} />
          <input type="file" hidden accept="image/*" onChange={handleUpload} disabled={uploading}/>
        </label>
        <input 
          className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2" 
          placeholder={uploading ? "Uploading..." : "Type a message..."}
          value={text} 
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={() => handleSend()} className="bg-blue-600 p-2 rounded-full text-white"><Send size={20}/></button>
      </div>
    </div>
  )
}
EOF

# --- components/Sidebar.tsx ---
cat <<EOF > components/Sidebar.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Group } from '@/types'
import { UserPlus, Users, MessageSquare } from 'lucide-react'

interface SidebarProps {
  currentUser: User;
  onSelect: (chat: any, isGroup: boolean) => void;
}

export default function Sidebar({ currentUser, onSelect }: SidebarProps) {
  const [friends, setFriends] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [view, setView] = useState<'friends' | 'groups'>('friends')
  const [newFriendId, setNewFriendId] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [currentUser])

  const fetchData = async () => {
    // Fetch Friends (Complex join due to junction table)
    const { data: friendLinks } = await supabase.from('friends').select('friend_id').eq('user_id', currentUser.id)
    if (friendLinks && friendLinks.length > 0) {
      const ids = friendLinks.map((f: any) => f.friend_id)
      const { data: friendList } = await supabase.from('users').select('*').in('id', ids)
      if (friendList) setFriends(friendList as User[])
    }

    // Fetch Groups
    const { data: groupLinks } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id)
    if (groupLinks && groupLinks.length > 0) {
      const gIds = groupLinks.map((g: any) => g.group_id)
      const { data: groupList } = await supabase.from('groups').select('*').in('id', gIds)
      if (groupList) setGroups(groupList as Group[])
    }
  }

  const addFriend = async () => {
    if (!newFriendId) return
    // Simple direct add for demo (Skipping request logic for brevity)
    // Add both directions
    await supabase.from('friends').insert([{ user_id: currentUser.id, friend_id: parseInt(newFriendId) }])
    await supabase.from('friends').insert([{ user_id: parseInt(newFriendId), friend_id: currentUser.id }])
    setNewFriendId('')
    fetchData()
  }

  const createGroup = async () => {
    const name = prompt("Group Name:")
    if (!name) return
    const { data: newGroup, error } = await supabase.from('groups').insert({ name, admin_id: currentUser.id }).select().single()
    if (!error && newGroup) {
      await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: currentUser.id })
      fetchData()
    }
  }

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col h-screen">
      {/* User Info */}
      <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center gap-3">
        <img src={currentUser.avatar} className="w-12 h-12 rounded-full border-2 border-green-500" />
        <div>
          <h3 className="font-bold text-white">{currentUser.nickname || currentUser.username}</h3>
          <p className="text-xs text-gray-400">ID: {currentUser.id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-2 bg-gray-900">
        <button onClick={() => setView('friends')} className={\`flex-1 p-2 rounded text-sm flex items-center justify-center gap-2 \${view === 'friends' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}\`}>
          <Users size={16} /> Friends
        </button>
        <button onClick={() => setView('groups')} className={\`flex-1 p-2 rounded text-sm flex items-center justify-center gap-2 \${view === 'groups' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}\`}>
          <MessageSquare size={16} /> Groups
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {view === 'friends' ? (
          <>
             <div className="flex gap-2 mb-4">
               <input 
                 placeholder="Friend ID to add" 
                 className="w-full bg-gray-700 p-2 rounded text-sm text-white"
                 value={newFriendId}
                 onChange={e => setNewFriendId(e.target.value)}
               />
               <button onClick={addFriend} className="bg-green-600 p-2 rounded text-white"><UserPlus size={16}/></button>
             </div>
             {friends.map(f => (
               <div key={f.id} onClick={() => onSelect(f, false)} className="p-3 hover:bg-gray-700 rounded cursor-pointer flex items-center gap-3">
                 <img src={f.avatar} className="w-10 h-10 rounded-full" />
                 <span className="text-gray-200">{f.nickname || f.username}</span>
               </div>
             ))}
          </>
        ) : (
          <>
            <button onClick={createGroup} className="w-full bg-gray-700 p-2 rounded text-white text-sm mb-4">+ Create Group</button>
            {groups.map(g => (
               <div key={g.id} onClick={() => onSelect(g, true)} className="p-3 hover:bg-gray-700 rounded cursor-pointer flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">{g.name[0]}</div>
                 <span className="text-gray-200">{g.name}</span>
               </div>
             ))}
          </>
        )}
      </div>
    </div>
  )
}
EOF

# --- app/page.tsx ---
cat <<EOF > app/page.tsx
'use client'
import { useState } from 'react'
import Auth from '@/components/Auth'
import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import { User } from '@/types'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeChat, setActiveChat] = useState<any>(null)
  const [isGroup, setIsGroup] = useState(false)
  const supabase = createClient()

  const handleLogout = () => {
    setCurrentUser(null)
    setActiveChat(null)
  }

  if (!currentUser) {
    return <Auth onLogin={setCurrentUser} />
  }

  return (
    <main className="flex min-h-screen bg-black">
      <Sidebar 
        currentUser={currentUser} 
        onSelect={(chat, group) => { setActiveChat(chat); setIsGroup(group); }} 
      />
      
      <div className="flex-1 flex flex-col relative">
        <button onClick={handleLogout} className="absolute top-4 right-4 z-50 text-xs text-gray-500 hover:text-white">Logout</button>
        <ChatWindow 
          user={currentUser} 
          activeChat={activeChat} 
          isGroup={isGroup} 
        />
      </div>
    </main>
  )
}
EOF

# --- Create SQL File for reference ---
cat <<EOF > db_schema.sql
-- Run this in Supabase SQL Editor to set up your database
-- Note: Security warning. This logic relies on client-side DB access for demo purposes.
-- Production apps should use Postgrest RLS strictly or server-side API routes.

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    "isVisible" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Friends junction table
CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Friend requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (from_id, to_id),
    CHECK (from_id != to_id)
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Group members junction table
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    content TEXT,
    "fileUrl" TEXT,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'audio', 'video')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK((recipient_id IS NOT NULL AND group_id IS NULL) OR (recipient_id IS NULL AND group_id IS NOT NULL))
);

-- RLS (Open for this demo as we aren't using Supabase Auth UUIDs)
alter table users enable row level security;
alter table messages enable row level security;
alter table friends enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;

create policy "Public Access" on users for all using (true);
create policy "Public Access" on messages for all using (true);
create policy "Public Access" on friends for all using (true);
create policy "Public Access" on groups for all using (true);
create policy "Public Access" on group_members for all using (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
EOF

echo "Done! Run: cd $APP_NAME && npm run dev"
echo "Don't forget to run the SQL in 'db_schema.sql' in your Supabase Dashboard."