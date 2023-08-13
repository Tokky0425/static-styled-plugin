import { Node, Project } from 'ts-morph'
import { evaluate } from 'ts-evaluator'
import path from 'path'
import fs from 'fs'
import type { Theme } from './types'

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
      if (!value) return
      const result = evaluate({
        node: value.compilerNode
      })
      themeResult = result.success ? result.value as Theme : null
    }
  })

  return themeResult
}
