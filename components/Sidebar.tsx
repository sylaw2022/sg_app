'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { User, Group, Message, FriendRequest, Notification } from '@/types'
import { UserPlus, Users, MessageSquare, X, Search, Check, Plus, Trash2, Settings, Camera, Loader2, Save, RefreshCw, LogOut, Upload, Image as ImageIcon, Home, Phone, UserCheck, UserX, Bell } from 'lucide-react'
import ContactsReader from './ContactsReader'

interface SidebarProps {
  currentUser: User;
  onSelect: (chat: any, isGroup: boolean) => void;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void; // New Prop for logout
  onBackToLauncher?: () => void; // New Prop to go back to launcher
}

interface FriendWithLatestMessage extends User {
  latestMessage?: Message | null;
}

interface GroupWithLatestMessage extends Group {
  latestMessage?: Message | null;
}

export default function Sidebar({ currentUser, onSelect, onUpdateUser, onLogout, onBackToLauncher }: SidebarProps) {
  const [friends, setFriends] = useState<FriendWithLatestMessage[]>([])
  const [groups, setGroups] = useState<GroupWithLatestMessage[]>([])
  const [view, setView] = useState<'friends' | 'groups' | 'requests'>('friends')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'public' | 'private'>((currentUser.mode as 'public' | 'private') || 'private')
  
  // Modal States
  const [showFriendModal, setShowFriendModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showContactsReader, setShowContactsReader] = useState(false)
  
  // Data States
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [sentFriendRequests, setSentFriendRequests] = useState<FriendRequest[]>([])
  const [searchPhoneNumber, setSearchPhoneNumber] = useState('')
  const [readingContacts, setReadingContacts] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [activeRejectionNotification, setActiveRejectionNotification] = useState<Notification | null>(null)
  // Load cleared request statuses from localStorage on mount
  const [clearedRequestStatuses, setClearedRequestStatuses] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clearedRequestStatuses')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch (e) {
          return new Set()
        }
      }
    }
    return new Set()
  }) // Track cleared request statuses: "from_id-to_id"
  
  // Save cleared request statuses to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clearedRequestStatuses', JSON.stringify(Array.from(clearedRequestStatuses)))
    }
  }, [clearedRequestStatuses])

  // Profile Edit States
  const [editNickname, setEditNickname] = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Background Management States
  const [userBackgrounds, setUserBackgrounds] = useState<Array<{ id: string; name: string; url: string }>>([])
  const [selectedBackground, setSelectedBackground] = useState<string>('none')
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)
  
  // Predefined background options (same as VideoCall)
  const BACKGROUND_OPTIONS = [
    { id: 'none', name: 'None', url: null },
    { id: 'blur', name: 'Blur', url: 'blur' },
    { id: 'office', name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop' },
    { id: 'beach', name: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop' },
    { id: 'space', name: 'Space', url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1920&h=1080&fit=crop' },
    { id: 'nature', name: 'Nature', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop' },
  ]
  
  // Get all available backgrounds
  const getAllBackgrounds = () => {
    return [...BACKGROUND_OPTIONS, ...userBackgrounds]
  }
  
  // Get background by ID
  const getBackgroundById = (id: string) => {
    return getAllBackgrounds().find(bg => bg.id === id)
  }

  const supabase = createClient()

  // Sync selectedMode with currentUser.mode
  useEffect(() => {
    if (currentUser?.mode) {
      setSelectedMode(currentUser.mode as 'public' | 'private')
    }
  }, [currentUser?.mode])

  // Handle mode change
  const handleModeChange = async (newMode: 'public' | 'private') => {
    // Check if phone number is required for public mode
    if (newMode === 'public' && !currentUser.phone_number) {
      alert('Phone number is required for public mode. Please add your phone number in profile settings.')
      return
    }

    try {
      // Update mode in database
      const { data, error } = await supabase
        .from('users')
        .update({ mode: newMode })
        .eq('id', currentUser.id)
        .select()
        .single()

      if (error) throw error

      // Update local state
      setSelectedMode(newMode)
      
      // Update currentUser in parent component
      if (onUpdateUser && data) {
        onUpdateUser(data as User)
      }

      // Refetch data to show friends based on new mode
      fetchData()
    } catch (err: any) {
      alert('Failed to update mode: ' + err.message)
    }
  }

  // Refetch data when mode changes (but not on initial mount to avoid double fetch)
  const prevModeRef = useRef(selectedMode)
  useEffect(() => {
    if (currentUser?.id && prevModeRef.current !== selectedMode) {
      prevModeRef.current = selectedMode
      fetchData()
    }
  }, [selectedMode, currentUser?.id])

  // Define fetchData first so it can be used in useEffect
  const fetchData = async () => {
    if (!currentUser || !currentUser.id) {
      console.warn('⚠️ Cannot fetch data: currentUser is not set')
      return
    }
    
    setIsRefreshing(true)
    try {
      console.log('🔄 Starting fetchData for user:', currentUser.id, currentUser.username)
      
      // Fetch friend requests
      const { data: incomingRequests, error: incomingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_id', currentUser.id)
      
      if (incomingError) {
        // Handle 406 and other errors gracefully
        if (incomingError.code === '406' || incomingError.message?.includes('406')) {
          console.warn('⚠️ [DEBUG] 406 error fetching incoming friend requests (RLS or header issue):', incomingError.message)
          // Continue with empty array instead of failing
          setFriendRequests([])
        } else {
          console.error('❌ [DEBUG] Error fetching incoming friend requests:', incomingError)
        }
      }
      
      if (!incomingError && incomingRequests) {
        // Fetch user data for each request
        const fromIds = incomingRequests.map(r => r.from_id)
        if (fromIds.length > 0) {
          const { data: fromUsers } = await supabase
            .from('users')
            .select('*')
            .in('id', fromIds)
          
          if (fromUsers) {
            const requestsWithUsers = incomingRequests.map(req => ({
              ...req,
              from_user: fromUsers.find(u => u.id === req.from_id)
            }))
            setFriendRequests(requestsWithUsers as any)
          } else {
            setFriendRequests(incomingRequests as any)
          }
        } else {
          setFriendRequests([])
        }
      }
      
      // Query notifications FIRST (before processing requests) to check for rejections/acceptances
      // Handle 404 gracefully if table doesn't exist yet
      let userNotifications: any[] | null = null
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .in('type', ['friend_request_rejected', 'friend_request_accepted'])
        
        if (error && error.code !== '42P01' && !error.message?.includes('does not exist')) {
          // Only log if it's not a "table doesn't exist" error
          // console.error('Error fetching notifications:', error)
        }
        
        if (!error) {
          userNotifications = data
        }
      } catch (err) {
        // Table doesn't exist or other error - use empty array
        userNotifications = []
      }
      
      // Fallback to state if query failed
      if (!userNotifications) {
        userNotifications = notifications.filter(
          n => n.type === 'friend_request_rejected' || n.type === 'friend_request_accepted'
        )
      }
      
      const { data: outgoingRequests, error: outgoingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_id', currentUser.id)
      
      if (outgoingError) {
        // Handle 406 and other errors gracefully
        if (outgoingError.code === '406' || outgoingError.message?.includes('406')) {
          console.warn('⚠️ [DEBUG] 406 error fetching outgoing friend requests (RLS or header issue):', outgoingError.message)
          // Continue with empty array instead of failing
        } else {
          console.error('❌ [DEBUG] Error fetching outgoing friend requests:', outgoingError)
        }
      }
      
      if (!outgoingError && outgoingRequests) {
        // Fetch user data for each request
        const toIds = outgoingRequests.map(r => r.to_id)
        if (toIds.length > 0) {
          const { data: toUsers } = await supabase
            .from('users')
            .select('*')
            .in('id', toIds)
          
          if (toUsers) {
            const requestsWithUsers = outgoingRequests.map(req => ({
              ...req,
              to_user: toUsers.find(u => u.id === req.to_id)
            }))
            
            // Merge with existing sent requests to preserve rejected/accepted ones
            setSentFriendRequests(prev => {
              const existingMap = new Map(prev.map(r => [`${r.from_id}-${r.to_id}`, r]))
              
              // Add/update requests from database
              requestsWithUsers.forEach(req => {
                const key = `${req.from_id}-${req.to_id}`
                existingMap.set(key, req as any)
              })
              
              // Keep existing requests that have rejection/acceptance status (not in database anymore)
              prev.forEach(existingReq => {
                const key = `${existingReq.from_id}-${existingReq.to_id}`
                if (!existingMap.has(key)) {
                  // Check if this request has a rejection or acceptance notification (from DB query or state)
                  const hasRejection = userNotifications?.some(
                    n => n.type === 'friend_request_rejected' && 
                    n.related_user_id === existingReq.to_id
                  ) || notifications.some(
                    n => n.type === 'friend_request_rejected' && 
                    n.related_user_id === existingReq.to_id
                  )
                  const hasAcceptance = userNotifications?.some(
                    n => n.type === 'friend_request_accepted' && 
                    n.related_user_id === existingReq.to_id
                  ) || notifications.some(
                    n => n.type === 'friend_request_accepted' && 
                    n.related_user_id === existingReq.to_id
                  ) || friends.some(f => f.id === existingReq.to_id)
                  
                  // Keep it if it has rejection/acceptance status AND hasn't been cleared
                  if (hasRejection || hasAcceptance) {
                    // Check if this request has been cleared by the user
                    const requestKey = `${existingReq.from_id}-${existingReq.to_id}`
                    const isCleared = clearedRequestStatuses.has(requestKey)
                    
                    // Only keep it if it hasn't been cleared
                    if (!isCleared) {
                      // If we don't have user data, fetch it
                      if (!existingReq.to_user && existingReq.to_id) {
                        supabase
                          .from('users')
                          .select('*')
                          .eq('id', existingReq.to_id)
                          .single()
                          .then(({ data: userData }) => {
                            if (userData) {
                              setSentFriendRequests(current => {
                                // Check again if it's been cleared before updating
                                const currentKey = `${existingReq.from_id}-${existingReq.to_id}`
                                const currentlyCleared = clearedRequestStatuses.has(currentKey)
                                if (currentlyCleared) return current
                                
                                return current.map(r => 
                                  r.from_id === existingReq.from_id && r.to_id === existingReq.to_id
                                    ? { ...r, to_user: userData } as any
                                    : r
                                )
                              })
                            }
                          })
                      }
                      existingMap.set(key, existingReq)
                    } else {
                      console.log('🚫 [DEBUG] Skipping cleared request in fetchData:', requestKey)
                    }
                  }
                }
              })
              
              return Array.from(existingMap.values())
            })
          } else {
            setSentFriendRequests(outgoingRequests as any)
          }
        } else {
          // Even if no requests in DB, keep existing ones with rejection/acceptance status
          setSentFriendRequests(prev => {
            return prev.filter(existingReq => {
              const hasRejection = userNotifications?.some(
                n => n.type === 'friend_request_rejected' && 
                n.related_user_id === existingReq.to_id
              ) || notifications.some(
                n => n.type === 'friend_request_rejected' && 
                n.related_user_id === existingReq.to_id
              )
              const hasAcceptance = userNotifications?.some(
                n => n.type === 'friend_request_accepted' && 
                n.related_user_id === existingReq.to_id
              ) || notifications.some(
                n => n.type === 'friend_request_accepted' && 
                n.related_user_id === existingReq.to_id
              ) || friends.some(f => f.id === existingReq.to_id)
              
              // Only keep if it has rejection/acceptance status AND hasn't been cleared
              if (hasRejection || hasAcceptance) {
                const requestKey = `${existingReq.from_id}-${existingReq.to_id}`
                const isCleared = clearedRequestStatuses.has(requestKey)
                return !isCleared // Return true to keep it only if not cleared
              }
              
              return false // Don't keep if no rejection/acceptance status
            })
          })
        }
      } else {
        // If error fetching requests, still preserve existing ones with rejection/acceptance status
        setSentFriendRequests(prev => {
          return prev.filter(existingReq => {
            const hasRejection = userNotifications?.some(
              n => n.type === 'friend_request_rejected' && 
              n.related_user_id === existingReq.to_id
            )
            const hasAcceptance = userNotifications?.some(
              n => n.type === 'friend_request_accepted' && 
              n.related_user_id === existingReq.to_id
            ) || friends.some(f => f.id === existingReq.to_id)
            
            // Only keep if it has rejection/acceptance status AND hasn't been cleared
            if (hasRejection || hasAcceptance) {
              const requestKey = `${existingReq.from_id}-${existingReq.to_id}`
              const isCleared = clearedRequestStatuses.has(requestKey)
              return !isCleared // Return true to keep it only if not cleared
            }
            
            return false // Don't keep if no rejection/acceptance status
          })
        })
      }
      
      // 1. Fetch Friends
      const { data: friendLinks, error: friendLinksError } = await supabase.from('friends').select('friend_id').eq('user_id', currentUser.id)
      if (friendLinksError) {
        // console.error('Error fetching friend links:', friendLinksError)
        setIsRefreshing(false)
        return
      }
      
      let currentFriendIds: number[] = []
      
      if (friendLinks) {
        currentFriendIds = friendLinks.map((f: any) => f.friend_id)
        if (currentFriendIds.length > 0) {
          const { data: friendList, error: friendListError } = await supabase.from('users').select('*').in('id', currentFriendIds)
          if (friendListError) {
            // console.error('Error fetching friend list:', friendListError)
            setIsRefreshing(false)
            return
          }
          
          if (friendList) {
            // Filter friends by selected mode
            const filteredFriends = (friendList as User[]).filter(friend => 
              (friend.mode || 'private') === selectedMode
            )
            
            // Fetch latest message from either party (sent or received) for each friend
            const friendsWithMessages = await Promise.all(
              filteredFriends.map(async (friend) => {
                try {
                  console.log(`🔍 Fetching latest message for friend: ${friend.username} (ID: ${friend.id}), conversation with user: ${currentUser.id}`)
                  
                  // Get latest message from either party
                  const { data: latestMsgData, error: msgError } = await supabase
                    .from('messages')
                    .select('*')
                    .is('group_id', null)
                    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${friend.id}),and(sender_id.eq.${friend.id},recipient_id.eq.${currentUser.id})`)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                  
                  if (msgError) {
                    // console.error(`❌ Error fetching latest message for friend ${friend.id}:`, msgError)
                    return {
                      ...friend,
                      latestMessage: null
                    } as FriendWithLatestMessage
                  }
                  
                  console.log(`📦 Raw message data for ${friend.username}:`, latestMsgData)
                  
                  const latestMsg = latestMsgData && Array.isArray(latestMsgData) && latestMsgData.length > 0 ? latestMsgData[0] : null
                  
                  // Debug logging
                  if (latestMsg) {
                    const isFromMe = latestMsg.sender_id === currentUser.id
                    console.log(`✅ Latest message for ${friend.username}:`, {
                      id: latestMsg.id,
                      content: latestMsg.content?.substring(0, 50) || '[no content]',
                      read: latestMsg.is_read,
                      type: latestMsg.type,
                      timestamp: latestMsg.timestamp,
                      fromMe: isFromMe
                    })
                  } else {
                    console.log(`❌ No messages found for ${friend.username} (conversation between user ${currentUser.id} and friend ${friend.id})`)
                  }
                  
                  return {
                    ...friend,
                    latestMessage: latestMsg
                  } as FriendWithLatestMessage
                } catch (error) {
                  // console.error(`💥 Exception fetching message for friend ${friend.id}:`, error)
                  return {
                    ...friend,
                    latestMessage: null
                  } as FriendWithLatestMessage
                }
              })
            )
            
            console.log(`📋 Final friendsWithMessages:`, friendsWithMessages.map(f => ({
              username: f.username,
              hasMessage: !!f.latestMessage,
              messageContent: f.latestMessage?.content?.substring(0, 30)
            })))
            
            setFriends(friendsWithMessages)
          }
        } else {
          setFriends([])
        }
      }

      // 2. Fetch Groups
      const { data: groupLinks, error: groupLinksError } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id)
      if (groupLinksError) {
        // console.error('Error fetching group links:', groupLinksError)
        setIsRefreshing(false)
        return
      }
      
      if (groupLinks && groupLinks.length > 0) {
        const gIds = groupLinks.map((g: any) => g.group_id)
        const { data: groupList, error: groupListError } = await supabase.from('groups').select('*').in('id', gIds)
        if (groupListError) {
          // console.error('Error fetching group list:', groupListError)
          setIsRefreshing(false)
          return
        }
        
        if (groupList) {
          // Fetch latest message from any member in each group
          const groupsWithMessages = await Promise.all(
            (groupList as Group[]).map(async (group) => {
              try {
                const { data: latestMsgData, error: msgError } = await supabase
                  .from('messages')
                  .select('*')
                  .eq('group_id', group.id)
                  .is('recipient_id', null)
                  .order('timestamp', { ascending: false })
                  .limit(1)
                
                if (msgError) {
                  // console.error(`Error fetching latest message for group ${group.id}:`, msgError)
                  return {
                    ...group,
                    latestMessage: null
                  } as GroupWithLatestMessage
                }
                
                const latestMsg = latestMsgData && Array.isArray(latestMsgData) && latestMsgData.length > 0 ? latestMsgData[0] : null
                
                if (latestMsg) {
                  const isFromMe = latestMsg.sender_id === currentUser.id
                  console.log(`✓ Latest message for group ${group.name}:`, latestMsg.content?.substring(0, 50) || '[no content]', '| Read:', latestMsg.is_read, '| FromMe:', isFromMe)
                }
                
                return {
                  ...group,
                  latestMessage: latestMsg
                } as GroupWithLatestMessage
              } catch (error) {
                // console.error(`Exception fetching message for group ${group.id}:`, error)
                return {
                  ...group,
                  latestMessage: null
                } as GroupWithLatestMessage
              }
            })
          )
          setGroups(groupsWithMessages)
        }
      } else {
        setGroups([])
      }
    } catch (error) {
      // console.error('Error in fetchData:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    console.log('🔄 Sidebar mounted or currentUser changed, fetching data...', { currentUser: currentUser?.id, username: currentUser?.username })
    if (currentUser && currentUser.id) {
      fetchData()
    } else {
      console.warn('⚠️ Sidebar useEffect: currentUser is not available yet')
    }
  }, [currentUser?.id]) // Use currentUser.id to avoid unnecessary re-renders

  // Refresh data periodically as a fallback (realtime should handle most updates)
  useEffect(() => {
    if (!currentUser?.id) return
    
    const interval = setInterval(() => {
      console.log('⏰ Periodic refresh triggered')
      fetchData()
    }, 30000) // Refresh every 30 seconds as fallback

    return () => clearInterval(interval)
  }, [currentUser?.id])

  // Realtime listener for new messages to update latest message previews
  useEffect(() => {
    if (!currentUser) return
    
    const channel = supabase.channel('sidebar-messages-listener')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, async (payload) => {
        const newMsg = payload.new as Message
        console.log('📨 New message inserted in sidebar:', newMsg)
        
        // Update friend's latest message if it's a direct message involving current user
        if (newMsg.recipient_id && !newMsg.group_id) {
          // Check if message is from or to a friend
          const isFromMe = newMsg.sender_id === currentUser.id
          const isToMe = newMsg.recipient_id === currentUser.id
          const friendId = isFromMe ? newMsg.recipient_id : newMsg.sender_id
          
          if (isFromMe || isToMe) {
            console.log(`Updating latest message for friend ${friendId}`)
            setFriends(prev => prev.map(f => 
              f.id === friendId 
                ? { ...f, latestMessage: newMsg }
                : f
            ))
          }
        }
        // Update group's latest message if it's a group message (from any member)
        if (newMsg.group_id && !newMsg.recipient_id) {
          console.log(`Updating latest message for group ${newMsg.group_id}`)
          setGroups(prev => prev.map(g => 
            g.id === newMsg.group_id 
              ? { ...g, latestMessage: newMsg }
              : g
          ))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        const updatedMsg = payload.new as Message
        
        // Update read status for messages sent by current user (when recipient reads them)
        if (updatedMsg.sender_id === currentUser.id) {
          // Update read status in friend's latest message
          if (updatedMsg.recipient_id && !updatedMsg.group_id) {
            setFriends(prev => prev.map(f => 
              f.id === updatedMsg.recipient_id && f.latestMessage?.id === updatedMsg.id
                ? { ...f, latestMessage: updatedMsg }
                : f
            ))
          }
          // Update read status in group's latest message
          if (updatedMsg.group_id && !updatedMsg.recipient_id) {
            setGroups(prev => prev.map(g => 
              g.id === updatedMsg.group_id && g.latestMessage?.id === updatedMsg.id
                ? { ...g, latestMessage: updatedMsg }
                : g
            ))
          }
        }
        
        // Update read status for messages received by current user (when you read them)
        if (updatedMsg.recipient_id === currentUser.id && !updatedMsg.group_id) {
          setFriends(prev => prev.map(f => 
            f.id === updatedMsg.sender_id && f.latestMessage?.id === updatedMsg.id
              ? { ...f, latestMessage: updatedMsg }
              : f
          ))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  // Realtime listener for friend requests
  useEffect(() => {
    if (!currentUser) return
    
    const friendRequestChannel = supabase.channel(`friend-requests-listener-${currentUser.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `to_id=eq.${currentUser.id}`
      }, async (payload) => {
        const newRequest = payload.new as FriendRequest
        console.log('📬 [DEBUG] New friend request received via realtime:', newRequest)
        
        // Fetch the user who sent the request
        const { data: fromUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', newRequest.from_id)
          .single()
        
        if (fromUser) {
          setFriendRequests(prev => {
            // Check if request already exists to avoid duplicates
            const exists = prev.some(r => r.from_id === newRequest.from_id && r.to_id === newRequest.to_id)
            if (exists) {
              console.log('⚠️ [DEBUG] Friend request already exists in state, skipping')
              return prev
            }
            console.log('✅ [DEBUG] Adding friend request to state:', { from_id: newRequest.from_id, to_id: newRequest.to_id })
            return [...prev, { ...newRequest, from_user: fromUser }]
          })
        } else {
          console.error('❌ [DEBUG] Could not fetch user data for friend request sender:', newRequest.from_id)
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'friend_requests',
        filter: `to_id=eq.${currentUser.id}`
      }, (payload) => {
        const deletedRequest = payload.old as FriendRequest
        console.log('🗑️ Friend request deleted (accepted/rejected):', deletedRequest)
        
        // Remove from incoming requests
        setFriendRequests(prev => 
          prev.filter(r => !(r.from_id === deletedRequest.from_id && r.to_id === deletedRequest.to_id))
        )
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'friend_requests',
        filter: `from_id=eq.${currentUser.id}`
      }, (payload) => {
        const deletedRequest = payload.old as FriendRequest
        console.log('🗑️ Sent friend request deleted:', deletedRequest)
        
        // Don't remove from sent requests list when deleted
        // Keep it so user can see Accepted/Rejected status and clear it manually
        // The status logic will show the appropriate state (Accepted/Rejected/Pending)
        // Only remove when user explicitly clears it via the X button
        // This ensures rejected requests stay visible until user clears them
      })
      .subscribe((status) => {
        // Only log important status changes, not every SUBSCRIBED/CLOSED cycle
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [DEBUG] Friend request channel error')
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ [DEBUG] Friend request channel subscription timed out')
        }
        // Don't log SUBSCRIBED/CLOSED as they happen frequently during re-renders
      })

    // Add polling fallback in case realtime is slow or not working
    // Poll every 3 seconds to check for new friend requests
    const pollInterval = setInterval(async () => {
      console.log('🔄 [DEBUG] Polling for new friend requests (fallback)')
      try {
        const { data: latestRequests, error: pollError } = await supabase
          .from('friend_requests')
          .select('from_id, to_id')
          .eq('to_id', currentUser.id)
          .limit(1)
        
        if (!pollError && latestRequests && latestRequests.length > 0) {
          const latestRequest = latestRequests[0]
          
          // Check if we have this request in state
          const hasLatest = friendRequests.some(
            r => r.from_id === latestRequest.from_id && r.to_id === latestRequest.to_id
          )
          
          // If we don't have the latest request, refresh friend requests
          if (!hasLatest) {
            console.log('🔄 [DEBUG] Found new friend request not in state, refreshing...')
            const { data: incomingRequests, error: incomingError } = await supabase
              .from('friend_requests')
              .select('*')
              .eq('to_id', currentUser.id)
            
            if (!incomingError && incomingRequests) {
              const fromIds = incomingRequests.map(r => r.from_id)
              if (fromIds.length > 0) {
                const { data: fromUsers } = await supabase
                  .from('users')
                  .select('*')
                  .in('id', fromIds)
                
                if (fromUsers) {
                  const requestsWithUsers = incomingRequests.map(req => ({
                    ...req,
                    from_user: fromUsers.find(u => u.id === req.from_id)
                  }))
                  setFriendRequests(requestsWithUsers as any)
                  console.log('✅ [DEBUG] Friend requests refreshed via polling:', requestsWithUsers.length)
                } else {
                  setFriendRequests(incomingRequests as any)
                }
              } else {
                setFriendRequests([])
              }
            }
          }
        }
      } catch (err) {
        console.error('❌ [DEBUG] Error polling friend requests:', err)
      }
    }, 3000) // Poll every 3 seconds

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(friendRequestChannel)
    }
  }, [currentUser]) // Only depend on currentUser to avoid re-subscribing when friendRequests changes

  // Load and listen for notifications
  useEffect(() => {
    if (!currentUser) return

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('createdAt', { ascending: false })
          .limit(50)

        if (error) {
          // Check if it's a table doesn't exist error (various formats)
          const errorAny = error as any
          const errorMsg = error.message || errorAny.error?.message || JSON.stringify(error) || ''
          const errorCode = error.code || errorAny.error?.code || ''
          
          if (
            errorMsg.includes('relation') && errorMsg.includes('does not exist') ||
            errorMsg.includes('table') && errorMsg.includes('does not exist') ||
            errorCode === '42P01' || // PostgreSQL table does not exist error code
            errorMsg.includes('notifications') && errorMsg.includes('not found')
          ) {
            // Silently handle missing table - this is expected if migration hasn't run
            setNotifications([])
            setUnreadNotificationCount(0)
            return
          }
          throw error
        }

        if (data) {
          // Fetch related users for notifications that have related_user_id
          const notificationsWithUsers = await Promise.all(
            (data as Notification[]).map(async (notification) => {
              if (notification.related_user_id) {
                const { data: relatedUser, error: userError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', notification.related_user_id)
                  .single()
                
                if (relatedUser && !userError) {
                  notification.related_user = relatedUser
                }
              }
              return notification
            })
          )

          setNotifications(notificationsWithUsers)
          const unread = notificationsWithUsers.filter((n: Notification) => !n.is_read).length
          setUnreadNotificationCount(unread)
          
          // Set active rejection notification if there's an unread one and none is currently active
          // BUT: Don't set it if the user has already cleared it
          const unreadRejection = notificationsWithUsers.find(
            (n: Notification) => n.type === 'friend_request_rejected' && !n.is_read
          )
          if (unreadRejection && !activeRejectionNotification) {
            // Check if this rejection has been cleared
            const requestKey = `${currentUser.id}-${unreadRejection.related_user_id}`
            const isCleared = clearedRequestStatuses.has(requestKey)
            
            if (!isCleared) {
              setActiveRejectionNotification(unreadRejection)
            }
          }
        } else {
          // No data is fine, just set empty arrays
          setNotifications([])
          setUnreadNotificationCount(0)
        }
      } catch (err: any) {
        // Helper function to check if an error object is empty
        const isErrorObjectEmpty = (errorObj: any): boolean => {
          if (!errorObj) return true
          if (typeof errorObj === 'string') return errorObj.trim() === ''
          if (typeof errorObj !== 'object' || Array.isArray(errorObj)) return false
          
          // Check if it's an empty object
          if (Object.keys(errorObj).length === 0) return true
          
          // Try stringifying to check for empty patterns
          try {
            const stringified = JSON.stringify(errorObj)
            return stringified === '{}' ||
              stringified === '{"message":"","code":"","error":{}}' ||
              stringified === '{"message":"","code":""}' ||
              stringified === '{"error":{}}' ||
              /^\{\s*"message"\s*:\s*""\s*(,\s*"code"\s*:\s*"")?\s*(,\s*"error"\s*:\s*\{\s*\})?\s*\}$/.test(stringified) ||
              /^\{\s*"code"\s*:\s*""\s*(,\s*"message"\s*:\s*"")?\s*(,\s*"error"\s*:\s*\{\s*\})?\s*\}$/.test(stringified) ||
              /^\{\s*"error"\s*:\s*\{\s*\}\s*(,\s*"message"\s*:\s*"")?\s*(,\s*"code"\s*:\s*"")?\s*\}$/.test(stringified)
          } catch {
            // If stringify fails, check if all values are empty
            return Object.values(errorObj).every(val => 
              val === null || 
              val === undefined || 
              val === '' || 
              (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)
            )
          }
        }
        
        // Check if error is empty object or missing table error - silently handle it
        const isEmptyError = isErrorObjectEmpty(err)
        
        // Extract error information
        let errorMessage = ''
        let errorCode = ''
        
        if (err && !isEmptyError) {
          if (typeof err === 'string') {
            errorMessage = err
          } else if (err.message) {
            errorMessage = err.message
          } else if (err.error?.message) {
            errorMessage = err.error.message
          } else if (err.toString && typeof err.toString === 'function') {
            const toStringResult = err.toString()
            // Ignore generic [object Object] string
            if (toStringResult !== '[object Object]') {
              errorMessage = toStringResult
            }
          }
          
          errorCode = err.code || err.error?.code || ''
        }
        
        // Check if it's a "table doesn't exist" error - silently handle it
        const isTableMissingError = 
          isEmptyError || // Empty error object {} typically means table doesn't exist
          (errorMessage && errorMessage.includes('relation') && errorMessage.includes('does not exist')) ||
          (errorMessage && errorMessage.includes('table') && errorMessage.includes('does not exist')) ||
          errorCode === '42P01' ||
          (errorMessage && errorMessage.includes('notifications') && errorMessage.includes('not found'))
        
        if (isTableMissingError) {
          // Silently handle - table doesn't exist yet, which is expected
          setNotifications([])
          setUnreadNotificationCount(0)
          return
        }
        
        // Check if the error object we're about to log is actually empty
        const errorObjToLog = {
          message: errorMessage,
          code: errorCode,
          error: err
        }
        const isErrorObjEmpty = isErrorObjectEmpty(errorObjToLog)
        
        // Never log if it's a missing table error, empty original error, or empty error object
        if (isTableMissingError || isEmptyError || isErrorObjEmpty) {
          // Silently handle - don't log empty errors
          setNotifications([])
          setUnreadNotificationCount(0)
          return
        }
        
        // Only log if we have meaningful error information
        const hasMeaningfulError = errorMessage && errorMessage.trim() !== '' && errorMessage !== '[object Object]'
        const hasErrorCode = errorCode && errorCode.trim() !== ''
        const hasErrorObj = err && typeof err === 'object' && !Array.isArray(err) && Object.keys(err).length > 0
        
        if (hasMeaningfulError || hasErrorCode || hasErrorObj) {
          // console.error('Failed to load notifications:', errorObjToLog)
        }
        // For empty errors or missing table, silently handle - no logging
        
        // Set empty arrays on error to prevent UI issues
        setNotifications([])
        setUnreadNotificationCount(0)
      }
    }

    loadNotifications()

    // Listen for new notifications - use unique channel name per user
    const notificationChannel = supabase.channel(`notifications-listener-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, async (payload) => {
        const newNotification = payload.new as Notification
        console.log('🔔 [DEBUG] New notification received:', {
          id: newNotification.id,
          type: newNotification.type,
          user_id: newNotification.user_id,
          related_user_id: newNotification.related_user_id,
          title: newNotification.title,
          message: newNotification.message,
          is_read: newNotification.is_read,
          fullNotification: newNotification
        })

        // Fetch related user if exists
        if (newNotification.related_user_id) {
          const { data: relatedUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', newNotification.related_user_id)
            .single()

          if (relatedUser) {
            newNotification.related_user = relatedUser
          }
        }

        // Add to notifications list
        setNotifications(prev => {
          // Check if notification already exists to avoid duplicates
          const exists = prev.some(n => n.id === newNotification.id)
          if (exists) {
            console.log('⚠️ [DEBUG] Notification already in state, skipping:', newNotification.id)
            return prev
          }
          
          console.log('🔔 [DEBUG] Adding notification to state:', {
            beforeCount: prev.length,
            newNotification: {
              id: newNotification.id,
              type: newNotification.type,
              related_user_id: newNotification.related_user_id,
              hasRelatedUser: !!newNotification.related_user
            }
          })
          
          const updated = [newNotification, ...prev]
          console.log('🔔 [DEBUG] Notifications state updated:', {
            newCount: updated.length,
            allTypes: updated.map(n => n.type),
            allRelatedUserIds: updated.map(n => n.related_user_id)
          })
          return updated
        })
        setUnreadNotificationCount(prev => prev + 1)

        // Set persistent status for rejection notifications (after fetching related_user)
        if (newNotification.type === 'friend_request_rejected') {
          // Use functional update to get latest clearedRequestStatuses
          setClearedRequestStatuses(currentCleared => {
            // Check if this rejection has been cleared before setting it as active
            const requestKey = `${currentUser.id}-${newNotification.related_user_id}`
            const isCleared = currentCleared.has(requestKey)
          
            if (!isCleared) {
              setActiveRejectionNotification(newNotification)
            } else {
              console.log('🚫 [DEBUG] Skipping setting active rejection notification - already cleared:', requestKey)
            }
            
            // ALWAYS ensure the sent request stays in the list even if it was deleted from database
            // This allows the user to see the rejected status and clear it manually
            // BUT: Don't add it back if the user has already cleared it
            setSentFriendRequests(prev => {
            // Check if the sent request for this user already exists
            const requestExists = prev.some(
              r => r.to_id === newNotification.related_user_id
            )
            
            // Check if this request has been cleared by the user (already checked above, but check again for safety)
            
            // If it doesn't exist AND hasn't been cleared, add it back
            if (!requestExists && !isCleared && newNotification.related_user_id) {
              // Create a placeholder request entry to show the rejected status
              const placeholderRequest = {
                from_id: currentUser.id,
                to_id: newNotification.related_user_id,
                to_user: newNotification.related_user || null
              } as any
              
              console.log('➕ Adding rejected request back to sent requests:', placeholderRequest)
              
              // If we don't have user data yet, fetch it
              if (!newNotification.related_user && newNotification.related_user_id) {
                supabase
                  .from('users')
                  .select('*')
                  .eq('id', newNotification.related_user_id)
                  .single()
                  .then(({ data: userData }) => {
                    if (userData) {
                      setSentFriendRequests(current => 
                        current.map(r => 
                          r.to_id === newNotification.related_user_id
                            ? { ...r, to_user: userData } as any
                            : r
                        )
                      )
                    }
                  })
              }
              
              return [...prev, placeholderRequest]
            }
            
            // If it exists, make sure it has user data
            if (requestExists) {
              if (newNotification.related_user) {
                return prev.map(r => 
                  r.to_id === newNotification.related_user_id && !r.to_user
                    ? { ...r, to_user: newNotification.related_user } as any
                    : r
                )
              } else if (newNotification.related_user_id) {
                // Fetch user data if we don't have it
                supabase
                  .from('users')
                  .select('*')
                  .eq('id', newNotification.related_user_id)
                  .single()
                  .then(({ data: userData }) => {
                    if (userData) {
                      setSentFriendRequests(current => 
                        current.map(r => 
                          r.to_id === newNotification.related_user_id && !r.to_user
                            ? { ...r, to_user: userData } as any
                            : r
                        )
                      )
                    }
                  })
              }
            }
            
            return prev
          })
            
            return currentCleared // Return unchanged
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, (payload) => {
        const updatedNotification = payload.new as Notification
        setNotifications(prev =>
          prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
        )
        // Recalculate unread count
        setNotifications(prev => {
          const unread = prev.filter(n => !n.is_read).length
          setUnreadNotificationCount(unread)
          return prev
        })
      })
      .subscribe((status) => {
        // Log subscription status for debugging
        console.log('📡 [DEBUG] Notification channel subscription status:', status, 'for user:', currentUser.id)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [DEBUG] Successfully subscribed to notification channel for user:', currentUser.id)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [DEBUG] Notification channel error')
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ [DEBUG] Notification channel subscription timed out')
        } else if (status === 'CLOSED') {
          console.log('🔒 [DEBUG] Notification channel closed')
        }
      })

    // Add polling fallback in case realtime is slow or not working
    // Poll every 3 seconds to check for new notifications (more frequent for better responsiveness)
    const pollInterval = setInterval(async () => {
      try {
        // Get the latest notification ID from state to compare
        let latestKnownId = 0
        setNotifications(currentNotifications => {
          if (currentNotifications.length > 0) {
            latestKnownId = currentNotifications[0].id
          }
          return currentNotifications
        })
        
        // Fetch the latest notification from database
        const { data: latestNotifications, error: pollError } = await supabase
          .from('notifications')
          .select('id, createdAt, type, related_user_id')
          .eq('user_id', currentUser.id)
          .order('createdAt', { ascending: false })
          .limit(1)
        
        if (!pollError && latestNotifications && latestNotifications.length > 0) {
          const latestNotification = latestNotifications[0]
          const latestId = latestNotification.id
          const latestTime = new Date(latestNotification.createdAt).getTime()
          
          // Check if we have this notification in state using functional update
          let hasLatestInState = false
          let shouldRefresh = false
          
          setNotifications(currentNotifications => {
            hasLatestInState = currentNotifications.some(n => n.id === latestId)
            // If we don't have the latest notification and it's recent (within last 60 seconds), refresh
            if (!hasLatestInState && latestTime > Date.now() - 60000) {
              shouldRefresh = true
              console.log('🔄 [DEBUG] Polling found new notification not in state:', {
                latestId,
                latestKnownId: currentNotifications.length > 0 ? currentNotifications[0].id : 0,
                type: latestNotification.type,
                timeDiffSeconds: Math.round((Date.now() - latestTime) / 1000),
                createdAt: latestNotification.createdAt
              })
            }
            return currentNotifications // Return unchanged state
          })
          
          // Use a small timeout to ensure the state update callback has executed
          // Then check if we need to refresh
          if (shouldRefresh) {
            // Use setTimeout to ensure state callback has executed
            setTimeout(async () => {
              console.log('🔄 [DEBUG] Polling: Refreshing notifications...')
            
            // Check if this is a rejection notification that has been cleared
            const { data: notificationDetails } = await supabase
              .from('notifications')
              .select('type, related_user_id')
              .eq('id', latestId)
              .single()
            
            // Check if cleared using functional update
            // IMPORTANT: Even if a rejection is marked as cleared, we should still refresh
            // if we don't have notifications in state (latestKnownId: 0)
            // The cleared status only prevents showing it as "active", not loading it
            let isCleared = false
            let hasNotificationsInState = false
            
            if (notificationDetails && notificationDetails.type === 'friend_request_rejected') {
              // Check both cleared status and current notification state
              setClearedRequestStatuses(currentCleared => {
                const requestKey = `${currentUser.id}-${notificationDetails.related_user_id}`
                isCleared = currentCleared.has(requestKey)
                return currentCleared // Return unchanged
              })
              
              setNotifications(currentNotifications => {
                hasNotificationsInState = currentNotifications.length > 0
                return currentNotifications
              })
              
              // Small delay to ensure state callbacks have executed
              await new Promise(resolve => setTimeout(resolve, 10))
              
              // Only skip if it's cleared AND we already have notifications in state
              // If we have no notifications (latestKnownId: 0), we MUST refresh to load them
              if (isCleared && hasNotificationsInState) {
                console.log('🚫 [DEBUG] Polling: Rejection notification has been cleared and we have notifications, skipping refresh')
                return // Don't refresh if it's been cleared and we already have notifications
              } else if (isCleared && !hasNotificationsInState) {
                console.log('⚠️ [DEBUG] Polling: Rejection was cleared but no notifications in state (latestKnownId: 0), refreshing anyway to load notifications')
                // Continue to refresh below - we need to load notifications even if this one is cleared
              } else if (!isCleared) {
                console.log('✅ [DEBUG] Polling: Rejection notification not cleared, refreshing')
                // Continue to refresh below
              }
            }
            
            // Reload all notifications
            console.log('📥 [DEBUG] Polling: Fetching all notifications from database...')
            const { data: notificationsData, error: notifError } = await supabase
              .from('notifications')
              .select('*')
              .eq('user_id', currentUser.id)
              .order('createdAt', { ascending: false })
              .limit(50)
            
            if (notifError) {
              console.error('❌ [DEBUG] Polling: Error fetching notifications:', notifError)
              return
            }
            
            if (notificationsData) {
              console.log('✅ [DEBUG] Polling: Fetched', notificationsData.length, 'notifications')
              
              // Fetch related users
              const notificationsWithUsers = await Promise.all(
                (notificationsData as Notification[]).map(async (notification) => {
                  if (notification.related_user_id) {
                    const { data: relatedUser } = await supabase
                      .from('users')
                      .select('*')
                      .eq('id', notification.related_user_id)
                      .single()
                    
                    if (relatedUser) {
                      notification.related_user = relatedUser
                    }
                  }
                  return notification
                })
              )
              
              console.log('✅ [DEBUG] Polling: Setting notifications in state:', notificationsWithUsers.length)
              setNotifications(notificationsWithUsers)
              const unread = notificationsWithUsers.filter((n: Notification) => !n.is_read).length
              setUnreadNotificationCount(unread)
              
              // Set active rejection notification if there's an unread one (and not cleared)
              if (notificationDetails && notificationDetails.type === 'friend_request_rejected' && !isCleared) {
                const unreadRejection = notificationsWithUsers.find(
                  (n: Notification) => n.type === 'friend_request_rejected' && !n.is_read
                )
                if (unreadRejection) {
                  console.log('✅ [DEBUG] Polling: Setting active rejection notification')
                  setActiveRejectionNotification(unreadRejection)
                }
              }
            }
            }, 0) // Use setTimeout to ensure state callback has executed
          }
        }
      } catch (err) {
        // Silently handle errors in polling
      }
    }, 3000) // Poll every 3 seconds for better responsiveness

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(notificationChannel)
    }
  }, [currentUser]) // Only depend on currentUser to avoid re-subscribing when state changes

  // Load user backgrounds and selected background from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('userBackgrounds');
    if (saved) {
      try {
        setUserBackgrounds(JSON.parse(saved));
      } catch (e: any) {
        // Only log if error is meaningful (not empty)
        if (e && (
          (typeof e === 'string' && e.trim() !== '') ||
          (typeof e === 'object' && Object.keys(e).length > 0 && (e.message || e.code))
        )) {
          // console.error('Failed to load user backgrounds:', e);
        }
      }
    }
    
    const savedSelected = localStorage.getItem('selectedBackground');
    if (savedSelected) {
      setSelectedBackground(savedSelected);
    }
  }, []);
  
  // Save user backgrounds to localStorage
  useEffect(() => {
    if (userBackgrounds.length > 0) {
      localStorage.setItem('userBackgrounds', JSON.stringify(userBackgrounds));
    } else {
      localStorage.removeItem('userBackgrounds');
    }
  }, [userBackgrounds]);
  
  // Save selected background to localStorage
  useEffect(() => {
    localStorage.setItem('selectedBackground', selectedBackground);
  }, [selectedBackground]);
  
  // Handle background selection
  const handleBackgroundSelect = (backgroundId: string) => {
    setSelectedBackground(backgroundId);
  };

  // --- Initialize Profile Modal Data ---
  useEffect(() => {
    if (showProfileModal) {
      setEditNickname(currentUser.nickname || currentUser.username)
      setEditAvatarPreview(currentUser.avatar)
      setEditAvatarFile(null)
    }
  }, [showProfileModal, currentUser])

  // --- Logic ---
  const openUserSearch = async () => {
    setShowFriendModal(true)
    
    const userMode = selectedMode || 'private'
    
    // Private mode: Show all registered users in private mode
    if (userMode === 'private') {
      setReadingContacts(false)
      
      try {
        const { data: allUsers, error } = await supabase
          .from('users')
          .select('*')
          .eq('mode', 'private')
          .neq('id', currentUser.id)
        
        if (error) throw error
        
        if (allUsers) {
          const friendIds = friends.map(f => f.id)
          
          // Query database for active (pending) sent requests to show pending status
          const { data: activeSentRequests } = await supabase
            .from('friend_requests')
            .select('to_id')
            .eq('from_id', currentUser.id)
          
          const activeSentRequestIds = activeSentRequests?.map(r => r.to_id) || []
          
          // Include all non-friends (even if they have pending requests) to show pending status
          const available = allUsers.filter((u: any) => 
            !friendIds.includes(u.id)
          ) as User[]
          
          // Store pending request IDs for UI display
          ;(available as any[]).forEach((u: any) => {
            u.hasPendingRequest = activeSentRequestIds.includes(u.id)
          })
          
          setAvailableUsers(available)
        }
      } catch (err: any) {
        alert('Failed to load users: ' + err.message)
        setShowFriendModal(false)
      }
      return
    }
    
    // Public mode: Search based on SIM card contacts
    setReadingContacts(true)
    
    // First, try to read contacts from SIM card
    let contactPhoneNumbers: string[] = []
    
    try {
      // Check if Contacts API is available
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const contactsManager = (navigator as any).contacts
        const props = ['name', 'tel']
        const opts = { multiple: true }
        
        try {
          const contactsList = await contactsManager.select(props, opts)
          
          if (contactsList && contactsList.length > 0) {
            // Extract all phone numbers from contacts
            contactsList.forEach((contact: any) => {
              const phoneNumbers = contact.tel || []
              phoneNumbers.forEach((phone: string) => {
                const cleanPhone = phone.replace(/\s/g, '').replace(/[-\+\(\)]/g, '')
                if (cleanPhone && cleanPhone.length >= 7) {
                  contactPhoneNumbers.push(cleanPhone)
                }
              })
            })
          }
        } catch (err: any) {
          console.log('Could not read contacts:', err.message)
          // User might have cancelled, continue with all users
        }
      }
    } catch (err) {
      console.log('Contacts API not available:', err)
    }
    
    // Get all users from database (public mode users)
    const { data: allUsers } = await supabase
      .from('users')
      .select('*')
      .eq('mode', 'public')
      .neq('id', currentUser.id)
    
    if (allUsers) {
      const friendIds = friends.map(f => f.id)
      
      // Query database for active (pending) sent requests to show pending status
      const { data: activeSentRequests } = await supabase
        .from('friend_requests')
        .select('to_id')
        .eq('from_id', currentUser.id)
      
      const activeSentRequestIds = activeSentRequests?.map(r => r.to_id) || []
      
      let matchedUsers: User[] = []
      
      // If we have contact phone numbers, match them with users
      if (contactPhoneNumbers.length > 0) {
        matchedUsers = allUsers.filter((u: any) => {
          // Skip if already a friend (but include if has pending request to show status)
          if (friendIds.includes(u.id)) {
            return false
          }
          
          // Check if user's phone number matches any contact
          if (u.phone_number) {
            const userPhone = u.phone_number.replace(/\s/g, '').replace(/[-\+\(\)]/g, '')
            return contactPhoneNumbers.some(contactPhone => {
              // Match if phone numbers are similar (handle different formats)
              const normalizedContact = contactPhone.replace(/^\+/, '').replace(/^0/, '')
              const normalizedUser = userPhone.replace(/^\+/, '').replace(/^0/, '')
              
              // Check if one contains the other or they match (at least last 7 digits)
              const contactLast7 = normalizedContact.slice(-7)
              const userLast7 = normalizedUser.slice(-7)
              
              return contactLast7 === userLast7 || 
                     normalizedContact === normalizedUser ||
                     normalizedContact.includes(normalizedUser) || 
                     normalizedUser.includes(normalizedContact)
            })
          }
          return false
        }) as User[]
      }
      
      // If no matches found from contacts, show all non-friends in public mode
      if (matchedUsers.length === 0) {
        matchedUsers = allUsers.filter((u: any) => 
          !friendIds.includes(u.id)
        ) as User[]
      }
      
      // Mark users with pending requests for UI display
      matchedUsers.forEach((u: any) => {
        u.hasPendingRequest = activeSentRequestIds.includes(u.id)
      })
      
      setAvailableUsers(matchedUsers)
    }
    
    setReadingContacts(false)
  }

  const sendFriendRequest = async (targetUser: User) => {
    try {
      // Check if request already exists
      const { data: existing, error: existingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_id', currentUser.id)
        .eq('to_id', targetUser.id)
        .maybeSingle() // Use maybeSingle() instead of single() to handle not found gracefully
      
      if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
        if (existingError.code === '406' || existingError.message?.includes('406')) {
          console.warn('⚠️ [DEBUG] 406 error checking existing friend request (RLS or header issue):', existingError.message)
          // Continue - assume no existing request
        } else {
          console.error('❌ [DEBUG] Error checking existing friend request:', existingError)
        }
      }

      if (existing) {
        alert('Friend request already sent')
        return
      }

      const { data: newRequest, error } = await supabase
        .from('friend_requests')
        .insert({ from_id: currentUser.id, to_id: targetUser.id })
        .select()
        .single()

      if (error) throw error
      
      console.log('✅ Friend request sent successfully:', newRequest)
      
      // Update sent requests list immediately
      const requestWithUser = {
        ...newRequest,
        to_user: targetUser
      }
      setSentFriendRequests(prev => {
        const exists = prev.some(r => r.from_id === newRequest.from_id && r.to_id === newRequest.to_id)
        if (exists) return prev
        return [...prev, requestWithUser as any]
      })
      
      alert('Friend request sent!')
      setShowFriendModal(false)
      fetchData()
    } catch (err: any) {
      // console.error('Failed to send friend request:', err)
      alert('Failed to send friend request: ' + err.message)
    }
  }

  const approveFriendRequest = async (request: FriendRequest) => {
    try {
      // Add both directions of friendship
      await supabase.from('friends').insert([
        { user_id: currentUser.id, friend_id: request.from_id },
        { user_id: request.from_id, friend_id: currentUser.id }
      ])

      // Remove the friend request
      await supabase
        .from('friend_requests')
        .delete()
        .eq('from_id', request.from_id)
        .eq('to_id', currentUser.id)

      fetchData()
      alert('Friend request approved!')
    } catch (err: any) {
      alert('Failed to approve request: ' + err.message)
    }
  }

  const rejectFriendRequest = async (request: FriendRequest) => {
    try {
      console.log('🚫 [DEBUG] Rejecting friend request:', {
        request_from_id: request.from_id,
        request_to_id: request.to_id,
        currentUser_id: currentUser.id,
        currentUser_username: currentUser.username
      })
      
      // Delete the friend request
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('from_id', request.from_id)
        .eq('to_id', currentUser.id)

      if (deleteError) {
        console.error('❌ [DEBUG] Error deleting friend request:', deleteError)
      } else {
        console.log('✅ [DEBUG] Friend request deleted successfully')
      }

      // Create a notification for the requestor
      const notificationData = {
        user_id: request.from_id,
        type: 'friend_request_rejected',
        title: 'Friend Request Rejected',
        message: `${currentUser.nickname || currentUser.username} rejected your friend request.`,
        related_user_id: currentUser.id,
        is_read: false
      }
      
      console.log('📝 [DEBUG] Creating rejection notification:', notificationData)
      
      const { data: notificationResult, error: notifError } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single()

      if (notifError) {
        console.error('❌ [DEBUG] Failed to create rejection notification:', {
          error: notifError,
          code: notifError.code,
          message: notifError.message,
          details: notifError.details,
          hint: notifError.hint
        })
        alert('Failed to create rejection notification: ' + notifError.message)
      } else if (notificationResult) {
        console.log('✅ [DEBUG] Notification created successfully:', notificationResult)
        console.log('📋 [DEBUG] Notification recipient user_id:', notificationResult.user_id, 'Current user_id:', currentUser.id)
        
        // Note: The notification is for request.from_id (the person who sent the request)
        // If that's the current user, we can immediately add it to state
        // Otherwise, we need to wait for realtime or refresh
        if (notificationResult.user_id === currentUser.id) {
          console.log('➕ [DEBUG] Notification is for current user, adding to state immediately')
          
          // Fetch related user data
          if (notificationResult.related_user_id) {
            const { data: relatedUser } = await supabase
              .from('users')
              .select('*')
              .eq('id', notificationResult.related_user_id)
              .single()
            
            if (relatedUser) {
              (notificationResult as any).related_user = relatedUser
            }
          }
          
          // Add to notifications state
          setNotifications(prev => {
            const exists = prev.some(n => n.id === notificationResult.id)
            if (exists) {
              console.log('⚠️ [DEBUG] Notification already in state, skipping')
              return prev
            }
            console.log('✅ [DEBUG] Adding notification to state:', notificationResult)
            return [notificationResult as Notification, ...prev]
          })
          setUnreadNotificationCount(prev => prev + 1)
          
          // Set active rejection notification
          if (notificationResult.type === 'friend_request_rejected') {
            setActiveRejectionNotification(notificationResult as Notification)
            
            // Ensure the sent request stays in the list
            setSentFriendRequests(prev => {
              const requestExists = prev.some(
                r => r.to_id === notificationResult.related_user_id
              )
              
              if (!requestExists && notificationResult.related_user_id && (notificationResult as any).related_user) {
                const placeholderRequest = {
                  from_id: currentUser.id,
                  to_id: notificationResult.related_user_id,
                  to_user: (notificationResult as any).related_user
                } as any
                
                console.log('➕ [DEBUG] Adding rejected request back to sent requests:', placeholderRequest)
                return [...prev, placeholderRequest]
              }
              
              return prev
            })
          }
        } else {
          console.log('⏳ [DEBUG] Notification is for another user (user_id:', notificationResult.user_id, '), will be received via realtime listener')
          // The notification is for someone else, so we don't need to update our state
          // The realtime listener on that user's client should catch it
          // Verify the notification was created correctly
          const { data: verifyNotification } = await supabase
            .from('notifications')
            .select('*')
            .eq('id', notificationResult.id)
            .single()
          
          if (verifyNotification) {
            console.log('✅ [DEBUG] Notification verified in database:', {
              id: verifyNotification.id,
              user_id: verifyNotification.user_id,
              type: verifyNotification.type,
              related_user_id: verifyNotification.related_user_id
            })
          } else {
            console.error('❌ [DEBUG] Notification not found in database after creation!')
          }
        }
      }
      
      // Note: The notification is for request.from_id (the person who sent the request)
      // If that's the current user, we've already added it to state above
      // If not, the realtime listener should catch it, but we can't manually refresh for another user
      console.log('📋 [DEBUG] Notification creation complete. Notification user_id:', notificationResult?.user_id, 'Current user_id:', currentUser.id)

      // Don't call fetchData() immediately - let the realtime notification handler
      // add the request back to the list. This prevents race conditions where
      // fetchData() might clear the request before the notification is processed.
      // The notification handler will ensure the request stays visible.
      
      // Only refresh friend requests (incoming), not sent requests
      const { data: incomingRequests } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_id', currentUser.id)
      
      if (incomingRequests) {
        const fromIds = incomingRequests.map(r => r.from_id)
        if (fromIds.length > 0) {
          const { data: fromUsers } = await supabase
            .from('users')
            .select('*')
            .in('id', fromIds)
          
          if (fromUsers) {
            const requestsWithUsers = incomingRequests.map(req => ({
              ...req,
              from_user: fromUsers.find(u => u.id === req.from_id)
            }))
            setFriendRequests(requestsWithUsers as any)
          } else {
            setFriendRequests(incomingRequests as any)
          }
        } else {
          setFriendRequests([])
        }
      }
    } catch (err: any) {
      alert('Failed to reject request: ' + err.message)
    }
  }

  const searchUserByPhone = async (phoneNumber: string) => {
    if (!phoneNumber.trim()) return
    
    const userMode = selectedMode || 'private'
    
    try {
      let query = supabase
        .from('users')
        .select('*')
        .ilike('phone_number', `%${phoneNumber.replace(/\s/g, '')}%`)
        .neq('id', currentUser.id)
      
      // Filter by mode: public users can only search public users, private users can only search private users
      query = query.eq('mode', userMode)
      
      const { data, error } = await query

      if (error) throw error

      if (data && data.length > 0) {
        const friendIds = friends.map(f => f.id)
        
        // Query database for active (pending) sent requests to show pending status
        const { data: activeSentRequests } = await supabase
          .from('friend_requests')
          .select('to_id')
          .eq('from_id', currentUser.id)
        
        const activeSentRequestIds = activeSentRequests?.map(r => r.to_id) || []
        
        // Include all non-friends (even if they have pending requests) to show pending status
        const available = data.filter((u: any) => 
          !friendIds.includes(u.id)
        )
        
        // Mark users with pending requests for UI display
        available.forEach((u: any) => {
          u.hasPendingRequest = activeSentRequestIds.includes(u.id)
        })
        
        setAvailableUsers(available as User[])
        setShowFriendModal(true)
      } else {
        alert(`No ${userMode} mode user found with that phone number`)
      }
    } catch (err: any) {
      alert('Failed to search: ' + err.message)
    }
  }

  const handleContactSelect = (phoneNumber: string) => {
    setSearchPhoneNumber(phoneNumber)
    searchUserByPhone(phoneNumber)
    setShowContactsReader(false)
  }

  const toggleFriendSelection = (friendId: number) => {
    setSelectedFriendIds(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    )
  }

  const finalizeCreateGroup = async () => {
    if (!newGroupName.trim()) return alert("Please enter a group name")
    
    const { data: newGroup, error } = await supabase.from('groups').insert({ name: newGroupName, admin_id: currentUser.id }).select().single()
    if (error || !newGroup) return alert("Failed to create group")

    const members = [
      { group_id: newGroup.id, user_id: currentUser.id },
      ...selectedFriendIds.map(fid => ({ group_id: newGroup.id, user_id: fid }))
    ]
    await supabase.from('group_members').insert(members)
    setShowGroupModal(false)
    setNewGroupName('')
    setSelectedFriendIds([])
    fetchData()
    onSelect(newGroup, true)
  }

  const deleteGroup = async (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Delete group?")) return
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (!error) fetchData()
  }

  // --- UPDATE PROFILE LOGIC ---
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEditAvatarFile(file)
      setEditAvatarPreview(URL.createObjectURL(file))
    }
  }

  const saveProfile = async () => {
    setIsUpdating(true)
    let finalAvatarUrl = currentUser.avatar

    try {
      // 1. Upload new image if selected
      if (editAvatarFile) {
        const formData = new FormData()
        formData.append('file', editAvatarFile)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData })
        const data = await res.json()
        if (data.secure_url) finalAvatarUrl = data.secure_url
      }

      // 2. Update Supabase
      const { data, error } = await supabase
        .from('users')
        .update({ nickname: editNickname, avatar: finalAvatarUrl })
        .eq('id', currentUser.id)
        .select()
        .single()

      if (error) throw error

      // 3. Update Parent State & Close
      if (data) {
        onUpdateUser(data as User)
        setShowProfileModal(false)
      }
    } catch (error) {
      // console.error(error)
      alert("Failed to update profile")
    } finally {
      setIsUpdating(false)
    }
  }
  
  // Handle background image upload
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newBackground = {
        id: `user-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        url: url
      };
      setUserBackgrounds(prev => [...prev, newBackground]);
    };
    reader.onerror = () => {
      alert('Failed to read image file');
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (backgroundFileInputRef.current) {
      backgroundFileInputRef.current.value = '';
    }
  };
  
  // Delete user background
  const deleteUserBackground = (id: string) => {
    setUserBackgrounds(prev => prev.filter(bg => bg.id !== id));
  };

  return (
    <div className="w-full md:w-80 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      {/* Current User Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img src={currentUser.avatar} className="w-12 h-12 rounded-full border-2 border-green-500 object-cover" />
            <div>
              <h3 className="font-bold text-white max-w-[120px] truncate">{currentUser.nickname || currentUser.username}</h3>
              <span className="text-xs text-green-400">Online</span>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Home Button - Back to Launcher */}
            {onBackToLauncher && (
              <button 
                onClick={onBackToLauncher}
                className="p-2 text-slate-300 hover:text-blue-400 hover:bg-slate-700 rounded-full transition-colors"
                title="Back to Apps"
              >
                <Home size={20} />
              </button>
            )}
            
            {/* Settings Button */}
            <button 
              onClick={() => setShowProfileModal(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
              title="Edit Profile"
            >
              <Settings size={20} />
            </button>
            
            {/* Logout Button */}
            <button 
              onClick={onLogout}
              className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        {/* Mode Selection */}
        <div className="mt-3">
          <label className="block text-xs font-medium mb-2 text-gray-400">Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('public')}
              disabled={!currentUser.phone_number}
              className={`p-2 rounded text-xs font-semibold transition-all ${
                selectedMode === 'public'
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500'
              } ${!currentUser.phone_number ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={!currentUser.phone_number ? 'Phone number required for public mode' : 'Switch to public mode'}
            >
              🌐 Public
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('private')}
              className={`p-2 rounded text-xs font-semibold transition-all ${
                selectedMode === 'private'
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500'
              }`}
              title="Switch to private mode"
            >
              🔒 Private
            </button>
          </div>
          {selectedMode === 'public' && (
            <p className="text-xs text-blue-300 mt-1">Finding friends from contacts</p>
          )}
          {selectedMode === 'private' && (
            <p className="text-xs text-gray-400 mt-1">Seeing all private users</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-2 bg-slate-800 border-b border-slate-700">
        <button onClick={() => setView('friends')} className={`flex-1 p-2 rounded text-sm flex items-center justify-center gap-2 ${view === 'friends' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
          <Users size={16} /> Friends
        </button>
        <button onClick={() => setView('requests')} className={`flex-1 p-2 rounded text-sm flex items-center justify-center gap-2 relative ${view === 'requests' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
          <Bell size={16} /> Requests
          {(friendRequests.length > 0 || unreadNotificationCount > 0) && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {friendRequests.length + unreadNotificationCount}
            </span>
          )}
        </button>
        <button onClick={() => setView('groups')} className={`flex-1 p-2 rounded text-sm flex items-center justify-center gap-2 ${view === 'groups' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
          <MessageSquare size={16} /> Groups
        </button>
        <button 
          onClick={() => fetchData()} 
          disabled={isRefreshing}
          className="p-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>


      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {view === 'friends' ? (
          <>
             <div className="flex gap-2 mb-3">
               <button onClick={openUserSearch} className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 p-2 rounded flex items-center justify-center gap-2 transition-colors">
                 <UserPlus size={16} /> Find Friends
               </button>
               {selectedMode === 'public' && (
                 <button onClick={() => setShowContactsReader(true)} className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 p-2 rounded flex items-center justify-center gap-2 transition-colors" title="Read from Contacts">
                   <Phone size={16} />
                 </button>
               )}
             </div>
             {friends.length === 0 ? (
               <div className="text-center py-8 text-slate-400 text-sm">
                 <p>No friends yet. Click "Find New Friends" to add some!</p>
               </div>
             ) : (
               friends.map(f => {
                 const latestMsg = f.latestMessage
                 
                 // Debug: Log what we're rendering
                 if (latestMsg) {
                   console.log(`🎨 Rendering friend ${f.username} with message:`, latestMsg.content?.substring(0, 30), 'is_read:', latestMsg.is_read, 'sender_id:', latestMsg.sender_id, 'currentUser.id:', currentUser.id)
                 }
                 
                 const getMessagePreview = () => {
                   if (!latestMsg) {
                     console.log(`⚠️ No latest message for ${f.username}`)
                     return null
                   }
                   const isFromMe = latestMsg.sender_id === currentUser.id
                   const prefix = isFromMe ? 'You: ' : ''
                   if (latestMsg.type === 'image') return `${prefix}📷 Image`
                   if (latestMsg.type === 'file') return `${prefix}📎 ${latestMsg.content || 'File'}`
                   const content = latestMsg.content || ''
                   console.log(`📝 Preview for ${f.username}:`, content.substring(0, 30))
                   return `${prefix}${content}`
                 }
                 const preview = getMessagePreview()
                 const isLatestFromMe = latestMsg && latestMsg.sender_id === currentUser.id
                 
                 return (
                   <div key={f.id} onClick={() => onSelect(f, false)} className="p-3 hover:bg-slate-700 rounded-lg cursor-pointer flex items-center gap-3 transition-colors">
                     <img src={f.avatar} className="w-10 h-10 rounded-full bg-slate-600 object-cover flex-shrink-0" />
                     <div className="flex-1 min-w-0 overflow-hidden">
                       <div className="flex items-center justify-between gap-2 mb-0.5">
                         <p className="text-slate-100 font-medium truncate">{f.nickname || f.username}</p>
                         {latestMsg && (
                           <div className="flex-shrink-0 ml-1 flex items-center" title={isLatestFromMe ? (latestMsg.is_read ? 'Read' : 'Sent') : (latestMsg.is_read ? 'You read it' : 'Unread')}>
                             {isLatestFromMe ? (
                               // Read status for messages sent by current user
                               latestMsg.is_read === true ? (
                                 // Two ticks green: sent and read
                                 <div className="flex items-center">
                                   <Check size={12} className="text-green-500" />
                                   <Check size={12} className="text-green-500 -ml-1" />
                                 </div>
                               ) : (
                                 // Two ticks red: sent but not read (is_read is false or undefined)
                                 <div className="flex items-center">
                                   <Check size={12} className="text-red-500" />
                                   <Check size={12} className="text-red-500 -ml-1" />
                                 </div>
                               )
                             ) : (
                               // Read status for messages received by current user
                               latestMsg.is_read === true ? (
                                 // Two ticks green: you have read it
                                 <div className="flex items-center">
                                   <Check size={12} className="text-green-500" />
                                   <Check size={12} className="text-green-500 -ml-1" />
                                 </div>
                               ) : (
                                 // Two ticks red: unread (you haven't read it yet)
                                 <div className="flex items-center">
                                   <Check size={12} className="text-red-500" />
                                   <Check size={12} className="text-red-500 -ml-1" />
                                 </div>
                               )
                             )}
                           </div>
                         )}
                       </div>
                       {preview ? (
                         <p className="text-xs text-slate-300 truncate block" title={preview}>{preview}</p>
                       ) : (
                         <p className="text-xs text-slate-400 truncate block">@{f.username}</p>
                       )}
                     </div>
                   </div>
                 )
               })
             )}
          </>
        ) : view === 'requests' ? (
          <>
            <div className="space-y-4">
              {/* Incoming Requests */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2 px-2">Incoming Requests</h3>
                {friendRequests.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    <p>No incoming friend requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendRequests.map((request) => {
                      const fromUser = (request as any).from_user as User
                      if (!fromUser) return null
                      return (
                        <div key={`${request.from_id}-${request.to_id}`} className="p-3 bg-slate-700 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img src={fromUser.avatar} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-100 font-medium truncate">{fromUser.nickname || fromUser.username}</p>
                              <p className="text-xs text-slate-400 truncate">@{fromUser.username}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => approveFriendRequest(request)}
                              className="p-2 bg-green-600 hover:bg-green-500 rounded text-white"
                              title="Accept"
                            >
                              <UserCheck size={16} />
                            </button>
                            <button
                              onClick={() => rejectFriendRequest(request)}
                              className="p-2 bg-red-600 hover:bg-red-500 rounded text-white"
                              title="Reject"
                            >
                              <UserX size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notifications */}
              {notifications.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-sm font-semibold text-slate-300">Notifications</h3>
                    <button
                      onClick={async () => {
                        if (confirm('Clear all notifications?')) {
                          // Mark all as read in database
                          await supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('user_id', currentUser.id)
                            .eq('is_read', false)
                          
                          // Clear from state
                          setNotifications([])
                          setUnreadNotificationCount(0)
                          setActiveRejectionNotification(null)
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      title="Clear all notifications"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.map((notification) => {
                      const relatedUser = notification.related_user
                      return (
                        <div 
                          key={notification.id} 
                          className={`p-3 rounded-lg flex items-center gap-3 ${notification.is_read ? 'bg-slate-700/50' : 'bg-slate-700'} ${!notification.is_read ? 'border-l-4 border-blue-500' : ''}`}
                        >
                          {relatedUser && (
                            <img src={relatedUser.avatar} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-100 font-medium text-sm">{notification.title}</p>
                            {notification.message && (
                              <p className="text-xs text-slate-400 truncate">{notification.message}</p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.is_read && (
                              <button
                                onClick={async () => {
                                  await supabase
                                    .from('notifications')
                                    .update({ is_read: true })
                                    .eq('id', notification.id)
                                  setNotifications(prev =>
                                    prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                                  )
                                  setUnreadNotificationCount(prev => Math.max(0, prev - 1))
                                  
                                  // Clear active rejection notification if this is it
                                  if (activeRejectionNotification?.id === notification.id) {
                                    setActiveRejectionNotification(null)
                                  }
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300"
                                title="Mark as read"
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                // Delete from database
                                await supabase
                                  .from('notifications')
                                  .delete()
                                  .eq('id', notification.id)
                                
                                // Remove from state
                                setNotifications(prev => prev.filter(n => n.id !== notification.id))
                                
                                // Update unread count if it was unread
                                if (!notification.is_read) {
                                  setUnreadNotificationCount(prev => Math.max(0, prev - 1))
                                }
                                
                                // Clear active rejection notification if this is it
                                if (activeRejectionNotification?.id === notification.id) {
                                  setActiveRejectionNotification(null)
                                }
                              }}
                              className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-600/50"
                              title="Clear notification"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setShowGroupModal(true)} className="w-full mb-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 p-2 rounded flex items-center justify-center gap-2 transition-colors">
              <Plus size={16} /> Create Group
            </button>
            {groups.map(g => {
              const latestMsg = g.latestMessage
              const getMessagePreview = () => {
                if (!latestMsg) return null
                if (latestMsg.type === 'image') return '📷 Image'
                if (latestMsg.type === 'file') return `📎 ${latestMsg.content || 'File'}`
                return latestMsg.content || ''
              }
              const preview = getMessagePreview()
              
              return (
                <div key={g.id} onClick={() => onSelect(g, true)} className="group p-3 hover:bg-slate-700 rounded-lg cursor-pointer flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">{g.name[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-100 font-medium truncate">{g.name}</span>
                        {latestMsg && (
                          <div className="flex-shrink-0 flex items-center">
                            {latestMsg.sender_id === currentUser.id ? (
                              // Read status for messages sent by current user in group
                              latestMsg.is_read === true ? (
                                // Two ticks green: sent and read
                                <div className="flex items-center">
                                  <Check size={12} className="text-green-500" />
                                  <Check size={12} className="text-green-500 -ml-1" />
                                </div>
                              ) : (
                                // Two ticks red: sent but not read
                                <div className="flex items-center">
                                  <Check size={12} className="text-red-500" />
                                  <Check size={12} className="text-red-500 -ml-1" />
                                </div>
                              )
                            ) : (
                              // Read status for messages received by current user in group
                              latestMsg.is_read === true ? (
                                // Two ticks green: you have read it
                                <div className="flex items-center">
                                  <Check size={12} className="text-green-500" />
                                  <Check size={12} className="text-green-500 -ml-1" />
                                </div>
                              ) : (
                                // Two ticks red: unread
                                <div className="flex items-center">
                                  <Check size={12} className="text-red-500" />
                                  <Check size={12} className="text-red-500 -ml-1" />
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      {preview && (
                        <p className="text-xs text-slate-300 truncate mt-0.5">{preview}</p>
                      )}
                    </div>
                  </div>
                  {g.admin_id === currentUser.id && (
                    <button onClick={(e) => deleteGroup(g.id, e)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* --- PROFILE EDIT MODAL --- */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-sm rounded-xl border border-slate-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 flex-shrink-0">
              <h3 className="text-white font-bold text-lg">Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-300 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto flex-1 min-h-0">
              {/* Avatar Upload */}
              <div className="relative group cursor-pointer">
                <img src={editAvatarPreview} className="w-32 h-32 rounded-full object-cover border-4 border-slate-700 group-hover:opacity-50 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white" size={32} />
                </div>
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept="image/*"
                  onChange={handleAvatarSelect}
                />
              </div>
              
              <div className="w-full space-y-2">
                <label className="text-xs text-slate-300 uppercase font-bold">Nickname</label>
                <input 
                  className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  value={editNickname}
                  onChange={e => setEditNickname(e.target.value)}
                  placeholder="Enter nickname"
                />
              </div>

              <div className="w-full space-y-2">
                <label className="text-xs text-slate-400 uppercase font-bold">Username</label>
                 <input 
                  className="w-full bg-slate-700/50 text-slate-400 p-3 rounded-lg border border-slate-600 cursor-not-allowed"
                  value={currentUser.username}
                  disabled
                  title="Username cannot be changed"
                />
              </div>
              
              {/* Video Call Backgrounds Section */}
              <div className="w-full space-y-3 border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 uppercase font-bold">Video Call Backgrounds</label>
                  <button
                    onClick={() => backgroundFileInputRef.current?.click()}
                    className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded flex items-center gap-1.5 text-white transition-colors"
                  >
                    <Upload size={14} />
                    Upload
                  </button>
                </div>
                
                <input
                  ref={backgroundFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />
                
                {userBackgrounds.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto overscroll-contain">
                    {userBackgrounds.map(bg => (
                      <div key={bg.id} className="relative group">
                        <div className="aspect-video bg-slate-700 rounded-lg overflow-hidden border border-slate-600">
                          <img 
                            src={bg.url} 
                            alt={bg.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => deleteUserBackground(bg.id)}
                          className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <X size={12} className="text-white" />
                        </button>
                        <p className="text-xs text-slate-300 mt-1 truncate">{bg.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {userBackgrounds.length === 0 && (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    <ImageIcon size={24} className="mx-auto mb-2 opacity-50" />
                    <p>No custom backgrounds yet</p>
                    <p className="text-xs mt-1">Upload images to use as video call backgrounds</p>
                  </div>
                )}
                
                {/* Background Selection */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs text-slate-300 uppercase font-bold">Select Background</label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto overscroll-contain">
                    {getAllBackgrounds().map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => handleBackgroundSelect(bg.id)}
                        className={`relative p-2 rounded-lg border-2 transition-colors ${
                          selectedBackground === bg.id 
                            ? 'border-blue-500 bg-blue-600/20' 
                            : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {bg.id === 'none' ? (
                          <div className="aspect-video bg-slate-800 rounded flex items-center justify-center">
                            <span className="text-xs text-slate-300">None</span>
                          </div>
                        ) : bg.id === 'blur' ? (
                          <div className="aspect-video bg-gradient-to-br from-slate-600 to-slate-800 rounded flex items-center justify-center">
                            <span className="text-xs text-slate-300">Blur</span>
                          </div>
                        ) : (
                          <div className="aspect-video bg-slate-700 rounded overflow-hidden">
                            <img 
                              src={bg.url || ''} 
                              alt={bg.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <p className="text-xs text-slate-300 mt-1 truncate text-center">{bg.name}</p>
                        {selectedBackground === bg.id && (
                          <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-1">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800 flex-shrink-0">
              <button 
                onClick={saveProfile} 
                disabled={isUpdating}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- OTHER MODALS (Friend / Group) --- */}
      {showFriendModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-md rounded-xl border border-slate-600 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Find Friends</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedMode === 'public' 
                    ? '🌐 Public Mode: Search from your contacts' 
                    : '🔒 Private Mode: All private users'}
                </p>
              </div>
              <button onClick={() => setShowFriendModal(false)} className="text-slate-300 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 border-b border-slate-700">
              <div className="flex gap-2">
                <input
                  type="tel"
                  className="flex-1 bg-slate-700 text-white p-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                  placeholder={selectedMode === 'public' ? 'Search by phone number...' : 'Search private users...'}
                  value={searchPhoneNumber}
                  onChange={e => setSearchPhoneNumber(e.target.value)}
                />
                <button
                  onClick={() => searchUserByPhone(searchPhoneNumber)}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {readingContacts ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-slate-400 text-sm">Reading contacts from SIM card...</p>
                  <p className="text-slate-500 text-xs mt-2">Please allow access to your contacts</p>
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {selectedMode === 'public' ? (
                    <>
                      <p>No users found from your contacts.</p>
                      <p className="text-xs mt-2">Try searching by phone number or check if your contacts have registered accounts.</p>
                    </>
                  ) : (
                    <>
                      <p>No private users found.</p>
                      <p className="text-xs mt-2">All registered private mode users are already your friends or have pending requests.</p>
                    </>
                  )}
                </div>
              ) : (
                availableUsers.map(u => {
                  const hasPendingRequest = (u as any).hasPendingRequest || false
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 hover:bg-slate-700 rounded-lg group">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="text-white font-medium">{u.nickname || u.username}</p>
                          {u.phone_number && (
                            <p className="text-xs text-slate-400">{u.phone_number}</p>
                          )}
                        </div>
                      </div>
                      {hasPendingRequest ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-600 text-slate-300">
                          <span className="text-xs font-medium">Pending</span>
                        </div>
                      ) : (
                        <button onClick={() => sendFriendRequest(u)} className="bg-blue-600 p-2 rounded-full text-white hover:bg-blue-500"><UserPlus size={18} /></button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showContactsReader && (
        <ContactsReader
          currentUser={currentUser}
          onSelectContact={handleContactSelect}
          onClose={() => setShowContactsReader(false)}
        />
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-md rounded-xl border border-slate-600 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <h3 className="text-white font-bold text-lg">Create New Group</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-300 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto">
              <input className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 mb-6" placeholder="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <label className="block text-xs text-gray-400 mb-2 uppercase font-bold">Select Members</label>
              <div className="space-y-1">
                {friends.map(f => {
                  const isSelected = selectedFriendIds.includes(f.id)
                  return (
                    <div key={f.id} onClick={() => toggleFriendSelection(f.id)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-900/30 border border-blue-600/50' : 'hover:bg-gray-800 border border-transparent'}`}>
                      <div className="flex items-center gap-3"><img src={f.avatar} className="w-10 h-10 rounded-full" /><span className={`font-medium ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{f.nickname || f.username}</span></div>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900">
              <button onClick={finalizeCreateGroup} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg">Create Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
