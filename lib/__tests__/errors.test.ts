import { describe, it, expect } from 'vitest'
import {
    AppError,
    getErrorMessage,
    isErrorWithMessage
} from '../errors'

describe('AppError', () => {
    it('should create error with message and status code', () => {
        const error = new AppError('Not found', 404)
        expect(error.message).toBe('Not found')
        expect(error.statusCode).toBe(404)
        expect(error.isOperational).toBe(true)
    })

    it('should default to status 500', () => {
        const error = new AppError('Server error')
        expect(error.statusCode).toBe(500)
    })

    it('should be instance of Error', () => {
        const error = new AppError('Test error')
        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(AppError)
    })
})

describe('isErrorWithMessage', () => {
    it('should return true for Error objects', () => {
        expect(isErrorWithMessage(new Error('test'))).toBe(true)
    })

    it('should return true for objects with message property', () => {
        expect(isErrorWithMessage({ message: 'test' })).toBe(true)
    })

    it('should return false for strings', () => {
        expect(isErrorWithMessage('error string')).toBe(false)
    })

    it('should return false for null', () => {
        expect(isErrorWithMessage(null)).toBe(false)
    })

    it('should return false for undefined', () => {
        expect(isErrorWithMessage(undefined)).toBe(false)
    })

    it('should return false for objects without message', () => {
        expect(isErrorWithMessage({ error: 'test' })).toBe(false)
    })
})

describe('getErrorMessage', () => {
    it('should extract message from Error', () => {
        expect(getErrorMessage(new Error('test error'))).toBe('test error')
    })

    it('should extract message from object with message property', () => {
        expect(getErrorMessage({ message: 'custom message' })).toBe('custom message')
    })

    it('should stringify non-error values', () => {
        expect(getErrorMessage('string error')).toBe('string error')
        expect(getErrorMessage(42)).toBe('42')
    })
})
