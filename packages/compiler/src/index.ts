import { compileStyledFunction } from './compileStyledFunction'
import { Project } from 'ts-morph'
import { extractUseClientExpression } from './extractUseClientExpression'
import { getStyledFunctionName } from './getStyledFunctionName'
import { getCssFunctionName } from './getCssFunctionName'
import { checkHasReactImportStatement } from './checkHasReactImportStatement'
export type { Theme } from './types'
export { parseTheme } from './parseTheme'
export { styleRegistry } from './styleRegistry'
export { themeRegistry } from './themeRegistry'

export function compile(
  code: string,
  filePath: string,
  options?: { devMode?: boolean; prefix?: string },
) {
  const project = new Project()
  const file = project.createSourceFile(filePath, code, { overwrite: true })
  const styledFunctionName = getStyledFunctionName(file)
  if (!styledFunctionName) return { code: file.getFullText() }

  const cssFunctionName = getCssFunctionName(file)
  const useClientExpressionExtracted = extractUseClientExpression(file)
  const hasReactImportStatement = checkHasReactImportStatement(file)
  const shouldUseClient = compileStyledFunction(
    file,
    styledFunctionName,
    cssFunctionName,
    options,
  )
  return {
    code: file.getFullText(),
    useClientExpressionExtracted,
    hasReactImportStatement,
    shouldUseClient,
  }
}
