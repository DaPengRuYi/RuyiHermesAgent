import { describe, expect, it, vi } from 'vitest'

import { createUserActivatedHapticTrigger, hapticsDebugEnabled, hasUserActivatedHaptics } from './haptics-provider'

describe('haptics build mode', () => {
  it('keeps debug feedback out of production builds', () => {
    expect(hapticsDebugEnabled({ DEV: false, PROD: true })).toBe(false)
    expect(hapticsDebugEnabled({ DEV: true, PROD: true })).toBe(false)
    expect(hapticsDebugEnabled({ DEV: true, PROD: false })).toBe(true)
  })
})

describe('user-activation guard', () => {
  it('requires sticky user activation before haptics can reach navigator.vibrate', async () => {
    let hasBeenActive = false
    const trigger = vi.fn(async () => undefined)
    const guarded = createUserActivatedHapticTrigger(trigger, () => ({ userActivation: { hasBeenActive } }))

    expect(guarded([{ duration: 10, intensity: 0.5 }])).toBeUndefined()
    expect(trigger).not.toHaveBeenCalled()

    hasBeenActive = true
    await guarded([{ duration: 10, intensity: 0.5 }])
    expect(trigger).toHaveBeenCalledOnce()
  })

  it('fails closed when the user-activation API is unavailable', () => {
    expect(hasUserActivatedHaptics(undefined)).toBe(false)
    expect(hasUserActivatedHaptics({})).toBe(false)
  })
})
