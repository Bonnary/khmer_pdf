export type Language = 'eng' | 'chi_sim' | 'khm'

export interface LanguageOption {
  code: Language
  label: string
  flag: string
}

// ! tesseract js support over 100 languages, add more as needed
// ! please read here for supported languages: https://tesseract-ocr.github.io/tessdoc/Data-Files#data-files-for-version-400-november-29-2016

export const languages: LanguageOption[] = [
  { code: 'eng', label: 'English', flag: '🇬🇧' },
  { code: 'chi_sim', label: 'Chinese - Simplified', flag: '🇨🇳' },
  { code: 'khm', label: 'Central Khmer', flag: '🇰🇭' },
]
