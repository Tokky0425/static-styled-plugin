'use client'

import React, { PropsWithChildren } from 'react'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { theme } from '@/app/theme'

export function ThemeProvider(props: PropsWithChildren) {
  return <StyledThemeProvider {...props} theme={theme} />
}
