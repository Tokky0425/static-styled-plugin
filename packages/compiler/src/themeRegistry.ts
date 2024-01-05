import { Theme } from './types'
import { parseTheme } from './parseTheme'

class ThemeRegistry {
  private theme: Theme | null
  constructor() {
    this.theme = null
  }
  register(themeFilePath: string | null) {
    this.theme = themeFilePath ? parseTheme(themeFilePath) : null
  }
  getTheme() {
    return this.theme
  }
}

export const themeRegistry = new ThemeRegistry()
