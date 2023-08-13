import { Node, SourceFile } from 'ts-morph'

export function getStyledFunctionName(file: SourceFile): string | null {
  let styledFunctionName: string | null = null

  file.forEachDescendant((node) => {
    if (styledFunctionName) return
    if (!Node.isImportDeclaration(node)) return
    if (node.getModuleSpecifier().getText() === '\'styled-components\'') {
      const importClause = node.getImportClause()
      styledFunctionName = importClause?.getDefaultImport()?.getText() ?? null
    }
  })

  return styledFunctionName // normally 'styled' if it exists
}
