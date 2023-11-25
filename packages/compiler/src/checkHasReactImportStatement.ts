import { SourceFile } from 'ts-morph'

export function checkHasReactImportStatement(file: SourceFile) {
  const importDeclarations = file.getImportDeclarations()
  let hasReactImportStatement = false

  for (const importDeclaration of importDeclarations) {
    if (importDeclaration.getModuleSpecifier().getLiteralText() === 'react') {
      const importClause = importDeclaration.getImportClause()
      if (importClause?.getDefaultImport()?.getText() === 'React') {
        hasReactImportStatement = true
        break
      }
    }
  }
  return hasReactImportStatement
}
