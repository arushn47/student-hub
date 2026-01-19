'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    IndianRupee,
    Plus,
    ShoppingBag,
    Coffee,
    Book,
    Bus,
    Monitor,
    Trash2,
    Loader2,
    Pencil,
    Check,
    X,
    MessageSquare,
    Sparkles
} from 'lucide-react'
import { cn, formatDateMDY } from '@/lib/utils'
import { toast } from 'sonner'

interface Expense {
    id: string
    amount: number
    category: string
    description: string
    expense_date: string
    created_at: string
}

const categories = [
    { id: 'food', label: 'Food & Dining', icon: Coffee, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
    { id: 'transport', label: 'Transportation', icon: Bus, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    { id: 'entertainment', label: 'Entertainment', icon: Monitor, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
    { id: 'education', label: 'Education', icon: Book, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'other', label: 'Other', icon: Wallet, color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
]

export default function BudgetPage() {
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [monthlyBudget, setMonthlyBudget] = useState(0)

    // Budget Editing
    const [isEditingBudget, setIsEditingBudget] = useState(false)
    const [tempBudget, setTempBudget] = useState('')
    const [isSavingBudget, setIsSavingBudget] = useState(false)

    // Add Expense Form
    const [showAddForm, setShowAddForm] = useState(false)
    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category: 'food'
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Add Money (income from parents)
    const [showAddMoney, setShowAddMoney] = useState(false)
    const [addMoneyAmount, setAddMoneyAmount] = useState('')

    // SMS Parsing
    const [showSmsDialog, setShowSmsDialog] = useState(false)
    const [smsText, setSmsText] = useState('')
    const [isParsing, setIsParsing] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // 1. Fetch Expenses
                const { data: expensesData, error: expensesError } = await supabase
                    .from('expenses')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('expense_date', { ascending: false })

                if (expensesError) {
                    console.error('Error fetching expenses:', expensesError)
                    throw new Error(expensesError.message || JSON.stringify(expensesError))
                }
                setExpenses(expensesData || [])

                // 2. Fetch Budget (Graceful handling)
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('monthly_budget')
                    .eq('id', user.id)
                    .single()

                if (profileError) {
                    console.warn('Could not fetch budget (using default 0):', profileError)
                }

                if (profileData?.monthly_budget) {
                    setMonthlyBudget(Number(profileData.monthly_budget))
                }

            } catch (error: unknown) {
                console.error('Error fetching data:', error)
                const errorMessage = error instanceof Error ? error.message : 'Failed to load budget data';
                toast.error(errorMessage)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [supabase])

    const updateBudget = async () => {
        const amount = parseFloat(tempBudget)
        if (isNaN(amount) || amount < 0) {
            toast.error('Please enter a valid amount')
            return
        }

        try {
            setIsSavingBudget(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('profiles')
                .update({ monthly_budget: amount })
                .eq('id', user.id)

            if (error) throw error

            setMonthlyBudget(amount)
            setIsEditingBudget(false)
            toast.success('Budget updated')
        } catch (error) {
            console.error('Error updating budget:', error)
            toast.error('Failed to update budget')
        } finally {
            setIsSavingBudget(false)
        }
    }

    const startEditing = () => {
        setTempBudget(monthlyBudget.toString())
        setIsEditingBudget(true)
    }

    // Add money to current balance
    const addMoney = async () => {
        const amount = parseFloat(addMoneyAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Enter a valid amount')
            return
        }

        try {
            setIsSavingBudget(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const newBalance = monthlyBudget + amount
            const { error } = await supabase
                .from('profiles')
                .update({ monthly_budget: newBalance })
                .eq('id', user.id)

            if (error) throw error

            setMonthlyBudget(newBalance)
            setShowAddMoney(false)
            setAddMoneyAmount('')
            toast.success(`Added ₹${amount.toLocaleString()} to balance!`)
        } catch {
            toast.error('Failed to add money')
        } finally {
            setIsSavingBudget(false)
        }
    }

    const addExpense = async () => {
        if (!newExpense.description || !newExpense.amount) {
            toast.error('Please fill in all fields')
            return
        }

        try {
            setIsSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { data, error } = await supabase
                .from('expenses')
                .insert({
                    user_id: user.id,
                    description: newExpense.description,
                    amount: parseFloat(newExpense.amount),
                    category: newExpense.category,
                    expense_date: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            setExpenses([data, ...expenses])
            setNewExpense({ description: '', amount: '', category: 'food' })
            setShowAddForm(false)
            toast.success('Expense added successfully')
        } catch (error) {
            console.error('Error adding expense:', error)
            toast.error('Failed to add expense')
        } finally {
            setIsSubmitting(false)
        }
    }

    const parseSmsText = async () => {
        if (!smsText.trim()) {
            toast.error('Please paste SMS or email text')
            return
        }

        try {
            setIsParsing(true)
            const response = await fetch('/api/ai/parse-expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: smsText })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to parse')
            }

            const { data } = result

            if (data.amount) {
                setNewExpense({
                    description: data.description || '',
                    amount: data.amount.toString(),
                    category: data.category || 'other'
                })
                setShowAddForm(true)
                setShowSmsDialog(false)
                setSmsText('')
                toast.success('Expense extracted! Review and add.')
            } else {
                toast.error('Could not extract amount from text')
            }
        } catch (error: unknown) {
            console.error('Parse error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to parse text';
            toast.error(errorMessage)
        } finally {
            setIsParsing(false)
        }
    }

    const removeExpense = async (id: string) => {
        try {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)

            if (error) throw error

            setExpenses(expenses.filter((e) => e.id !== id))
            toast.success('Expense removed')
        } catch (error) {
            console.error('Error removing expense:', error)
            toast.error('Failed to remove expense')
        }
    }

    const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0)
    const remaining = monthlyBudget - totalSpent
    const progress = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0

    // Student Analytics
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const thisWeekExpenses = expenses.filter(e => new Date(e.expense_date) >= startOfWeek)
    const lastWeekExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date)
        return d >= startOfLastWeek && d < startOfWeek
    })

    const thisWeekSpent = thisWeekExpenses.reduce((sum, e) => sum + e.amount, 0)
    const lastWeekSpent = lastWeekExpenses.reduce((sum, e) => sum + e.amount, 0)
    const weeklyChange = lastWeekSpent > 0 ? ((thisWeekSpent - lastWeekSpent) / lastWeekSpent * 100) : 0

    // Daily average (last 30 days)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const last30DaysExpenses = expenses.filter(e => new Date(e.expense_date) >= thirtyDaysAgo)
    const dailyAverage = last30DaysExpenses.length > 0
        ? last30DaysExpenses.reduce((sum, e) => sum + e.amount, 0) / 30
        : 0

    // Days until balance runs out
    const daysUntilEmpty = dailyAverage > 0 ? Math.floor(remaining / dailyAverage) : Infinity

    // Low balance threshold (7 days of average spending)
    const lowBalanceThreshold = dailyAverage * 7
    const isLowBalance = remaining < lowBalanceThreshold && remaining > 0

    const spendingByCategory = categories.map(cat => ({
        ...cat,
        amount: expenses
            .filter(e => e.category === cat.id)
            .reduce((sum, e) => sum + e.amount, 0)
    })).filter(cat => cat.amount > 0).sort((a, b) => b.amount - a.amount)

    const topCategory = spendingByCategory[0]

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
                    <h1 className="text-3xl font-bold text-white">Budget Tracker</h1>
                    <p className="text-gray-400 mt-1">Manage your monthly expenses and savings</p>
                </div>
                <div className="flex gap-2">
                    {/* SMS/Email Parse Dialog */}
                    <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2 border-violet-500/30 hover:bg-violet-500/10">
                                <MessageSquare className="h-4 w-4 text-violet-400" />
                                Paste SMS
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="glass-card border-violet-500/20">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-white">
                                    <Sparkles className="h-5 w-5 text-violet-400" />
                                    Auto-Extract Expense
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400">
                                    Paste your bank SMS, UPI notification, or email text below
                                </p>
                                <Textarea
                                    placeholder="e.g., Your A/c XX1234 debited by Rs.250.00 on 15-Jan for UPI-Swiggy"
                                    value={smsText}
                                    onChange={(e) => setSmsText(e.target.value)}
                                    rows={4}
                                    className="bg-white/5 border-white/10 focus:border-violet-500/50"
                                />
                                <Button
                                    onClick={parseSmsText}
                                    disabled={isParsing || !smsText.trim()}
                                    className="w-full gradient-primary text-white"
                                >
                                    {isParsing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Extract Expense
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        onClick={() => setShowAddForm(true)}
                        className="gradient-primary text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Expense
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-violet-500/20">
                                    <Wallet className="h-6 w-6 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Current Balance</p>
                                    {isEditingBudget ? (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Input
                                                type="number"
                                                value={tempBudget}
                                                onChange={(e) => setTempBudget(e.target.value)}
                                                className="h-8 w-24 bg-white/10 border-white/20 px-2 text-sm"
                                                autoFocus
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300" onClick={updateBudget}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-400 hover:text-rose-300" onClick={() => setIsEditingBudget(false)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <p className="text-2xl font-bold text-white">₹{monthlyBudget.toLocaleString()}</p>
                                            <button onClick={startEditing} className="text-gray-500 hover:text-violet-400 transition-colors">
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Add Money Button */}
                            {showAddMoney ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Amount"
                                        value={addMoneyAmount}
                                        onChange={(e) => setAddMoneyAmount(e.target.value)}
                                        className="h-8 w-24 bg-white/10 border-white/20 px-2 text-sm"
                                    />
                                    <Button size="icon" className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600" onClick={addMoney} disabled={isSavingBudget}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowAddMoney(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                                    onClick={() => setShowAddMoney(true)}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Money
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-rose-500/20">
                                <TrendingDown className="h-6 w-6 text-rose-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Total Spent</p>
                                <p className="text-2xl font-bold text-white">₹{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-500/20">
                                <TrendingUp className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Remaining</p>
                                <p className="text-2xl font-bold text-white">₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Budget Progress */}
            <Card className="glass-card border-white/[0.06]">
                <CardContent className="p-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-400">Balance Used</span>
                        <span className={cn("text-sm font-bold", progress > 90 ? "text-rose-400" : "text-emerald-400")}>
                            {progress.toFixed(1)}%
                        </span>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                progress > 90 ? "bg-gradient-to-r from-rose-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"
                            )}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Low Balance Alert */}
            {isLowBalance && (
                <Card className="border-amber-500/30 bg-amber-500/10">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                                <Wallet className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-amber-300 font-medium">Running Low! ⚠️</p>
                                <p className="text-amber-200/70 text-sm">
                                    ~{daysUntilEmpty} days left at current rate. Maybe time to ask parents? 😅
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Student Insights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* This Week */}
                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-400 mb-1">This Week</p>
                        <p className="text-xl font-bold text-white">₹{thisWeekSpent.toLocaleString()}</p>
                        {lastWeekSpent > 0 && (
                            <p className={cn("text-xs mt-1", weeklyChange > 0 ? "text-rose-400" : "text-emerald-400")}>
                                {weeklyChange > 0 ? "↑" : "↓"} {Math.abs(weeklyChange).toFixed(0)}% vs last week
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Average */}
                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Daily Average</p>
                        <p className="text-xl font-bold text-white">₹{dailyAverage.toFixed(0)}</p>
                        <p className="text-xs text-gray-500 mt-1">last 30 days</p>
                    </CardContent>
                </Card>

                {/* Days Left */}
                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Balance Lasts</p>
                        <p className="text-xl font-bold text-white">
                            {daysUntilEmpty === Infinity ? "∞" : `${daysUntilEmpty} days`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">at current rate</p>
                    </CardContent>
                </Card>

                {/* Top Category */}
                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Top Spending</p>
                        {topCategory ? (
                            <>
                                <p className="text-xl font-bold text-white">{topCategory.label.split(' ')[0]}</p>
                                <p className="text-xs text-gray-500 mt-1">₹{topCategory.amount.toFixed(0)}</p>
                            </>
                        ) : (
                            <p className="text-xl font-bold text-white">-</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Breakdown */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Spending by Category</h3>
                    {spendingByCategory.length === 0 ? (
                        <div className="glass-card p-6 text-center border-white/[0.06]">
                            <p className="text-gray-400 text-sm">No spending data yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {spendingByCategory.map((cat) => (
                                <div key={cat.id} className="glass-card p-4 border-white/[0.06]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg", cat.color)}>
                                                <cat.icon className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium text-white">{cat.label}</span>
                                        </div>
                                        <span className="font-bold text-white">₹{cat.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white/20 rounded-full"
                                            style={{ width: `${(cat.amount / totalSpent) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Expenses List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Recent Expenses</h3>

                    {/* Add Expense Form */}
                    {showAddForm && (
                        <Card className="glass-card border-violet-500/30 bg-violet-500/5 mb-4">
                            <CardHeader>
                                <CardTitle className="text-lg text-white">Add New Expense</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <Label className="text-gray-400">Description</Label>
                                        <Input
                                            placeholder="e.g., Grocery shopping"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                            className="bg-white/5 border-white/10 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-gray-400">Amount (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={newExpense.amount}
                                            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                            className="bg-white/5 border-white/10 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-gray-400">Category</Label>
                                        <select
                                            value={newExpense.category}
                                            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                            className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white mt-1"
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id} className="bg-gray-900">{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button onClick={addExpense} className="gradient-primary text-white" disabled={isSubmitting}>
                                        {isSubmitting ? 'Adding...' : 'Add Expense'}
                                    </Button>
                                    <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-gray-400" disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {expenses.length === 0 ? (
                        <Card className="glass-card border-white/[0.06]">
                            <CardContent className="p-8 text-center">
                                <IndianRupee className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">No expenses recorded yet</p>
                                <Button
                                    variant="link"
                                    onClick={() => setShowAddForm(true)}
                                    className="text-violet-400 mt-2"
                                >
                                    Add your first expense
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {expenses.map((expense) => {
                                const category = categories.find(c => c.id === expense.category) || categories[5]
                                return (
                                    <div
                                        key={expense.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors group border border-white/[0.03]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("p-2.5 rounded-xl", category.color)}>
                                                <category.icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{expense.description}</p>
                                                <p className="text-xs text-gray-400">{formatDateMDY(expense.expense_date)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="font-bold text-white">₹{expense.amount.toFixed(2)}</p>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeExpense(expense.id)}
                                                className="h-8 w-8 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
