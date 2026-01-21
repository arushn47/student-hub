'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogIn, UserPlus, BookOpen, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface LoginRequiredDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    message?: string
    feature?: string
}

export function LoginRequiredDialog({
    open,
    onOpenChange,
    message = "Sign in to save your progress and access all features",
    feature = "this feature"
}: LoginRequiredDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 mb-4">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <DialogTitle className="text-xl text-foreground">
                        Sign in Required
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {message}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 pt-4">
                    {/* Benefits */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            Why sign in?
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1.5 ml-6">
                            <li>• Save and sync your notes across devices</li>
                            <li>• Access AI-powered study features</li>
                            <li>• Track your productivity progress</li>
                            <li>• Get personalized reminders</li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                        <Link href="/login" className="w-full">
                            <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                                <LogIn className="mr-2 h-4 w-4" />
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/signup" className="w-full">
                            <Button variant="outline" className="w-full">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Create Account
                            </Button>
                        </Link>
                    </div>

                    <p className="text-xs text-center text-muted-foreground pt-2">
                        It&apos;s free and takes less than a minute!
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
