import { Node, SourceFile } from 'ts-morph'

export function extractUseClientExpression(file: SourceFile) {
  let useClientExpressionExtracted = false
  const descendants = file.getDescendants()
  const firstDescendant = descendants[1] // 0 is SyntaxList

  if (
    Node.isExpressionStatement(firstDescendant) &&
    (firstDescendant.getText() === "'use client'" ||
      firstDescendant.getText() === '"use client"')
  ) {
    firstDescendant.remove()
    useClientExpressionExtracted = true
  }

  return useClientExpressionExtracted
}
