'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Users, Loader2, Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface InviteToGroupDialogProps {
    assignmentId: string
    assignmentTitle: string
    trigger?: React.ReactNode
}

export function InviteToGroupDialog({
    assignmentId,
    assignmentTitle,
    trigger
}: InviteToGroupDialogProps) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [sending, setSending] = useState(false)

    const handleInvite = async () => {
        if (!email.trim()) {
            toast.error('Please enter an email address')
            return
        }

        // Basic email validation
        if (!email.includes('@')) {
            toast.error('Please enter a valid email address')
            return
        }

        setSending(true)
        try {
            const res = await fetch('/api/assignments/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignmentId,
                    inviteEmail: email.trim().toLowerCase(),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.error || 'Failed to send invitation')
                return
            }

            toast.success(data.message || 'Invitation sent!')
            setEmail('')
            setOpen(false)
        } catch (error) {
            console.error('Invite error:', error)
            toast.error('Failed to send invitation')
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Users className="h-4 w-4" />
                        Invite
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-purple-400" />
                        Invite to Group Assignment
                    </DialogTitle>
                    <DialogDescription>
                        Invite a classmate to collaborate on &ldquo;{assignmentTitle}&rdquo;
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="classmate@university.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            They&apos;ll see this assignment in their dashboard and can track progress together
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={sending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInvite}
                        disabled={sending || !email.trim()}
                        className="gap-2"
                    >
                        {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <UserPlus className="h-4 w-4" />
                        )}
                        Send Invitation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
