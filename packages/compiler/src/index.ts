import { compileStyledFunction } from './compileStyledFunction'
import { Theme } from './types'
import { Project } from 'ts-morph'
export { parseTheme } from './parseTheme'
import { extractUseClientExpression } from './extractUseClientExpression'
import { getStyledFunctionName } from './getStyledFunctionName'
import { getCssFunctionName } from './getCssFunctionName'
export type { Theme } from './types'

const project = new Project()

export function compile(code: string, filePath: string, theme: Theme | null) {
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  const styledFunctionName = getStyledFunctionName(file)
  if (!styledFunctionName) return { code: file.getFullText() }

  const cssFunctionName = getCssFunctionName(file)
  const useClientExpressionExtracted = extractUseClientExpression(file)
  const shouldUseClient = compileStyledFunction(
    file,
    styledFunctionName,
    cssFunctionName,
    theme,
  )
  return {
    code: file.getFullText(),
    useClientExpressionExtracted,
    shouldUseClient,
  }
}
