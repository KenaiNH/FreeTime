'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { uploadAvatar, getProfile } from '@/lib/profiles'
import toast, { Toaster } from 'react-hot-toast'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        const profile = await getProfile(session.user.id)
        if (profile) {
          setAvatarUrl(profile.avatar_url)
          setDisplayName(profile.display_name || '')
        }
      }
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
        setShowProfileEdit(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Signed out successfully')
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      toast.loading('Uploading...')
      const url = await uploadAvatar(user.id, file)
      setAvatarUrl(url)
      toast.dismiss()
      toast.success('Profile picture updated!')
    } catch (err) {
      toast.dismiss()
      toast.error('Upload failed')
      console.error(err)
    }
  }

  const handleSaveDisplayName = async () => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: editName }, { onConflict: 'id' })
      if (error) throw error
      setDisplayName(editName)
      setShowProfileEdit(false)
      toast.success('Display name updated!')
    } catch (err) {
      toast.error('Failed to update name')
      console.error(err)
    }
  }

  const isActive = (path) => pathname === path

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#16161e', color: '#e4e4e7', border: '1px solid #27272a' },
        }}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-card border-r border-border flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">FreeTime</h1>
          <p className="text-xs text-muted mt-1">Class Scheduling</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/dashboard')
                ? 'bg-accent-dim text-accent-hover'
                : 'text-muted hover:bg-card-hover hover:text-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            My Schedule
          </Link>

          <Link
            href="/dashboard/groups"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith('/dashboard/groups')
                ? 'bg-accent-dim text-accent-hover'
                : 'text-muted hover:bg-card-hover hover:text-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Groups
          </Link>
        </nav>

        {/* Profile section at bottom */}
        <div className="p-3 border-t border-border" ref={menuRef}>
          {/* Profile button */}
          <button
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen)
              setShowProfileEdit(false)
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card-hover transition-colors"
          >
            {/* Avatar circle */}
            <div className="w-9 h-9 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-accent">
                  {(displayName || user?.email || '?')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName || 'Set display name'}
              </p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
          </button>

          {/* Profile dropdown menu */}
          {profileMenuOpen && (
            <div className="absolute bottom-20 left-3 right-3 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
              {showProfileEdit ? (
                <div className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Edit Profile</h4>
                  <div>
                    <label className="block text-xs text-muted mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
                      placeholder="Your name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDisplayName}
                      className="flex-1 px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowProfileEdit(false)}
                      className="flex-1 px-3 py-1.5 bg-background border border-border text-muted text-sm rounded-md hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Upload avatar */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-card-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Profile Picture
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />

                  {/* Edit display name */}
                  <button
                    onClick={() => {
                      setEditName(displayName)
                      setShowProfileEdit(true)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-card-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Display Name
                  </button>

                  <div className="border-t border-border" />

                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-danger hover:bg-card-hover transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-card-hover text-muted"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-foreground">FreeTime</h1>
          <div className="w-9 h-9 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-accent">
                {(displayName || user?.email || '?')[0].toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
