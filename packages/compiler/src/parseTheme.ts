import { Node, Project } from 'ts-morph'
import path from 'path'
import fs from 'fs'
import type { Theme } from './types'
import { Evaluator, TsEvalError } from './Evaluator'

const project = new Project()

/**
 * theme must meet the following conditions
 * - it is declared with the name `theme`
 * - it is an object literal
 * - it is declared with const assertion (`as const`)
 * - it does not depend on values from node_modules
 */
export function parseTheme(themeFileRelativePath: string): null | Theme {
  let themeResult: null | Theme = null
  const themeFilePath = path.join(process.cwd(), themeFileRelativePath)
  if (!fs.existsSync(themeFilePath)) return themeResult

  const fileBuffer = fs.readFileSync(themeFilePath)
  const file = project.createSourceFile(themeFilePath, fileBuffer.toString(), { overwrite: true })
  const variableDeclarations = file.getVariableDeclarations()

  for (const variableDeclaration of variableDeclarations) {
    if (themeResult) continue
    if (variableDeclaration.getName() === 'theme') {
      const initializer = variableDeclaration.getInitializer()
      if (!Node.isAsExpression(initializer)) continue

      const value = initializer.getExpression()
      if (!value || !Node.isObjectLiteralExpression(value)) continue

      const evaluator = new Evaluator({ extra: {}, definition: { cssFunctionName: null }, theme: null })
      const objectLiteralResult = evaluator.evaluateObjectLiteralExpression(value)
      if (objectLiteralResult !== TsEvalError) {
        themeResult = objectLiteralResult
      }
    }
  }

  return themeResult
}
