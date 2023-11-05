import { Node, SourceFile } from 'ts-morph'

export function extractUseClientExpression(file: SourceFile) {
  let useClientExpressionExtracted = false
  file.forEachDescendant((node) => {
    if (useClientExpressionExtracted) return
    if (
      Node.isExpressionStatement(node) &&
      node.getFullText() === "'use client'"
    ) {
      node.remove()
      useClientExpressionExtracted = true
    }
  })
  return useClientExpressionExtracted
}
