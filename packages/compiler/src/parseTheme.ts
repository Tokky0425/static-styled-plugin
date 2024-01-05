import { Node, Project, SourceFile } from 'ts-morph'
import fs from 'fs'
import type { Theme } from './types'
import { Evaluator, TsEvalError } from './Evaluator'
import * as TS from 'typescript'

const project = new Project()

/**
 * theme must meet the following conditions
 * - it is declared with the name `theme`
 * - it is an object literal
 * - it is declared with const assertion (`as const`)
 * - it does not depend on values from node_modules
 */
export function parseTheme(themeFilePath: string): null | Theme {
  if (!fs.existsSync(themeFilePath)) return null

  const fileBuffer = fs.readFileSync(themeFilePath)
  const file = project.createSourceFile(themeFilePath, fileBuffer.toString(), {
    overwrite: true,
  })
  return getThemeValue(file)
}

export function getThemeValue(file: SourceFile, ts?: typeof TS) {
  let themeResult: null | Theme = null
  const variableDeclarations = file.getVariableDeclarations()

  for (const variableDeclaration of variableDeclarations) {
    if (variableDeclaration.getName() !== 'theme') continue
    const descendants = variableDeclaration.getDescendants()

    /**
     * theme must be declared with const assertion (`as const`)
     */
    let asConstFound = false
    for (const descendant of descendants) {
      if (Node.isAsExpression(descendant)) {
        asConstFound = true
        break
      }
    }
    if (!asConstFound) break

    const initializer = variableDeclaration.getInitializer()
    const evaluator = new Evaluator({
      extra: {},
      definition: {
        cssFunctionName: null,
        ts,
      },
      theme: null,
    })
    const result = initializer ? evaluator.evaluateNode(initializer) : null

    if (
      result === TsEvalError ||
      typeof result === 'string' ||
      typeof result === 'number' ||
      result === null ||
      Array.isArray(result)
    ) {
      break
    }
    themeResult = result
    break
  }

  return themeResult
}
