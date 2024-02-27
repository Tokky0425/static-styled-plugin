import { describe, expect, test } from 'vitest'
import { Project } from 'ts-morph'
import { checkHasReactImportStatement } from './checkHasReactImportStatement'

describe('checkHasReactImportStatement', () => {
  const project = new Project()

  describe('when react import statement exists', () => {
    describe('single quote', () => {
      test('default import', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `import React from 'react'`,
          {
            overwrite: true,
          },
        )
        const result = checkHasReactImportStatement(file)
        expect(result).toBe(true)
      })
      test('named import', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `import React, { useState } from 'react'`,
          {
            overwrite: true,
          },
        )
        const result = checkHasReactImportStatement(file)
        expect(result).toBe(true)
      })
    })
    describe('double quote', () => {
      test('default import', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `import React from "react"`,
          {
            overwrite: true,
          },
        )
        const result = checkHasReactImportStatement(file)
        expect(result).toBe(true)
      })
      test('named import', () => {
        const file = project.createSourceFile(
          'virtual.ts',
          `import React, { useState } from "react"`,
          {
            overwrite: true,
          },
        )
        const result = checkHasReactImportStatement(file)
        expect(result).toBe(true)
      })
    })
  })
  describe('when react import statement does not exist', () => {
    test('', () => {
      const file = project.createSourceFile(
        'virtual.ts',
        `import styled from 'styled-components'`,
        {
          overwrite: true,
        },
      )
      const result = checkHasReactImportStatement(file)
      expect(result).toBe(false)
    })
  })
})
