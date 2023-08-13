import { processTaggedTemplateExpression } from './processTaggedTemplateExpression'
import { Theme } from './types'
import { Node, Project } from 'ts-morph'
export { parseTheme } from './parseTheme'
export type { Theme } from './types'

const project = new Project()

export function compile(code: string, filePath: string, theme: Theme | null) {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  file.forEachDescendant((node) => {
    if (Node.isTaggedTemplateExpression(node)) {
      processTaggedTemplateExpression(node, 'styled', theme)
    }
  })
  return { code: file.getFullText() }
}
