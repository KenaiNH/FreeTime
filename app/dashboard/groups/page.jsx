'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  
  // Form state
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            invite_code,
            created_by
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      setGroups(data.map(item => item.groups))
    } catch (error) {
      toast.error('Error loading groups')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const code = generateInviteCode()

      // Create group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          invite_code: code,
          created_by: user.id
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Add creator as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'admin'
        })

      if (memberError) throw memberError

      toast.success(`Group created! Invite code: ${code}`)
      setGroupName('')
      setShowCreateForm(false)
      fetchGroups()
    } catch (error) {
      toast.error('Error creating group')
      console.error(error)
    }
  }

  const handleJoinGroup = async (e) => {
    e.preventDefault()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Find group by invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (groupError || !group) {
        toast.error('Invalid invite code')
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        toast.error('Already a member of this group')
        return
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'member'
        })

      if (memberError) throw memberError

      toast.success('Joined group!')
      setInviteCode('')
      setShowJoinForm(false)
      fetchGroups()
    } catch (error) {
      toast.error('Error joining group')
      console.error(error)
    }
  }

  if (loading) {
    return <p>Loading groups...</p>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Groups</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowJoinForm(!showJoinForm)
              setShowCreateForm(false)
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Join Group
          </button>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setShowJoinForm(false)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Group
          </button>
        </div>
      </div>

      {/* Create Group Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Group</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Study Group"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* Join Group Form */}
      {showJoinForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Join Group</h3>
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-md uppercase"
                placeholder="ABC123"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Join Group
            </button>
          </form>
        </div>
      )}

      {/* Groups List */}
      <div className="grid gap-4">
        {groups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No groups yet. Create or join one!</p>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{group.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Invite Code: <span className="font-mono font-bold">{group.invite_code}</span>
                  </p>
                </div>
                <Link
                  href={`/dashboard/groups/${group.id}`}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  View Schedule
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}