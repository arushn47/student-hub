'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Settings, User, Bell, Palette, Shield, Loader2, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

interface UserProfile {
    full_name: string | null
    avatar_url: string | null
    email: string
    preferences: {
        theme: 'light' | 'dark' | 'system'
        notifications_enabled: boolean
        daily_motivation: boolean
    }
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [googleConnected, setGoogleConnected] = useState(false)
    const [connectingGoogle, setConnectingGoogle] = useState(false)
    const supabase = createClient()
    const { theme, setTheme } = useTheme()
    const searchParams = useSearchParams()

    // Check for Google connection status from URL params
    useEffect(() => {
        const googleConnectedParam = searchParams.get('google_connected')
        const googleError = searchParams.get('google_error')

        if (googleConnectedParam === 'true') {
            toast.success('Google account connected!')
            // Delay state update to avoid sync render warning
            setTimeout(() => setGoogleConnected(true), 0)
        } else if (googleError) {
            toast.error(`Google connection failed: ${googleError}`)
        }
    }, [searchParams])

    const loadProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: initialData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        let data = initialData

        // If profile doesn't exist, create it
        if (error && error.code === 'PGRST116') {
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email || '',
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
                    avatar_url: user.user_metadata?.avatar_url || null,
                    preferences: {
                        theme: 'dark',
                        notifications_enabled: true,
                        daily_motivation: true,
                    },
                })
                .select()
                .single()

            if (insertError) {
                console.error('Failed to create profile:', insertError)
                toast.error('Failed to create profile')
            } else {
                data = newProfile
                toast.success('Profile created!')
            }
        }

        if (data) {
            setProfile({
                full_name: data.full_name,
                avatar_url: data.avatar_url,
                email: data.email,
                preferences: data.preferences || {
                    theme: 'dark',
                    notifications_enabled: true,
                    daily_motivation: true,
                },
            })
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        // This is a valid pattern - loading initial data on mount
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadProfile()
    }, [loadProfile])



    const updateProfile = async (updates: Partial<UserProfile>) => {
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: updates.full_name ?? profile?.full_name,
                preferences: updates.preferences ?? profile?.preferences,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)

        if (error) {
            toast.error('Failed to update profile')
        } else {
            setProfile(prev => prev ? { ...prev, ...updates } : null)
            toast.success('Settings saved')
        }
        setSaving(false)
    }

    const updatePreference = (key: keyof UserProfile['preferences'], value: boolean | string) => {
        if (!profile) return
        const newPreferences = { ...profile.preferences, [key]: value }
        setProfile({ ...profile, preferences: newPreferences })
        updateProfile({ preferences: newPreferences })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-6 w-6 text-purple-500" />
                    Settings
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Manage your account and preferences
                </p>
            </div>

            {/* Profile Section */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <User className="h-5 w-5 text-purple-500" />
                        Profile
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-2xl">
                                {profile?.full_name?.charAt(0) || profile?.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-foreground font-medium">{profile?.full_name || 'No name set'}</p>
                            <p className="text-muted-foreground text-sm">{profile?.email}</p>
                        </div>
                    </div>

                    {/* Name Input */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Full Name</Label>
                        <Input
                            value={profile?.full_name || ''}
                            onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                            onBlur={() => updateProfile({ full_name: profile?.full_name })}
                            className="bg-input border-border text-foreground"
                            placeholder="Enter your name"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <Input
                            value={profile?.email || ''}
                            disabled
                            className="bg-input border-border text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                </CardContent>
            </Card>

            {/* Appearance Section */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Palette className="h-5 w-5 text-purple-500" />
                        Appearance
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Customize the look and feel
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-foreground font-medium">Theme</p>
                            <p className="text-muted-foreground text-sm">Choose your preferred theme</p>
                        </div>
                        <Select
                            value={theme || 'dark'}
                            onValueChange={(v) => {
                                setTheme(v)
                                updatePreference('theme', v)
                            }}
                        >
                            <SelectTrigger className="w-32 bg-input border-border text-foreground">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Notifications Section */}
            <Card className="bg-white/[0.02] border-white/10">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Bell className="h-5 w-5 text-purple-400" />
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Manage notification preferences
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Push Notifications</p>
                            <p className="text-gray-400 text-sm">Receive reminder notifications</p>
                        </div>
                        <Switch
                            checked={profile?.preferences.notifications_enabled ?? true}
                            onCheckedChange={(v) => updatePreference('notifications_enabled', v)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Daily Motivation</p>
                            <p className="text-gray-400 text-sm">Show motivational quotes on dashboard</p>
                        </div>
                        <Switch
                            checked={profile?.preferences.daily_motivation ?? true}
                            onCheckedChange={(v) => updatePreference('daily_motivation', v)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Security Section */}
            <Card className="bg-white/[0.02] border-white/10">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Shield className="h-5 w-5 text-purple-400" />
                        Security
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Account security options
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        variant="outline"
                        className="w-full border-white/10 text-white hover:bg-white/5"
                        onClick={async () => {
                            const { error } = await supabase.auth.resetPasswordForEmail(profile?.email || '')
                            if (error) {
                                toast.error('Failed to send reset email')
                            } else {
                                toast.success('Password reset email sent!')
                            }
                        }}
                    >
                        Send Password Reset Email
                    </Button>
                    <p className="text-xs text-gray-500 text-center">
                        We&apos;ll send a link to reset your password
                    </p>
                </CardContent>
            </Card>

            {/* Google Integrations */}
            <Card className="bg-white/[0.02] border-white/10">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google Integrations
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Connect Google to sync Calendar, Tasks, and more
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Google Account</p>
                            <p className="text-gray-400 text-sm">
                                {googleConnected ? 'Connected - Sync enabled' : 'Connect to sync Calendar & Tasks'}
                            </p>
                        </div>
                        {googleConnected ? (
                            <Button
                                variant="outline"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={async () => {
                                    const { data: { user } } = await supabase.auth.getUser()
                                    if (!user) return
                                    await supabase
                                        .from('profiles')
                                        .update({ google_tokens: null, google_connected: false })
                                        .eq('id', user.id)
                                    setGoogleConnected(false)
                                    toast.success('Google account disconnected')
                                }}
                            >
                                <Unlink className="h-4 w-4 mr-2" />
                                Disconnect
                            </Button>
                        ) : (
                            <Button
                                className="bg-white text-gray-800 hover:bg-gray-100"
                                disabled={connectingGoogle}
                                onClick={async () => {
                                    setConnectingGoogle(true)
                                    try {
                                        const res = await fetch('/api/auth/google')
                                        const { authUrl } = await res.json()
                                        window.location.href = authUrl
                                    } catch {
                                        toast.error('Failed to start Google connection')
                                        setConnectingGoogle(false)
                                    }
                                }}
                            >
                                {connectingGoogle ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Link2 className="h-4 w-4 mr-2" />
                                )}
                                Connect Google
                            </Button>
                        )}
                    </div>
                    {googleConnected && (
                        <div className="text-xs text-gray-500 bg-white/5 rounded-lg p-3">
                            <p>✓ Calendar events will sync with your timetable</p>
                            <p>✓ Tasks will sync with Google Tasks</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* PWA Install Prompt */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">📱 Install App</p>
                            <p className="text-gray-400 text-sm">Add StudentHub to your home screen for quick access</p>
                        </div>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-purple-500 to-pink-500"
                            onClick={() => {
                                toast.info('Look for the "Install" or "Add to Home Screen" option in your browser menu!')
                            }}
                        >
                            How to Install
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save indicator */}
            {saving && (
                <div className="fixed bottom-6 right-6 bg-purple-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                </div>
            )}
        </div>
    )
}
