'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function GroupSchedule() {
  const params = useParams()
  const groupId = params.id  // ← This gets the ID from the URL

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  useEffect(() => {
    fetchGroupData()
  }, [groupId])

  const fetchGroupData = async () => {
    try {
      // Fetch group info
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupError) throw groupError
      setGroup(groupData)

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)

      if (membersError) throw membersError

      const userIds = membersData.map(m => m.user_id)

      // Fetch schedules for all members
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .in('user_id', userIds)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

      if (schedulesError) throw schedulesError
      setSchedules(schedulesData)

      setMembers(membersData)
    } catch (error) {
      toast.error('Error loading group schedule')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p>Loading group schedule...</p>
  }

  // Group schedules by day
  const schedulesByDay = daysOfWeek.map((day, index) => ({
    day,
    classes: schedules.filter(s => s.day_of_week === index)
  }))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{group.name}</h2>
        <p className="text-gray-600">{members.length} member{members.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y">
          {schedulesByDay.map(({ day, classes }) => (
            <div key={day} className="p-4">
              <h3 className="font-semibold text-lg mb-3">{day}</h3>
              {classes.length === 0 ? (
                <p className="text-sm text-gray-500">No classes</p>
              ) : (
                <div className="space-y-2">
                  {classes.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3 bg-blue-50 rounded-md border border-blue-200"
                    >
                      <p className="font-medium">{schedule.class_name}</p>
                      <p className="text-sm text-gray-600">
                        {schedule.start_time} - {schedule.end_time}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}