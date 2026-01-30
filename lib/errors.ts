import { NextResponse } from 'next/server'

/**
 * Custom application error class with status code support
 */
export class AppError extends Error {
    public readonly statusCode: number
    public readonly isOperational: boolean

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = isOperational
        Object.setPrototypeOf(this, AppError.prototype)
    }
}

/**
 * Standard error response format
 */
interface ErrorResponse {
    error: string
    code?: string
    details?: Record<string, unknown>
}

/**
 * Create a standardized API error response
 */
export function createApiErrorResponse(
    error: unknown,
    defaultMessage: string = 'An unexpected error occurred'
): NextResponse<ErrorResponse> {
    // Handle AppError instances
    if (error instanceof AppError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.statusCode }
        )
    }

    // Handle standard Error instances
    if (error instanceof Error) {
        // Log the full error for debugging
        console.error('API Error:', error)

        // Check for common error patterns
        if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in.' },
                { status: 401 }
            )
        }

        if (error.message.includes('not found') || error.message.includes('Not found')) {
            return NextResponse.json(
                { error: 'Resource not found' },
                { status: 404 }
            )
        }

        // Return the error message for operational errors, default message for others
        return NextResponse.json(
            { error: error.message || defaultMessage },
            { status: 500 }
        )
    }

    // Handle unknown error types
    console.error('Unknown error type:', error)
    return NextResponse.json(
        { error: defaultMessage },
        { status: 500 }
    )
}

/**
 * Validation error helper
 */
export function validationErrorResponse(message: string, details?: Record<string, string>): NextResponse<ErrorResponse> {
    return NextResponse.json(
        { error: message, details },
        { status: 400 }
    )
}

/**
 * Not found error helper
 */
export function notFoundResponse(resource: string = 'Resource'): NextResponse<ErrorResponse> {
    return NextResponse.json(
        { error: `${resource} not found` },
        { status: 404 }
    )
}

/**
 * Forbidden error helper
 */
export function forbiddenResponse(message: string = 'You do not have permission to access this resource'): NextResponse<ErrorResponse> {
    return NextResponse.json(
        { error: message },
        { status: 403 }
    )
}

/**
 * Success response helper for consistent API responses
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
    return NextResponse.json(data, { status })
}

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    )
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
    if (isErrorWithMessage(error)) {
        return error.message
    }
    return String(error)
}
