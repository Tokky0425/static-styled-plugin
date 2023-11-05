import { SourceFile } from 'ts-morph'

export function getStyledFunctionName(file: SourceFile): string | null {
  const importDeclarations = file.getImportDeclarations()
  let styledFunctionName: string | null = null

  for (const importDeclaration of importDeclarations) {
    if (styledFunctionName) continue
    if (
      importDeclaration.getModuleSpecifier().getLiteralText() ===
      'styled-components'
    ) {
      const importClause = importDeclaration.getImportClause()
      styledFunctionName = importClause?.getDefaultImport()?.getText() ?? null
    }
  }

  return styledFunctionName // normally 'styled' if it exists
}
