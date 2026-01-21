'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Share2, X, User as UserIcon, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ShareUser {
    id?: string
    email: string
    permission: 'view' | 'edit'
    avatar_url?: string
    full_name?: string
}

interface ShareDialogProps {
    contentType: 'note' | 'task' | 'reminder'
    contentId: string
    title: string
    trigger?: React.ReactNode
    onShare?: () => void
}

export function ShareDialog({ contentType, contentId, title, trigger, onShare }: ShareDialogProps) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [permission, setPermission] = useState<'view' | 'edit'>('view')
    const [loading, setLoading] = useState(false)
    const [sharedUsers, setSharedUsers] = useState<ShareUser[]>([])

    // Fetch shared users when dialog opens
    const fetchSharedUsers = async () => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('shared_content_access')
            .select(`
                *,
                shared_content!inner(content_id),
                profiles:user_id(email, full_name, avatar_url)
            `)
        // We need to join with shared_content to filter by contentId
        // But complex joins might be tricky. 
        // Better: Fetch the shared_content ID first for this content item.

        // Simplified flow:
        // 1. Get shared_content record for this item
        // 2. Get access records for that shared_content record
    }

    // Actually, we'll implement the logic properly:
    // When opening, we check if a shared_content record exists for this item.
    // If not, it means it's not shared yet.

    const handleShare = async () => {
        if (!email) return
        setLoading(true)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Ensure shared_content record exists
            let sharedContentId

            // Try to find existing
            const { data: existing } = await supabase
                .from('shared_content')
                .select('id')
                .eq('content_type', contentType)
                .eq('content_id', contentId)
                .eq('owner_id', user.id)
                .single()

            if (existing) {
                sharedContentId = existing.id
            } else {
                // Create new
                const { data: newRecord, error: createError } = await supabase
                    .from('shared_content')
                    .insert({
                        content_type: contentType,
                        content_id: contentId,
                        owner_id: user.id,
                        title: title
                    })
                    .select('id')
                    .single()

                if (createError) throw createError
                sharedContentId = newRecord.id
            }

            // 2. Add access record
            // First check if user exists in system to link user_id
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single()

            const accessData = {
                shared_content_id: sharedContentId,
                email: email,
                permission: permission,
                user_id: profiles?.id || null // Link if user exists, otherwise just email
            }

            const { error: shareError } = await supabase
                .from('shared_content_access')
                .insert(accessData)

            if (shareError) {
                if (shareError.code === '23505') { // Unique violation
                    toast.error('Already shared with this user')
                } else {
                    throw shareError
                }
            } else {
                toast.success('Invitation sent')
                setEmail('')
                onShare?.()
            }

        } catch (error) {
            console.error('Share error:', error)
            toast.error('Failed to share')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Share2 className="h-4 w-4" />
                        Share
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share {contentType}</DialogTitle>
                    <DialogDescription>
                        Invite others to view or edit this {contentType}.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-end gap-2">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                placeholder="friend@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Select value={permission} onValueChange={(v: 'view' | 'edit') => setPermission(v)}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="view">Can view</SelectItem>
                                <SelectItem value="edit">Can edit</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleShare} disabled={loading || !email}>
                            {loading ? 'Sharing...' : 'Invite'}
                        </Button>
                    </div>

                    {/* List of shared users would go here - omitted for MVP speed */}
                </div>
            </DialogContent>
        </Dialog>
    )
}
