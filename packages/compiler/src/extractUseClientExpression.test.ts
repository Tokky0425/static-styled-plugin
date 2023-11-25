import { describe, expect, test } from 'vitest'
import { Project } from 'ts-morph'
import { extractUseClientExpression } from './extractUseClientExpression'

describe('extractUseClientExpression', () => {
  const project = new Project()

  describe('when use client expression exists', () => {
    describe('when single quote', () => {
      test('use client should be extracted', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
          'use client'
          import React from 'react'
          `,
          {
            overwrite: true,
          },
        )
        const result = extractUseClientExpression(file)
        expect(result).toBe(true)
        expect(file.getText().trim()).toBe(`import React from 'react'`)
      })
    })
    describe('when double quote', () => {
      test('use client should be extracted', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `
          "use client"
          import React from 'react'
          `,

          {
            overwrite: true,
          },
        )
        const result = extractUseClientExpression(file)
        expect(result).toBe(true)
        expect(file.getText().trim()).toBe(`import React from 'react'`)
      })
    })
  })

  describe('when use client expression does not exist', () => {
    test('nothing happens', () => {
      const sourceFileText = `
          'use server'
          import React from 'react'
          `
      const file = project.createSourceFile('virtual.ts', sourceFileText, {
        overwrite: true,
      })
      const result = extractUseClientExpression(file)
      expect(result).toBe(false)
      expect(file.getFullText()).toBe(sourceFileText)
    })
  })
})
