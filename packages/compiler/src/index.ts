import { processTaggedTemplateExpression } from './processTaggedTemplateExpression'
import { Theme } from './types'
import { Node, Project } from 'ts-morph'
export { parseTheme } from './parseTheme'
import { getStyledFunctionName } from './getStyledFunctionName'
export type { Theme } from './types'

const project = new Project()

export function compile(code: string, filePath: string, theme: Theme | null) {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  const styledFunctionName = getStyledFunctionName(file)
  if (!styledFunctionName) return file.getFullText()

  processTaggedTemplateExpression(file, styledFunctionName, theme)
  return file.getFullText()
}
