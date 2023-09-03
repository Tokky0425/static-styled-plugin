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
  let themeResult: null | Theme = null

  file.forEachDescendant((node) => {
    if (themeResult) return
    if (Node.isVariableDeclaration(node) && node.getName() === 'theme') {
      const value = node.getInitializer()
      if (!value || !Node.isObjectLiteralExpression(value)) return
      const evaluator = new Evaluator({ extra: {}, definition: { cssFunctionName: null }, theme: null })
      const objectLiteralResult = evaluator.evaluateObjectLiteralExpression(value)
      if (objectLiteralResult !== TsEvalError) {
        themeResult = objectLiteralResult
      }
    }
  })

  return themeResult
}
