import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
    test('should load and show hero content', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })

    test('should have navigation links to login and signup', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('link', { name: /sign in|login|log in/i })).toBeVisible()
        await expect(page.getByRole('link', { name: /sign up|get started/i })).toBeVisible()
    })
})

test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto('/dashboard')
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })

    test('should redirect unauthenticated users from notes', async ({ page }) => {
        await page.goto('/dashboard/notes')
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })
})
