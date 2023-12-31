import { SourceFile } from 'ts-morph'

export function getCssFunctionName(file: SourceFile): string | null {
  const importDeclarations = file.getImportDeclarations()
  let cssFunctionName: string | null = null

  for (const importDeclaration of importDeclarations) {
    if (cssFunctionName) break
    if (
      importDeclaration.getModuleSpecifier().getLiteralText() !==
      'styled-components'
    )
      continue

    const importClause = importDeclaration.getImportClause()
    const namedImports = importClause?.getNamedImports()
    if (!namedImports) break

    for (const namedImport of namedImports) {
      const nameIdentifier = namedImport.compilerNode.name
      const propertyNameIdentifier = namedImport.compilerNode.propertyName
      const nameIdentifierText = nameIdentifier.escapedText
      const propertyNameIdentifierText = propertyNameIdentifier?.escapedText

      if (!propertyNameIdentifierText && nameIdentifierText === 'css') {
        // e.g. import { css } from 'styled-components'
        cssFunctionName = nameIdentifierText
        break
      } else if (propertyNameIdentifierText === 'css' && nameIdentifierText) {
        // e.g. import { css as something } from 'styled-components'
        cssFunctionName = nameIdentifierText
        break
      }
    }
  }

  return cssFunctionName // normally 'css' if it exists
}
