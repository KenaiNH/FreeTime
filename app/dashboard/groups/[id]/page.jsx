'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation' // To get the Group ID from URL

export default function GroupCalendar() {
  const params = useParams() // Get group ID from URL
  const [schedules, setSchedules] = useState([])
  const [members, setMembers] = useState([])

  useEffect(() => {
    fetchGroupData()
  }, [])

  const fetchGroupData = async () => {
    // 1. Get all members of this specific group
    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', params.id)
    
    if (!memberData || memberData.length === 0) return

    // Extract just the IDs (e.g., ['user_123', 'user_456'])
    const memberIds = memberData.map(m => m.user_id)
    setMembers(memberIds)

    // 2. Fetch schedules for ANY of these users
    const { data: scheduleData, error } = await supabase
      .from('schedules')
      .select('*')
      .in('user_id', memberIds) // 👈 KEY: Fetch if user is IN this list
      .order('day_of_week')
      .order('start_time')

    if (scheduleData) setSchedules(scheduleData)
  }

  // Helper to color-code users so you can tell them apart
  const getUserColor = (userId) => {
    // Simple hash to give each user a consistent color
    const colors = ['bg-red-100', 'bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-purple-100']
    const index = userId.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Group Schedule</h2>
      
      <div className="space-y-4">
        {schedules.map(schedule => (
          <div key={schedule.id} className={`p-4 rounded-lg border ${getUserColor(schedule.user_id)}`}>
            <div className="font-bold">{schedule.class_name}</div>
            <div className="text-sm">
               {/* Note: You might want to fetch user emails/names to display here instead of IDs */}
               User: {schedule.user_id.slice(0, 4)}... 
            </div>
            <div className="text-sm text-gray-600">
               {schedule.start_time} - {schedule.end_time}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}