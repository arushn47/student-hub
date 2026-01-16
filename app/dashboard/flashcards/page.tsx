'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Plus,
    Search,
    Layers,
    MoreHorizontal,
    Clock,
    BookOpen,
    Brain,
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ImageUploadExtractor } from '@/components/ai/ImageUploadExtractor'

interface Deck {
    id: string
    name: string
    description: string
    color: string
    card_count: number
    created_at: string
}

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
}

export default function FlashcardsPage() {
    const [decks, setDecks] = useState<Deck[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showNewDeck, setShowNewDeck] = useState(false)
    const [newDeckName, setNewDeckName] = useState('')
    const [newDeckColor, setNewDeckColor] = useState('purple')
    const [isCreating, setIsCreating] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('flashcard_decks')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })

                if (error) throw error
                setDecks(data || [])
            } catch (error) {
                console.error('Error fetching decks:', error)
                toast.error('Failed to load flashcard decks')
            } finally {
                setLoading(false)
            }
        }
        fetchDecks()
    }, [supabase])

    const createDeck = async () => {
        if (!newDeckName.trim()) return

        try {
            setIsCreating(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { data, error } = await supabase
                .from('flashcard_decks')
                .insert({
                    user_id: user.id,
                    name: newDeckName,
                    color: newDeckColor,
                    card_count: 0
                })
                .select()
                .single()

            if (error) throw error

            setDecks([data, ...decks])
            setNewDeckName('')
            setShowNewDeck(false)
            toast.success('Deck created successfully')
        } catch (error) {
            console.error('Error creating deck:', error)
            toast.error('Failed to create deck')
        } finally {
            setIsCreating(false)
        }
    }

    const filteredDecks = decks.filter(deck =>
        deck.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const totalCards = decks.reduce((sum, deck) => sum + (deck.card_count || 0), 0)

    // Placeholder for now
    const totalDue = 0

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Flashcards</h1>
                    <p className="text-gray-400 mt-1">Master your subjects with spaced repetition</p>
                </div>
                <div className="flex gap-2">
                    <ImageUploadExtractor
                        type="flashcards"
                        title="Generate Deck"
                        description="Upload study notes, diagrams, or textbook pages to auto-generate flashcards."
                        onExtract={async (data) => {
                            if (data.flashcards && Array.isArray(data.flashcards)) {
                                try {
                                    const { data: { user } } = await supabase.auth.getUser()
                                    if (!user) return

                                    // 1. Create Deck
                                    const { data: deck, error: deckError } = await supabase
                                        .from('flashcard_decks')
                                        .insert({
                                            user_id: user.id,
                                            name: data.deckName || 'AI Generated Deck',
                                            color: 'cyan', // AI decks in cyan
                                            card_count: data.flashcards.length
                                        })
                                        .select()
                                        .single()

                                    if (deckError) throw deckError

                                    // 2. Create Cards
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const cardsToInsert = data.flashcards.map((c: any) => ({
                                        deck_id: deck.id,
                                        user_id: user.id,
                                        front: c.front,
                                        back: c.back,
                                    }))

                                    const { error: cardsError } = await supabase
                                        .from('flashcards')
                                        .insert(cardsToInsert)

                                    if (cardsError) throw cardsError

                                    setDecks(prev => [deck, ...prev])
                                    toast.success(`Generated deck with ${cardsToInsert.length} cards`)

                                } catch (e) {
                                    console.error('AI Gen error:', e)
                                    toast.error('Failed to generate deck')
                                }
                            }
                        }}
                    />
                    <Button
                        onClick={() => setShowNewDeck(true)}
                        className="gradient-primary text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        New Deck
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatMini icon={Layers} label="Total Decks" value={decks.length} />
                <StatMini icon={BookOpen} label="Total Cards" value={totalCards} />
                <StatMini icon={Clock} label="Cards Due" value={totalDue} color="amber" />
                <StatMini icon={Brain} label="Mastered" value={0} color="emerald" />
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search decks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
            </div>

            {/* New Deck Form */}
            {showNewDeck && (
                <Card className="glass-card border-violet-500/30 bg-violet-500/5">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Create New Deck</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-gray-400">Deck Name</Label>
                                <Input
                                    value={newDeckName}
                                    onChange={(e) => setNewDeckName(e.target.value)}
                                    placeholder="e.g., Biology 101"
                                    className="bg-white/5 border-white/10 text-white mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-gray-400">Color</Label>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {Object.keys(colorClasses).map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setNewDeckColor(color)}
                                            className={cn(
                                                "w-8 h-8 rounded-full border-2 transition-all",
                                                colorClasses[color].bg,
                                                newDeckColor === color ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={createDeck}
                                    className="gradient-primary text-white"
                                    disabled={!newDeckName.trim() || isCreating}
                                >
                                    {isCreating ? 'Creating...' : 'Create Deck'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowNewDeck(false)}
                                    className="text-gray-400"
                                    disabled={isCreating}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Decks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDecks.map((deck) => (
                    <DeckCard key={deck.id} deck={deck} />
                ))}

                {!showNewDeck && (
                    <button
                        onClick={() => setShowNewDeck(true)}
                        className="h-full min-h-[180px] rounded-2xl border-2 border-dashed border-white/10 hover:border-violet-500/50 transition-all flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-violet-400 group"
                    >
                        <div className="p-3 rounded-xl bg-white/5 group-hover:bg-violet-500/10 transition-colors">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="font-medium">Create New Deck</span>
                    </button>
                )}
            </div>

            {filteredDecks.length === 0 && !loading && !showNewDeck && (
                <div className="text-center py-12">
                    <p className="text-gray-400">
                        {searchQuery ? `No decks found matching "${searchQuery}"` : "No decks yet. Create one to get started!"}
                    </p>
                </div>
            )}
        </div>
    )
}

function DeckCard({ deck }: { deck: Deck }) {
    const colors = colorClasses[deck.color] || colorClasses.purple

    return (
        <Link href={`/dashboard/flashcards/${deck.id}`}>
            <Card className="glass-card border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] cursor-pointer group h-full">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div className={cn("p-2.5 rounded-xl", colors.bg)}>
                            <Layers className={cn("h-5 w-5", colors.text)} />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>

                    <h3 className="font-semibold text-white mb-1">{deck.name}</h3>
                    <p className="text-sm text-gray-400 mb-4">{deck.card_count || 0} cards</p>

                    <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Start Studying
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

function StatMini({
    icon: Icon,
    label,
    value,
    color = 'default'
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    color?: 'default' | 'amber' | 'emerald'
}) {
    const colorClass = color === 'amber'
        ? 'text-amber-400'
        : color === 'emerald'
            ? 'text-emerald-400'
            : 'text-gray-400'

    return (
        <div className="glass-card rounded-xl p-4 border-white/[0.06]">
            <Icon className={cn("h-4 w-4 mb-2", colorClass)} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
        </div>
    )
}
