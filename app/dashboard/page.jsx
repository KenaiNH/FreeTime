'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [className, setClassName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
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

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('schedules')
        .insert({
          class_name: className,
          day_of_week: parseInt(dayOfWeek),
          start_time: startTime,
          end_time: endTime,
        })

      if (error) throw error

      toast.success('Class added!')
      setClassName('')
      setDayOfWeek('0')
      setStartTime('09:00')
      setEndTime('10:00')
      setShowForm(false)
      fetchSchedules()
    } catch (error) {
      toast.error('Error adding class')
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

  if (loading) {
    return <p>Loading schedules...</p>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Class Schedule</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Class'}
        </button>
      </div>

      {/* Add Class Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">Add New Class</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Class Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Math 101"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                {daysOfWeek.map((day, index) => (
                  <option key={index} value={index}>{day}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Class
            </button>
          </form>
        </div>
      )}

      {/* Schedule List */}
      <div className="bg-white rounded-lg shadow">
        {schedules.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No classes yet. Add your first class!</p>
        ) : (
          <div className="divide-y">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <h3 className="font-semibold">{schedule.class_name}</h3>
                  <p className="text-sm text-gray-600">
                    {daysOfWeek[schedule.day_of_week]} • {schedule.start_time} - {schedule.end_time}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}