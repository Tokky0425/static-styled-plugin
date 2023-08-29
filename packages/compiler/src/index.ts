import { compileStyledFunction } from './compileStyledFunction'
import { Theme } from './types'
import { Project } from 'ts-morph'
export { parseTheme } from './parseTheme'
import { getStyledFunctionName } from './getStyledFunctionName'
import { getCssFunctionName } from './getCssFunctionName'
export type { Theme } from './types'

const project = new Project()

export function compile(code: string, filePath: string, theme: Theme | null) {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  const styledFunctionName = getStyledFunctionName(file)
  if (!styledFunctionName) return file.getFullText()
  const cssFunctionName = getCssFunctionName(file)

  compileStyledFunction(file, styledFunctionName, cssFunctionName, theme)
  return file.getFullText()
}
