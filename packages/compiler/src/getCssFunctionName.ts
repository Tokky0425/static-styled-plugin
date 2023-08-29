import { Node, SourceFile } from 'ts-morph'

export function getCssFunctionName(file: SourceFile): string | null {
  let cssFunctionName: string | null = null

  file.forEachDescendant((node) => {
    if (cssFunctionName) return
    if (!Node.isImportDeclaration(node)) return
    if (node.getModuleSpecifier().getLiteralText() !== 'styled-components') return

    const importClause = node.getImportClause()
    const namedImports = importClause?.getNamedImports()
    if (!namedImports) return

    for (const namedImport of namedImports) {
      const nameIdentifier = namedImport.compilerNode.name
      const propertyNameIdentifier = namedImport.compilerNode.propertyName
      const nameIdentifierText = nameIdentifier.escapedText
      const propertyNameIdentifierText = propertyNameIdentifier?.escapedText

      if (!propertyNameIdentifierText && nameIdentifierText === 'css') {
        // e.g. import { css } from 'styled-components'
        cssFunctionName = nameIdentifierText
      } else if (propertyNameIdentifierText === 'css' && nameIdentifierText) {
        // e.g. import { css as something } from 'styled-components'
        cssFunctionName = nameIdentifierText
      }
    }
  })

  return cssFunctionName // normally 'css' if it exists
}
