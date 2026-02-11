'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

const colorOptions = [
  { name: 'Indigo', value: '#6366f1', bg: 'rgba(99,102,241,0.2)', border: '#6366f1' },
  { name: 'Blue', value: '#3b82f6', bg: 'rgba(59,130,246,0.2)', border: '#3b82f6' },
  { name: 'Emerald', value: '#10b981', bg: 'rgba(16,185,129,0.2)', border: '#10b981' },
  { name: 'Amber', value: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e', bg: 'rgba(244,63,94,0.2)', border: '#f43f5e' },
  { name: 'Purple', value: '#a855f7', bg: 'rgba(168,85,247,0.2)', border: '#a855f7' },
  { name: 'Teal', value: '#14b8a6', bg: 'rgba(20,184,166,0.2)', border: '#14b8a6' },
  { name: 'Orange', value: '#f97316', bg: 'rgba(249,115,22,0.2)', border: '#f97316' },
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

export default function Dashboard() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState('week') // 'week' or 'list'
  const [editingSchedule, setEditingSchedule] = useState(null)

  // Form state
  const [className, setClassName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value)

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      toast.error('Error loading schedules')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setClassName('')
    setDayOfWeek('0')
    setStartTime('09:00')
    setEndTime('10:00')
    setSelectedColor(colorOptions[0].value)
    setEditingSchedule(null)
  }

  const openEditForm = (schedule) => {
    setEditingSchedule(schedule)
    setClassName(schedule.class_name)
    setDayOfWeek(String(schedule.day_of_week))
    setStartTime(schedule.start_time?.slice(0, 5) || '09:00')
    setEndTime(schedule.end_time?.slice(0, 5) || '10:00')
    setSelectedColor(schedule.color || colorOptions[0].value)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from('schedules')
          .update({
            class_name: className,
            day_of_week: parseInt(dayOfWeek),
            start_time: startTime,
            end_time: endTime,
            color: selectedColor,
          })
          .eq('id', editingSchedule.id)

        if (error) throw error
        toast.success('Class updated!')
      } else {
        const { error } = await supabase
          .from('schedules')
          .insert({
            class_name: className,
            day_of_week: parseInt(dayOfWeek),
            start_time: startTime,
            end_time: endTime,
            color: selectedColor,
          })

        if (error) throw error
        toast.success('Class added!')
      }

      resetForm()
      setShowForm(false)
      fetchSchedules()
    } catch (error) {
      toast.error(editingSchedule ? 'Error updating class' : 'Error adding class')
      console.error(error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this class?')) return
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Class deleted')
      fetchSchedules()
    } catch (error) {
      toast.error('Error deleting class')
      console.error(error)
    }
  }

  const getColorInfo = (colorValue) => {
    return colorOptions.find(c => c.value === colorValue) || colorOptions[0]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading schedules...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Class Schedule</h2>
          <p className="text-sm text-muted mt-1">{schedules.length} class{schedules.length !== 1 ? 'es' : ''} scheduled</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-card border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => {
              if (showForm && !editingSchedule) {
                setShowForm(false)
              } else {
                resetForm()
                setShowForm(!showForm)
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showForm && !editingSchedule
                ? 'bg-card border border-border text-muted hover:text-foreground'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {showForm && !editingSchedule ? 'Cancel' : '+ Add Class'}
          </button>
        </div>
      </div>

      {/* Add/Edit Class Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {editingSchedule ? 'Edit Class' : 'Add New Class'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Class Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="e.g. Math 101"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
              >
                {daysOfWeek.map((day, index) => (
                  <option key={index} value={index}>{day}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Color</label>
              <div className="flex gap-2">
                {colorOptions.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      selectedColor === c.value
                        ? 'ring-2 ring-offset-2 ring-offset-card scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: c.value,
                      ringColor: c.value,
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                {editingSchedule ? 'Save Changes' : 'Add Class'}
              </button>
              {editingSchedule && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowForm(false) }}
                  className="px-4 py-2.5 bg-card border border-border text-muted rounded-lg text-sm font-medium hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Weekly Grid View */}
      {viewMode === 'week' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b border-border">
                <div className="p-3 text-xs font-medium text-muted text-center">Time</div>
                {daysShort.map((day, i) => (
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

                {/* Schedule blocks overlay */}
                {schedules.map(schedule => {
                  const startDec = timeToDecimal(schedule.start_time)
                  const endDec = timeToDecimal(schedule.end_time)
                  const dayIndex = schedule.day_of_week
                  const colorInfo = getColorInfo(schedule.color)

                  const topOffset = (startDec - 6) * 56 // 56px = h-14
                  const height = (endDec - startDec) * 56

                  if (topOffset < 0 || height <= 0) return null

                  // Column calculation: first col is time (1/8), then 7 day cols
                  const leftPercent = ((dayIndex + 1) / 8) * 100
                  const widthPercent = (1 / 8) * 100

                  return (
                    <div
                      key={schedule.id}
                      className="absolute rounded-md px-2 py-1 overflow-hidden cursor-pointer group"
                      style={{
                        top: `${topOffset}px`,
                        height: `${height}px`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: colorInfo.bg,
                        borderLeft: `3px solid ${colorInfo.border}`,
                      }}
                      title={`${schedule.class_name}\n${formatTime12(schedule.start_time)} - ${formatTime12(schedule.end_time)}\nClick to edit`}
                      onClick={() => openEditForm(schedule)}
                    >
                      <p className="text-xs font-semibold truncate" style={{ color: colorInfo.border }}>
                        {schedule.class_name}
                      </p>
                      <p className="text-xs truncate" style={{ color: colorInfo.border, opacity: 0.7 }}>
                        {formatTime12(schedule.start_time)}
                      </p>
                      {/* Delete button on hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id) }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-danger/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {schedules.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-muted/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-muted text-sm">No classes yet. Add your first class!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {schedules.map((schedule) => {
                const colorInfo = getColorInfo(schedule.color)
                return (
                  <div
                    key={schedule.id}
                    className="p-4 flex justify-between items-center hover:bg-card-hover transition-colors cursor-pointer"
                    onClick={() => openEditForm(schedule)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: colorInfo.border }}
                      />
                      <div>
                        <h3 className="font-semibold text-foreground">{schedule.class_name}</h3>
                        <p className="text-sm text-muted">
                          {daysOfWeek[schedule.day_of_week]} &middot; {formatTime12(schedule.start_time)} - {formatTime12(schedule.end_time)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id) }}
                      className="px-3 py-1.5 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
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
