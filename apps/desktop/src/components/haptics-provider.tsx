import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useMemo } from 'react'
import { useWebHaptics } from 'web-haptics/react'

import { type HapticTrigger, registerHapticTrigger } from '@/lib/haptics'
import { $hapticsMuted } from '@/store/haptics'

interface HapticsBuildEnv {
  DEV?: boolean
  PROD?: boolean
}

interface HapticsNavigator {
  userActivation?: {
    hasBeenActive?: boolean
  }
}

export function hapticsDebugEnabled(env: HapticsBuildEnv = import.meta.env): boolean {
  return env.DEV === true && env.PROD !== true
}

export function hasUserActivatedHaptics(nav: HapticsNavigator | undefined): boolean {
  return nav?.userActivation?.hasBeenActive === true
}

export function createUserActivatedHapticTrigger(
  trigger: HapticTrigger,
  getNavigator: () => HapticsNavigator | undefined = () => (typeof navigator === 'undefined' ? undefined : navigator)
): HapticTrigger {
  return (input, options) => {
    // Chromium warns (and ignores navigator.vibrate) until the document has
    // received a real user gesture. Startup/reconnect events can request a
    // haptic before that point, so keep them from reaching web-haptics at all.
    if (!hasUserActivatedHaptics(getNavigator())) {
      return undefined
    }

    return trigger(input, options)
  }
}

export function HapticsProvider({ children }: { children: ReactNode }) {
  const muted = useStore($hapticsMuted)
  const { trigger } = useWebHaptics({ debug: hapticsDebugEnabled(), showSwitch: false })
  const activatedTrigger = useMemo(() => createUserActivatedHapticTrigger(trigger), [trigger])

  useEffect(() => {
    registerHapticTrigger(muted ? null : activatedTrigger)

    return () => registerHapticTrigger(null)
  }, [activatedTrigger, muted])

  return <>{children}</>
}
