'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfilesForUsers } from '@/lib/profiles'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = Array.from({ length: 16 }, (_, i) => i + 6)

const memberColors = [
  { bg: 'rgba(99,102,241,0.25)', border: '#6366f1', text: '#818cf8' },
  { bg: 'rgba(244,63,94,0.25)', border: '#f43f5e', text: '#fb7185' },
  { bg: 'rgba(16,185,129,0.25)', border: '#10b981', text: '#34d399' },
  { bg: 'rgba(245,158,11,0.25)', border: '#f59e0b', text: '#fbbf24' },
  { bg: 'rgba(168,85,247,0.25)', border: '#a855f7', text: '#c084fc' },
  { bg: 'rgba(20,184,166,0.25)', border: '#14b8a6', text: '#2dd4bf' },
  { bg: 'rgba(249,115,22,0.25)', border: '#f97316', text: '#fb923c' },
  { bg: 'rgba(59,130,246,0.25)', border: '#3b82f6', text: '#60a5fa' },
]

function timeToDecimal(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return h + m / 60
}

function formatTime12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Detect overlapping blocks within the same day and assign horizontal positions
function computeOverlapLayout(blocks) {
  if (blocks.length === 0) return []

  // Sort by start time
  const sorted = [...blocks].sort((a, b) => a.startDec - b.startDec)
  const result = []

  // Group overlapping blocks using a sweep approach
  const groups = []
  let currentGroup = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const maxEnd = Math.max(...currentGroup.map(b => b.endDec))
    if (sorted[i].startDec < maxEnd) {
      currentGroup.push(sorted[i])
    } else {
      groups.push(currentGroup)
      currentGroup = [sorted[i]]
    }
  }
  groups.push(currentGroup)

  for (const group of groups) {
    const columns = []
    for (const block of group) {
      let placed = false
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1]
        if (block.startDec >= lastInCol.endDec) {
          columns[col].push(block)
          result.push({ ...block, colIndex: col, totalCols: 0 })
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([block])
        result.push({ ...block, colIndex: columns.length - 1, totalCols: 0 })
      }
    }
    // Set totalCols for all blocks in this group
    const totalCols = columns.length
    for (const r of result) {
      if (group.some(b => b.id === r.id)) {
        r.totalCols = totalCols
      }
    }
  }

  return result
}

export default function GroupCalendar() {
  const params = useParams()
  const router = useRouter()
  const [groupInfo, setGroupInfo] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [events, setEvents] = useState([])
  const [myResponses, setMyResponses] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('schedule')
  const [showEventForm, setShowEventForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [visibleUsers, setVisibleUsers] = useState({}) // userId -> boolean
  const [removingUser, setRemovingUser] = useState(null)

  // Event form state
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('12:00')
  const [eventEndTime, setEventEndTime] = useState('13:00')
  const [eventLocation, setEventLocation] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  // Initialize visibleUsers when members change
  useEffect(() => {
    if (members.length > 0) {
      setVisibleUsers(prev => {
        const next = {}
        members.forEach(m => {
          next[m.user_id] = prev[m.user_id] !== undefined ? prev[m.user_id] : true
        })
        return next
      })
    }
  }, [members])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', params.id)
        .single()
      setGroupInfo(group)

      const { data: memberData } = await supabase
        .from('group_members')
        .select('user_id, role')
        .eq('group_id', params.id)

      if (!memberData || memberData.length === 0) {
        setLoading(false)
        return
      }

      const memberIds = memberData.map(m => m.user_id)
      setMembers(memberData)

      const profileMap = await getProfilesForUsers(memberIds)
      setProfiles(profileMap)

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*')
        .in('user_id', memberIds)
        .order('day_of_week')
        .order('start_time')

      if (scheduleData) setSchedules(scheduleData)

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', params.id)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (eventData) {
        setEvents(eventData)
        const eventIds = eventData.map(e => e.id)
        if (eventIds.length > 0) {
          const { data: responses } = await supabase
            .from('event_responses')
            .select('*')
            .eq('user_id', user.id)
            .in('event_id', eventIds)

          if (responses) {
            const responseMap = {}
            responses.forEach(r => { responseMap[r.event_id] = r.response })
            setMyResponses(responseMap)
          }
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Error loading group data')
    } finally {
      setLoading(false)
    }
  }

  const getUserColorIndex = (userId) => {
    const memberIds = members.map(m => m.user_id).sort()
    return memberIds.indexOf(userId) % memberColors.length
  }

  const getUserLabel = (userId) => {
    const profile = profiles[userId]
    if (profile?.display_name) return profile.display_name
    return userId.slice(0, 8) + '...'
  }

  const isAdmin = () => {
    if (!currentUser) return false
    const me = members.find(m => m.user_id === currentUser.id)
    return me?.role === 'admin' || groupInfo?.created_by === currentUser.id
  }

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', params.id)
        .eq('user_id', currentUser.id)

      if (error) throw error
      toast.success('Left the group')
      router.push('/dashboard/groups')
    } catch (error) {
      toast.error('Error leaving group')
      console.error(error)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!confirm(`Remove ${getUserLabel(userId)} from this group?`)) return
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', params.id)
        .eq('user_id', userId)

      if (error) throw error
      toast.success(`${getUserLabel(userId)} removed`)
      setRemovingUser(null)
      fetchData()
    } catch (error) {
      toast.error('Error removing member')
      console.error(error)
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('events').insert({
        group_id: params.id,
        title: eventTitle,
        description: eventDescription || null,
        event_date: eventDate,
        start_time: eventStartTime,
        end_time: eventEndTime || null,
        location: eventLocation || null,
      })

      if (error) throw error

      toast.success('Event created!')
      setEventTitle('')
      setEventDescription('')
      setEventDate('')
      setEventStartTime('12:00')
      setEventEndTime('13:00')
      setEventLocation('')
      setShowEventForm(false)
      fetchData()
    } catch (error) {
      toast.error('Error creating event')
      console.error(error)
    }
  }

  const handleRSVP = async (eventId, response) => {
    try {
      const { data: existing } = await supabase
        .from('event_responses')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', currentUser.id)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('event_responses')
          .update({ response, responded_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('event_responses')
          .insert({
            event_id: eventId,
            response,
            responded_at: new Date().toISOString(),
          })
        if (error) throw error
      }

      setMyResponses(prev => ({ ...prev, [eventId]: response }))
      toast.success(`RSVP: ${response}`)
    } catch (error) {
      toast.error('Error updating RSVP')
      console.error(error)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId)
      if (error) throw error
      toast.success('Event deleted')
      fetchData()
    } catch (error) {
      toast.error('Error deleting event')
      console.error(error)
    }
  }

  const toggleUserVisibility = (userId) => {
    setVisibleUsers(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  // Filter schedules by visible users
  const filteredSchedules = schedules.filter(s => visibleUsers[s.user_id] !== false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading group...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0 -mr-4 sm:-mr-6 lg:-mr-8">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div>
            <Link href="/dashboard/groups" className="text-sm text-muted hover:text-foreground transition-colors mb-2 inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Groups
            </Link>
            <h2 className="text-2xl font-bold text-foreground">{groupInfo?.name || 'Group Schedule'}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              {groupInfo?.invite_code && (
                <span className="text-sm text-muted">
                  Code: <span className="font-mono font-bold text-foreground/70">{groupInfo.invite_code}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle sidebar button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-card border border-border text-muted hover:text-foreground hover:border-border-light transition-colors"
              title={sidebarOpen ? 'Hide members' : 'Show members'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {/* Leave group button */}
            <button
              onClick={handleLeaveGroup}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors"
            >
              Leave Group
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-card border border-border rounded-lg p-0.5 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'schedule' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            Schedule
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'events' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            Events {events.length > 0 && <span className="ml-1 text-xs opacity-70">({events.length})</span>}
          </button>
        </div>

        {/* Schedule Tab — Weekly Grid */}
        {activeTab === 'schedule' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="p-3 text-xs font-medium text-muted text-center">Time</div>
                  {daysShort.map((day) => (
                    <div key={day} className="p-3 text-xs font-medium text-muted text-center border-l border-border">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Time rows */}
                <div className="relative">
                  {hours.map(hour => (
                    <div key={hour} className="grid grid-cols-8 border-b border-border/50 h-14">
                      <div className="p-2 text-xs text-muted text-right pr-3 flex items-start justify-end">
                        {format(new Date(2024, 0, 1, hour), 'h a')}
                      </div>
                      {daysOfWeek.map((_, dayIndex) => (
                        <div key={`${hour}-${dayIndex}`} className="border-l border-border/50 relative" />
                      ))}
                    </div>
                  ))}

                  {/* Schedule blocks with overlap handling */}
                  {daysOfWeek.map((_, dayIndex) => {
                    const dayBlocks = filteredSchedules
                      .filter(s => Number(s.day_of_week) === dayIndex)
                      .map(s => ({
                        ...s,
                        startDec: timeToDecimal(s.start_time),
                        endDec: timeToDecimal(s.end_time),
                      }))

                    const layoutBlocks = computeOverlapLayout(dayBlocks)

                    return layoutBlocks.map(block => {
                      const colorIdx = getUserColorIndex(block.user_id)
                      const color = memberColors[colorIdx]

                      const topOffset = (block.startDec - 6) * 56
                      const height = (block.endDec - block.startDec) * 56

                      if (topOffset < 0 || height <= 0) return null

                      const colLeft = ((dayIndex + 1) / 8) * 100
                      const colWidth = (1 / 8) * 100
                      const slotWidth = colWidth / block.totalCols
                      const leftPercent = colLeft + (slotWidth * block.colIndex)

                      return (
                        <div
                          key={block.id}
                          className="absolute rounded-md px-1.5 py-1 overflow-hidden"
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            left: `${leftPercent}%`,
                            width: `${slotWidth}%`,
                            backgroundColor: color.bg,
                            borderLeft: `3px solid ${color.border}`,
                            zIndex: 1,
                          }}
                          title={`${block.class_name} — ${getUserLabel(block.user_id)}\n${formatTime12(block.start_time)} - ${formatTime12(block.end_time)}`}
                        >
                          <p className="text-xs font-semibold truncate leading-tight" style={{ color: color.text }}>
                            {block.class_name}
                          </p>
                          {height > 30 && (
                            <p className="text-xs truncate leading-tight" style={{ color: color.text, opacity: 0.7 }}>
                              {getUserLabel(block.user_id)}
                            </p>
                          )}
                        </div>
                      )
                    })
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowEventForm(!showEventForm)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showEventForm
                    ? 'bg-card border border-border text-muted'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {showEventForm ? 'Cancel' : '+ Create Event'}
              </button>
            </div>

            {showEventForm && (
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Create Event</h3>
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Title</label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="e.g. Study session"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Description (optional)</label>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent resize-none"
                      rows={2}
                      placeholder="Add details..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted mb-1.5">Start Time</label>
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted mb-1.5">End Time</label>
                      <input
                        type="time"
                        value={eventEndTime}
                        onChange={(e) => setEventEndTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Location (optional)</label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="e.g. Library Room 204"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Create Event
                  </button>
                </form>
              </div>
            )}

            {events.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-muted/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-muted text-sm">No events yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(event => {
                  const isCreator = event.creator_id === currentUser?.id
                  const myResponse = myResponses[event.id]

                  return (
                    <div key={event.id} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
                          {event.description && (
                            <p className="text-sm text-muted mt-1">{event.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {event.event_date}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatTime12(event.start_time)}
                              {event.end_time && ` - ${formatTime12(event.end_time)}`}
                            </span>
                            {event.location && (
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {isCreator && (
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 text-muted hover:text-danger transition-colors rounded-md hover:bg-danger/10"
                            title="Delete event"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                        <span className="text-xs text-muted mr-1">RSVP:</span>
                        {[
                          { value: 'going', label: 'Going', activeClass: 'bg-success/20 text-success border-success/30' },
                          { value: 'maybe', label: 'Maybe', activeClass: 'bg-warning/20 text-warning border-warning/30' },
                          { value: 'not_going', label: "Can't go", activeClass: 'bg-danger/20 text-danger border-danger/30' },
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleRSVP(event.id, option.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              myResponse === option.value
                                ? option.activeClass
                                : 'border-border text-muted hover:border-border-light hover:text-foreground'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discord-style member sidebar */}
      {sidebarOpen && (
        <aside className="w-60 flex-shrink-0 border-l border-border bg-card/50 ml-4 -my-4 sm:-my-6 lg:-my-8 py-4 sm:py-6 lg:py-8 px-3 hidden md:block">
          <div className="sticky top-0">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-2 mb-3">
              Members — {members.length}
            </h3>

            <div className="space-y-0.5">
              {members.map(member => {
                const colorIdx = getUserColorIndex(member.user_id)
                const color = memberColors[colorIdx]
                const profile = profiles[member.user_id]
                const isMe = member.user_id === currentUser?.id
                const isVisible = visibleUsers[member.user_id] !== false

                return (
                  <div key={member.user_id} className="group relative">
                    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-card-hover transition-colors">
                      {/* Schedule visibility checkbox */}
                      <button
                        onClick={() => toggleUserVisibility(member.user_id)}
                        className="flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center"
                        style={{
                          borderColor: isVisible ? color.border : 'var(--border-light)',
                          backgroundColor: isVisible ? color.bg : 'transparent',
                        }}
                        title={isVisible ? 'Hide schedule' : 'Show schedule'}
                      >
                        {isVisible && (
                          <svg className="w-3 h-3" fill="none" stroke={color.border} viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border-2"
                        style={{ borderColor: color.border }}
                      >
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: color.bg }}>
                            <span className="text-xs font-semibold" style={{ color: color.text }}>
                              {getUserLabel(member.user_id)[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Name + role */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate leading-tight">
                          {getUserLabel(member.user_id)}
                          {isMe && <span className="text-muted text-xs ml-1">(you)</span>}
                        </p>
                        {member.role === 'admin' && (
                          <p className="text-xs text-accent leading-tight">Admin</p>
                        )}
                      </div>

                      {/* Admin remove button — not for self */}
                      {isAdmin() && !isMe && (
                        <button
                          onClick={() => setRemovingUser(removingUser === member.user_id ? null : member.user_id)}
                          className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-muted hover:text-danger rounded transition-all"
                          title="Remove member"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Remove confirmation popover */}
                    {removingUser === member.user_id && (
                      <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-lg shadow-xl p-3 w-48">
                        <p className="text-xs text-muted mb-2">Remove from group?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="flex-1 px-2 py-1 bg-danger text-white text-xs rounded-md hover:bg-danger-hover"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setRemovingUser(null)}
                            className="flex-1 px-2 py-1 bg-background border border-border text-muted text-xs rounded-md hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
