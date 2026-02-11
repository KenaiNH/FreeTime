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

      const groupsList = data.map(item => item.groups)

      // Fetch member counts for each group
      const groupsWithCounts = await Promise.all(
        groupsList.map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
          return { ...group, memberCount: count || 0 }
        })
      )

      setGroups(groupsWithCounts)
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

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (groupError || !group) {
        toast.error('Invalid invite code')
        return
      }

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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading groups...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Groups</h2>
          <p className="text-sm text-muted mt-1">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowJoinForm(!showJoinForm)
              setShowCreateForm(false)
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showJoinForm
                ? 'bg-card border border-border text-muted'
                : 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
            }`}
          >
            Join Group
          </button>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setShowJoinForm(false)
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showCreateForm
                ? 'bg-card border border-border text-muted'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            + Create Group
          </button>
        </div>
      </div>

      {/* Create Group Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Create New Group</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="e.g. Study Group"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* Join Group Form */}
      {showJoinForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Join Group</h3>
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm uppercase tracking-wider focus:outline-none focus:border-accent transition-colors"
                placeholder="ABC123"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:bg-success-hover transition-colors"
            >
              Join Group
            </button>
          </form>
        </div>
      )}

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-muted/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-muted text-sm">No groups yet. Create or join one!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/dashboard/groups/${group.id}`}
              className="block bg-card border border-border rounded-xl p-6 hover:bg-card-hover hover:border-border-light transition-colors group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-accent-hover transition-colors truncate">
                    {group.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted">
                      Code: <span className="font-mono font-bold text-foreground/70">{group.invite_code}</span>
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-muted group-hover:text-accent-hover transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
