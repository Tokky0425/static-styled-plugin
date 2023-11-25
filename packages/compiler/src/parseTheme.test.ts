import { describe, expect, test } from 'vitest'
import { Project } from 'ts-morph'
import { getThemeValue } from './parseTheme'

describe('parseTheme', async () => {
  const ts = (await import('typescript')).default
  const project = new Project()

  describe('when theme is declared as it expects', () => {
    describe('without computation', () => {
      test('should be parsed', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
                const theme = {
                  color: 'red',
                } as const
                `,
          {
            overwrite: true,
          },
        )
        const result = getThemeValue(file, ts)
        expect(result).toEqual({
          color: 'red',
        })
      })
    })

    describe('with computation', () => {
      test('should be parsed', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
                const getColor = () => 'red'
                const theme = {
                  color: getColor(),
                } as const
                `,
          {
            overwrite: true,
          },
        )
        const result = getThemeValue(file, ts)
        expect(result).toEqual({
          color: 'red',
        })
      })
    })
  })

  describe('when theme is declared with the name other than `theme`', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
                const myTheme = {
                  color: 'red',
                } as const
                `,
        {
          overwrite: true,
        },
      )
      const result = getThemeValue(file, ts)
      expect(result).toEqual(null)
    })
  })

  describe('when theme is not an object literal', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
                const theme = 'red' as const
                `,
        {
          overwrite: true,
        },
      )
      const result = getThemeValue(file, ts)
      expect(result).toEqual(null)
    })
  })

  describe('when theme is not declared with const assertion (`as const`)', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
                const theme = {
                  color: 'red',
                }
                `,
        {
          overwrite: true,
        },
      )
      const result = getThemeValue(file, ts)
      expect(result).toEqual(null)
    })
  })

  describe('when theme depends on values from node_modules', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
                import lighten from 'polished/lib/color/lighten'
                const theme = {
                  color: lighten('red'),
                } as const
                `,
        {
          overwrite: true,
        },
      )
      const result = getThemeValue(file, ts)
      expect(result).toEqual(null)
    })
  })
})
