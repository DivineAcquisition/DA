import { useEffect, useRef } from 'react'

export function useDebounced<T>(value: T, delay: number, onChange: (value: T) => void, enabled: boolean) {
  const skip = useRef(true)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled) return
    if (skip.current) {
      skip.current = false
      return
    }
    const timer = window.setTimeout(() => onChangeRef.current(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay, enabled])
}
