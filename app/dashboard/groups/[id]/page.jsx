'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfilesForUsers } from '@/lib/profiles'
import { useParams } from 'next/navigation'
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

export default function GroupCalendar() {
  const params = useParams()
  const [groupInfo, setGroupInfo] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [events, setEvents] = useState([])
  const [myResponses, setMyResponses] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('schedule') // 'schedule' or 'events'
  const [showEventForm, setShowEventForm] = useState(false)

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

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // Fetch group info
      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', params.id)
        .single()
      setGroupInfo(group)

      // Fetch members
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

      // Fetch profiles for display names
      const profileMap = await getProfilesForUsers(memberIds)
      setProfiles(profileMap)

      // Fetch schedules for all members
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*')
        .in('user_id', memberIds)
        .order('day_of_week')
        .order('start_time')

      if (scheduleData) setSchedules(scheduleData)

      // Fetch events
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', params.id)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (eventData) {
        setEvents(eventData)
        // Fetch my responses
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
      // Check if response already exists
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
    <div>
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
      </div>

      {/* Member legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {members.map(member => {
          const colorIdx = getUserColorIndex(member.user_id)
          const color = memberColors[colorIdx]
          return (
            <div key={member.user_id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.border }} />
              <span className="text-xs text-muted">{getUserLabel(member.user_id)}</span>
            </div>
          )
        })}
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

                {/* Schedule blocks for all members */}
                {schedules.map(schedule => {
                  const startDec = timeToDecimal(schedule.start_time)
                  const endDec = timeToDecimal(schedule.end_time)
                  const dayIndex = schedule.day_of_week
                  const colorIdx = getUserColorIndex(schedule.user_id)
                  const color = memberColors[colorIdx]

                  const topOffset = (startDec - 6) * 56
                  const height = (endDec - startDec) * 56

                  if (topOffset < 0 || height <= 0) return null

                  const leftPercent = ((dayIndex + 1) / 8) * 100
                  const widthPercent = (1 / 8) * 100

                  return (
                    <div
                      key={schedule.id}
                      className="absolute rounded-md px-2 py-1 overflow-hidden"
                      style={{
                        top: `${topOffset}px`,
                        height: `${height}px`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: color.bg,
                        borderLeft: `3px solid ${color.border}`,
                      }}
                      title={`${schedule.class_name} — ${getUserLabel(schedule.user_id)}\n${formatTime12(schedule.start_time)} - ${formatTime12(schedule.end_time)}`}
                    >
                      <p className="text-xs font-semibold truncate" style={{ color: color.text }}>
                        {schedule.class_name}
                      </p>
                      <p className="text-xs truncate" style={{ color: color.text, opacity: 0.7 }}>
                        {getUserLabel(schedule.user_id)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div>
          {/* Create event button */}
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

          {/* Event creation form */}
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

          {/* Events list */}
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

                    {/* RSVP buttons */}
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
  )
}
