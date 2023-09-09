import { Node, Project } from 'ts-morph'
import path from 'path'
import fs from 'fs'
import type { Theme } from './types'
import { Evaluator, TsEvalError } from './Evaluator'

const project = new Project()
export function parseTheme(themeFileRelativePath: string): null | Theme {
  const themeFilePath = path.join(process.cwd(), themeFileRelativePath)
  const fileBuffer = fs.readFileSync(themeFilePath)
  const file = project.createSourceFile(themeFilePath, fileBuffer.toString(), { overwrite: true })
  const variableDeclarations = file.getVariableDeclarations()
  let themeResult: null | Theme = null

  for (const variableDeclaration of variableDeclarations) {
    if (themeResult) continue
    if (variableDeclaration.getName() === 'theme') {
      const value = variableDeclaration.getInitializer()
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
