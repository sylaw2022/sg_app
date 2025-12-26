'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/types'
import { Shield, Trash2, Search, X, ArrowLeft, Users as UsersIcon, UserX, Edit2, Eye, EyeOff } from 'lucide-react'

interface AdminDashboardProps {
  currentUser: User
  onBack: () => void
  onLogout: () => void
}

export default function AdminDashboard({ currentUser, onBack, onLogout }: AdminDashboardProps) {
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: number; username: string } | null>(null)
  const [showEditAdmin, setShowEditAdmin] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editConfirmPassword, setEditConfirmPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      alert('Access denied. Admin privileges required.')
      onBack()
      return
    }
    fetchAllUsers()
    // Initialize edit form with current admin username
    setEditUsername(currentUser.username)
  }, [currentUser])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(allUsers)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredUsers(
        allUsers.filter(
          user =>
            user.username.toLowerCase().includes(query) ||
            user.nickname.toLowerCase().includes(query) ||
            (user.phone_number && user.phone_number.includes(query))
        )
      )
    }
  }, [searchQuery, allUsers])

  const fetchAllUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) throw error
      setAllUsers(data || [])
      setFilteredUsers(data || [])
    } catch (err: any) {
      alert('Failed to fetch users: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: number, username: string) => {
    console.log('handleDeleteUser called with:', { userId, username })
    // Show custom confirmation modal
    setDeleteConfirmUser({ id: userId, username })
    setShowDeleteConfirm(userId)
  }

  const confirmDeleteUser = async () => {
    if (!deleteConfirmUser) return
    
    const { id: userId, username } = deleteConfirmUser
    setShowDeleteConfirm(null)
    setDeletingUserId(userId)
    try {
      console.log('Attempting to delete user:', userId, username)
      
      // First, delete related records manually to ensure they're removed
      // (CASCADE should handle this, but doing it explicitly for safety)
      
      // Delete friend requests
      const { error: frError } = await supabase
        .from('friend_requests')
        .delete()
        .or(`from_id.eq.${userId},to_id.eq.${userId}`)
      if (frError) console.warn('Error deleting friend requests:', frError)
      
      // Delete friends relationships
      const { error: friendsError } = await supabase
        .from('friends')
        .delete()
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      if (friendsError) console.warn('Error deleting friends:', friendsError)
      
      // Delete group memberships
      const { error: gmError } = await supabase
        .from('group_members')
        .delete()
        .eq('user_id', userId)
      if (gmError) console.warn('Error deleting group members:', gmError)
      
      // Delete groups where user is admin
      const { error: groupsError } = await supabase
        .from('groups')
        .delete()
        .eq('admin_id', userId)
      if (groupsError) console.warn('Error deleting groups:', groupsError)
      
      // Delete messages
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      if (msgError) console.warn('Error deleting messages:', msgError)
      
      // Delete OTP verifications
      const { data: userData } = await supabase
        .from('users')
        .select('phone_number')
        .eq('id', userId)
        .single()
      
      if (userData?.phone_number) {
        const { error: otpError } = await supabase
          .from('otp_verifications')
          .delete()
          .eq('phone_number', userData.phone_number)
        if (otpError) console.warn('Error deleting OTP verifications:', otpError)
      }
      
      // Finally, delete the user
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .select()

      if (error) {
        console.error('Delete user error details:', error)
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        throw error
      }

      console.log('User deleted successfully:', data)

      // Refresh user list
      await fetchAllUsers()
      alert('User deleted successfully')
    } catch (err: any) {
      console.error('Delete user error:', err)
      const errorMessage = err.message || err.details || err.hint || 'Unknown error occurred'
      alert(`Failed to delete user: ${errorMessage}\n\nError Code: ${err.code || 'N/A'}\n\nCheck browser console for more details.`)
    } finally {
      setDeletingUserId(null)
      setShowDeleteConfirm(null)
      setDeleteConfirmUser(null)
    }
  }

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(null)
    setDeleteConfirmUser(null)
  }

  const handleEditAdmin = () => {
    setEditUsername(currentUser.username)
    setEditPassword('')
    setEditConfirmPassword('')
    setShowEditAdmin(true)
  }

  const handleSaveAdmin = async () => {
    if (!editUsername || !editUsername.trim()) {
      alert('Username cannot be empty')
      return
    }

    // If password is provided, validate it
    if (editPassword) {
      if (editPassword.length < 6) {
        alert('Password must be at least 6 characters')
        return
      }
      if (editPassword !== editConfirmPassword) {
        alert('Passwords do not match')
        return
      }
    }

    // Check if new username already exists (and is not the current admin)
    if (editUsername.trim() !== currentUser.username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', editUsername.trim())
        .single()

      if (existingUser) {
        alert('Username already exists. Please choose a different username.')
        return
      }
    }

    setSavingAdmin(true)
    try {
      const updateData: any = {
        username: editUsername.trim()
      }

      // Only update password if provided
      if (editPassword && editPassword.trim()) {
        updateData.password = editPassword.trim() // In production, hash this!
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', currentUser.id)

      if (error) throw error

      // Refresh user list to show updated username
      await fetchAllUsers()
      
      setShowEditAdmin(false)
      setEditPassword('')
      setEditConfirmPassword('')
      
      alert('Admin credentials updated successfully! Please log in again with your new credentials.')
      
      // Log out the user so they can log in with new credentials
      setTimeout(() => {
        onLogout()
      }, 1000)
    } catch (err: any) {
      alert('Failed to update admin credentials: ' + err.message)
    } finally {
      setSavingAdmin(false)
    }
  }

  const cancelEditAdmin = () => {
    setShowEditAdmin(false)
    setEditUsername(currentUser.username)
    setEditPassword('')
    setEditConfirmPassword('')
  }

  const handleDeregister = async () => {
    if (!confirm('Are you sure you want to de-register your account? This action cannot be undone.')) {
      return
    }

    try {
      const userId = currentUser.id
      
      // Delete related records first
      await supabase.from('friend_requests').delete().or(`from_id.eq.${userId},to_id.eq.${userId}`)
      await supabase.from('friends').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      await supabase.from('group_members').delete().eq('user_id', userId)
      await supabase.from('groups').delete().eq('admin_id', userId)
      await supabase.from('messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      
      if (currentUser.phone_number) {
        await supabase.from('otp_verifications').delete().eq('phone_number', currentUser.phone_number)
      }
      
      // Delete the user
      const { error } = await supabase.from('users').delete().eq('id', userId)

      if (error) {
        console.error('Deregister error:', error)
        throw error
      }

      alert('Your account has been de-registered successfully')
      onLogout()
    } catch (err: any) {
      console.error('Deregister error:', err)
      const errorMessage = err.message || err.details || 'Unknown error occurred'
      alert(`Failed to de-register: ${errorMessage}\n\nCheck console for details.`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleEditAdmin}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Admin</span>
            </button>
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <button
              onClick={handleDeregister}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded transition"
            >
              <UserX className="h-4 w-4" />
              <span>De-register</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Search */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <UsersIcon className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-semibold">Total Users: {allUsers.length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">
                Admins: {allUsers.filter(u => u.role === 'admin').length} | 
                Regular Users: {allUsers.filter(u => u.role === 'user').length}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by username, nickname, or phone number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Username</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {searchQuery ? 'No users found matching your search' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-700/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <img
                            src={user.avatar}
                            alt={user.nickname}
                            className="w-10 h-10 rounded-full"
                          />
                          <span className="font-medium">{user.nickname || user.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{user.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {user.phone_number || <span className="text-gray-500">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {user.id !== currentUser.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDeleteUser(user.id, user.username)
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              console.log('🔴 Delete button mousedown')
                            }}
                            disabled={deletingUserId === user.id}
                            style={{ zIndex: 10, position: 'relative' }}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>{deletingUserId === user.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        ) : (
                          <span className="text-gray-500 text-sm">Current User</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-600">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-500/20 p-3 rounded-full">
                  <Trash2 className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete User</h3>
                  <p className="text-sm text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-300 mb-2">
                  Are you sure you want to delete user <span className="font-semibold text-white">"{deleteConfirmUser.username}"</span>?
                </p>
                <p className="text-sm text-red-400">
                  This will permanently delete the user and all their associated data (messages, friends, groups, etc.).
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={cancelDeleteUser}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={deletingUserId === deleteConfirmUser.id}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {deletingUserId === deleteConfirmUser.id ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditAdmin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-600">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-500/20 p-3 rounded-full">
                  <Edit2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Edit Admin Credentials</h3>
                  <p className="text-sm text-gray-400">Update your username and/or password</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter new username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    New Password (leave blank to keep current)
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none pr-10"
                      placeholder="Enter new password (min 6 characters)"
                      minLength={6}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {showEditPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowEditPassword(false)} />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowEditPassword(true)} />
                      )}
                    </div>
                  </div>
                </div>

                {editPassword && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Confirm New Password
                    </label>
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editConfirmPassword}
                      onChange={e => setEditConfirmPassword(e.target.value)}
                      className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                      placeholder="Confirm new password"
                      minLength={6}
                    />
                    {editPassword !== editConfirmPassword && editConfirmPassword && (
                      <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={cancelEditAdmin}
                  disabled={savingAdmin}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdmin}
                  disabled={savingAdmin}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {savingAdmin ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

