'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X, Users, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface GroupInvitation {
    id: string
    invited_at: string
    group: {
        id: string
        name: string
        assignment: {
            id: string
            title: string
            course: string | null
            due_date: string | null
        }
    }
}

export function PendingInvitations() {
    const [invitations, setInvitations] = useState<GroupInvitation[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchInvitations = useCallback(async () => {
        try {
            const res = await fetch('/api/assignments/groups')
            const data = await res.json()

            if (res.ok && data.invitations) {
                setInvitations(data.invitations)
            }
        } catch (error) {
            console.error('Error fetching invitations:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInvitations()
    }, [fetchInvitations])

    const handleAction = async (inviteId: string, action: 'accept' | 'decline') => {
        setProcessingId(inviteId)
        try {
            const res = await fetch('/api/assignments/groups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteId, action }),
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(data.message)
                setInvitations(prev => prev.filter(inv => inv.id !== inviteId))
            } else {
                toast.error(data.error || 'Failed to process invitation')
            }
        } catch (error) {
            console.error('Action error:', error)
            toast.error('Failed to process invitation')
        } finally {
            setProcessingId(null)
        }
    }

    if (loading) {
        return null // Don't show loading state, just hide until loaded
    }

    if (invitations.length === 0) {
        return null // Don't show section if no invitations
    }

    return (
        <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-purple-400" />
                    <h3 className="font-semibold text-white">Group Invitations</h3>
                    <Badge variant="secondary" className="text-xs">
                        {invitations.length}
                    </Badge>
                </div>

                <div className="space-y-3">
                    {invitations.map((invitation) => (
                        <div
                            key={invitation.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-black/20"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">
                                    {invitation.group?.assignment?.title || invitation.group?.name || 'Group Assignment'}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>
                                        Group: {invitation.group?.name || 'Unknown'}
                                    </span>
                                    {invitation.group?.assignment?.due_date && (
                                        <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                Due {formatDistanceToNow(new Date(invitation.group.assignment.due_date), { addSuffix: true })}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    disabled={processingId === invitation.id}
                                    onClick={() => handleAction(invitation.id, 'decline')}
                                >
                                    {processingId === invitation.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <X className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-purple-500 hover:bg-purple-600"
                                    disabled={processingId === invitation.id}
                                    onClick={() => handleAction(invitation.id, 'accept')}
                                >
                                    {processingId === invitation.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-1" />
                                            Accept
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
