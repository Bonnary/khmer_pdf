import { useState, useEffect, useCallback } from 'react'

/**
 * Interface representing a local font available on the user's system
 */
export interface LocalFont {
  /** The PostScript name of the font */
  postscriptName: string
  /** The full name of the font */
  fullName: string
  /** The family name of the font */
  family: string
  /** The style of the font (e.g., "Regular", "Bold", "Italic") */
  style: string
}

/**
 * State interface for the useLocalFonts hook
 */
interface UseLocalFontsState {
  /** Array of available local fonts */
  fonts: LocalFont[]
  /** Loading state */
  isLoading: boolean
  /** Error message if font enumeration fails */
  error: string | null
  /** Whether the Font Access API is supported */
  isSupported: boolean
}

/**
 * Return type for the useLocalFonts hook
 */
interface UseLocalFontsReturn extends UseLocalFontsState {
  /** Function to manually refresh the font list */
  refetch: () => Promise<void>
  /** Function to request font access permission */
  requestPermission: () => Promise<PermissionState | null>
}

/**
 * Check if the Local Font Access API is supported
 */
const isFontAccessSupported = (): boolean => {
  return 'queryLocalFonts' in window
}

/**
 * Custom React hook to access and enumerate local fonts on the user's machine
 * 
 * This hook uses the Local Font Access API (also known as Font Access API) which
 * allows web applications to access the user's locally installed fonts.
 * 
 * Browser Support:
 * - Chrome/Edge 103+ (with flag enabled in earlier versions)
 * - Not supported in Firefox or Safari as of 2024
 * 
 * Permissions:
 * - Requires "local-fonts" permission
 * - User will be prompted to grant permission on first use
 * 
 * @param autoFetch - Whether to automatically fetch fonts on mount (default: true)
 * @returns Object containing fonts array, loading state, error, and utility functions
 * 
 * @example
 * ```tsx
 * function FontSelector() {
 *   const { fonts, isLoading, error, isSupported } = useLocalFonts()
 * 
 *   if (!isSupported) {
 *     return <p>Font Access API is not supported in this browser</p>
 *   }
 * 
 *   if (isLoading) return <p>Loading fonts...</p>
 *   if (error) return <p>Error: {error}</p>
 * 
 *   return (
 *     <select>
 *       {fonts.map(font => (
 *         <option key={font.postscriptName} value={font.postscriptName}>
 *           {font.fullName} ({font.family})
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export function useLocalFonts(autoFetch = true): UseLocalFontsReturn {
  const [state, setState] = useState<UseLocalFontsState>({
    fonts: [],
    isLoading: false,
    error: null,
    isSupported: isFontAccessSupported(),
  })

  /**
   * Request permission to access local fonts
   */
  const requestPermission = useCallback(async (): Promise<PermissionState | null> => {
    if (!state.isSupported) {
      return null
    }

    try {
      // Check if Permissions API is available
      if ('permissions' in navigator && 'query' in navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          name: 'local-fonts' as PermissionName,
        })
        return permissionStatus.state
      }
      return null
    } catch (error) {
      console.warn('Unable to query font permission:', error)
      return null
    }
  }, [state.isSupported])

  /**
   * Fetch local fonts from the user's system
   */
  const fetchFonts = useCallback(async (): Promise<void> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: 'Local Font Access API is not supported in this browser',
      }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // Request access to local fonts
      // @ts-expect-error - queryLocalFonts is not yet in TypeScript's lib.dom.d.ts
      const availableFonts = await window.queryLocalFonts()

      // Map font data to our interface
      const fontList: LocalFont[] = await Promise.all(
        availableFonts.map(async (fontData: any) => ({
          postscriptName: fontData.postscriptName || '',
          fullName: fontData.fullName || '',
          family: fontData.family || '',
          style: fontData.style || '',
        }))
      )

      // Sort fonts alphabetically by family name
      fontList.sort((a, b) => a.family.localeCompare(b.family))

      setState((prev) => ({
        ...prev,
        fonts: fontList,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to access local fonts'

      setState((prev) => ({
        ...prev,
        fonts: [],
        isLoading: false,
        error: errorMessage,
      }))
    }
  }, [state.isSupported])

  /**
   * Refetch fonts manually
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchFonts()
  }, [fetchFonts])

  // Auto-fetch fonts on mount if enabled
  useEffect(() => {
    if (autoFetch && state.isSupported) {
      fetchFonts()
    }
  }, [autoFetch, state.isSupported, fetchFonts])

  return {
    ...state,
    refetch,
    requestPermission,
  }
}

/**
 * Hook to get a specific font by family name
 * 
 * @param familyName - The font family name to search for
 * @returns The matching font or null if not found
 * 
 * @example
 * ```tsx
 * function FontPreview({ fontFamily }: { fontFamily: string }) {
 *   const font = useLocalFont(fontFamily)
 *   
 *   if (!font) return <p>Font not found</p>
 *   
 *   return <p style={{ fontFamily: font.family }}>{font.fullName}</p>
 * }
 * ```
 */
export function useLocalFont(familyName: string): LocalFont | null {
  const { fonts } = useLocalFonts()
  return fonts.find((font) => font.family === familyName) || null
}

/**
 * Hook to filter fonts by family name or style
 * 
 * @param searchTerm - The search term to filter fonts
 * @returns Filtered array of fonts
 * 
 * @example
 * ```tsx
 * function FontSearch() {
 *   const [search, setSearch] = useState('')
 *   const filteredFonts = useFilteredFonts(search)
 *   
 *   return (
 *     <>
 *       <input 
 *         value={search} 
 *         onChange={(e) => setSearch(e.target.value)}
 *         placeholder="Search fonts..."
 *       />
 *       <ul>
 *         {filteredFonts.map(font => (
 *           <li key={font.postscriptName}>{font.fullName}</li>
 *         ))}
 *       </ul>
 *     </>
 *   )
 * }
 * ```
 */
export function useFilteredFonts(searchTerm: string): LocalFont[] {
  const { fonts } = useLocalFonts()
  const [filteredFonts, setFilteredFonts] = useState<LocalFont[]>([])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredFonts(fonts)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = fonts.filter(
      (font) =>
        font.family.toLowerCase().includes(term) ||
        font.fullName.toLowerCase().includes(term) ||
        font.style.toLowerCase().includes(term)
    )
    setFilteredFonts(filtered)
  }, [searchTerm, fonts])

  return filteredFonts
}

export default useLocalFonts
