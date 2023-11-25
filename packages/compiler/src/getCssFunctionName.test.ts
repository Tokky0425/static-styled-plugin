import { describe, expect, test } from 'vitest'
import { Project } from 'ts-morph'
import { getCssFunctionName } from './getCssFunctionName'

describe('getCssFunctionName', () => {
  const project = new Project()

  describe('when css function is imported from styled-components', () => {
    describe('when imported with default name', () => {
      test('should be css', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
            import React from 'react'
            import { css } from 'styled-components'
            `,
          {
            overwrite: true,
          },
        )
        const result = getCssFunctionName(file)
        expect(result).toBe('css')
      })
    })

    describe('when imported with name given', () => {
      test('should be css', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
            import React from 'react'
            import { css as myCss } from 'styled-components'
            `,
          {
            overwrite: true,
          },
        )
        const result = getCssFunctionName(file)
        expect(result).toBe('myCss')
      })
    })
  })

  describe('when css function is imported from other library', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
            import React from 'react'
            import { css } from '@emotion/css'
            `,
        {
          overwrite: true,
        },
      )
      const result = getCssFunctionName(file)
      expect(result).toBe(null)
    })
  })
})
