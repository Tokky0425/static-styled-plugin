import { describe, expect, test } from 'vitest'
import { Project } from 'ts-morph'
import { getStyledFunctionName } from './getStyledFunctionName'

describe('getStyledFunctionName', () => {
  const project = new Project()

  describe('when styled function is imported from styled-components', () => {
    describe('when the name is styled', () => {
      test('should be styled', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
            import React from 'react'
            import styled from 'styled-components'
            `,
          {
            overwrite: true,
          },
        )
        const result = getStyledFunctionName(file)
        expect(result).toBe('styled')
      })
    })

    describe('when the name is not styled', () => {
      test('should be styled', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
            import React from 'react'
            import myStyled from 'styled-components'
            `,
          {
            overwrite: true,
          },
        )
        const result = getStyledFunctionName(file)
        expect(result).toBe('myStyled')
      })
    })
  })

  describe('when styled function is not imported from styled-components', () => {
    test('should be null', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `
            import React from 'react'
            import styled from '@emotion/styled'
            `,
        {
          overwrite: true,
        },
      )
      const result = getStyledFunctionName(file)
      expect(result).toBe(null)
    })
  })
})
