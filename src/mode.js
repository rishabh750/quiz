export const IS_DESKTOP = typeof window !== 'undefined' && !!window.IS_DESKTOP
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || ''
