import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
    })

    test('should display the login form', async ({ page }) => {
        // Verify page title / heading
        await expect(page.getByText('Welcome back')).toBeVisible()

        // Verify form fields are present
        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator('#password')).toBeVisible()

        // Verify submit button
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

        // Verify Google OAuth button
        await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    })

    test('should have links to signup and forgot password', async ({ page }) => {
        await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible()
        await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
    })

    test('should show error on invalid credentials', async ({ page }) => {
        await page.locator('#email').fill('invalid@example.com')
        await page.locator('#password').fill('wrongpassword')
        await page.getByRole('button', { name: /sign in/i }).click()

        // Expect an error toast to appear
        await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10_000 })
    })

    test('should show error on empty form submission', async ({ page }) => {
        // Click submit with empty fields — browser validation will block or app shows error
        await page.getByRole('button', { name: /sign in/i }).click()

        // Either the browser native validation tooltip appears or the email field is invalid
        const emailInput = page.locator('#email')
        const isInvalid = await emailInput.evaluate(
            (el) => !(el as HTMLInputElement).validity.valid
        )
        expect(isInvalid).toBe(true)
    })

    test('should navigate to signup page', async ({ page }) => {
        await page.getByRole('link', { name: /sign up/i }).click()
        await expect(page).toHaveURL(/\/signup/)
    })

    test('should navigate to forgot password page', async ({ page }) => {
        await page.getByRole('link', { name: /forgot password/i }).click()
        await expect(page).toHaveURL(/\/forgot-password/)
    })
})
