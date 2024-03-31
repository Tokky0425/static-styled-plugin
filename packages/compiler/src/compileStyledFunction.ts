import {
  ArrowFunction,
  CallExpression,
  Node,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  SourceFile,
  SyntaxKind,
  TaggedTemplateExpression,
} from 'ts-morph'
import { styleRegistry } from './styleRegistry'
import { isHTMLTag } from './isHTMLTag'
import { generateClassNameHash } from './generateClassNameHash'
import { compileCssString } from './compileCssString'
import { Evaluator, TsEvalError } from './Evaluator'
import { themeRegistry } from './themeRegistry'

const DEFAULT_PREFIX = 'ss'

export function compileStyledFunction(
  file: SourceFile,
  styledFunctionName: string,
  cssFunctionName: string | null,
  options?: { devMode?: boolean; prefix?: string },
) {
  let shouldUseClient = false
  const replaceTargetMeta: Array<{ node: Node; replaceText: string }> = []

  const evaluator = new Evaluator({
    extra: {},
    definition: { styledFunctionName, cssFunctionName },
    theme: themeRegistry.getTheme(),
  })

  file.forEachDescendant((node) => {
    const nodeResult = parseNode(node, evaluator)
    if (!nodeResult.success) {
      shouldUseClient = !shouldUseClient
        ? nodeResult.shouldUseClient
        : shouldUseClient
      return
    }

    const { componentName, htmlTagName, cssString, attrsArgs } = nodeResult
    if (componentName === null || htmlTagName === null) return // this should not happen

    const processDir = process.cwd()
    const fileDir = file.getDirectoryPath()
    const relativeFileDir = fileDir.replace(processDir, '')
    const fileBaseName = file.getBaseName()
    const relativeFilePath = `${relativeFileDir}/${fileBaseName}`
    const classNameHash = generateClassNameHash(
      relativeFilePath + node.getStartLineNumber() + cssString,
    )
    const prefix = options?.devMode ? options?.prefix || DEFAULT_PREFIX : ''
    const className = [prefix, classNameHash].filter(Boolean).join('-')
    const compiledCssString = compileCssString(cssString, className)
    styleRegistry.addRule(classNameHash, compiledCssString)

    const attrsDeclaration = attrsArgs
      .map((attrsArg, index) => `const attrs${index} = ${attrsArg.getText()}`)
      .join('\n')
    const attrsProps = attrsArgs
      .map((attrsArg, index) => {
        switch (attrsArg.getKindName()) {
          case 'ArrowFunction':
            return `...attrs${index}(props)`
          case 'ObjectLiteralExpression':
            return `...attrs${index}`
          default: {
            throw new Error(
              'attrs only accepts ArrowFunction or ObjectLiteralExpression.',
            )
          }
        }
      })
      .join(', ')

    let hintClassNameByFileName = ''
    if (options?.devMode) {
      const fileBaseNameWithoutExtension = file.getBaseNameWithoutExtension()
      hintClassNameByFileName =
        [fileBaseNameWithoutExtension, componentName]
          .filter(Boolean)
          .join('__') +
        '-' +
        prefix
    }
    const replaceText = `
    (props: any) => {
      ${attrsDeclaration}
      const attrsProps = { ${attrsProps} } as any
      const propsWithAttrs = { ...props, ...attrsProps } as any
      const joinedClassName = ['${hintClassNameByFileName}', '${className}', attrsProps.className, props.className].filter(Boolean).join(' ')
      return <${htmlTagName} { ...propsWithAttrs } className={joinedClassName} />;
    }
  `

    replaceTargetMeta.push({
      node,
      replaceText,
    })
  })

  replaceTargetMeta.forEach(({ node, replaceText }) => {
    node.replaceWithText(replaceText)
  })

  return shouldUseClient
}

type ParseNodeResult = {
  success: boolean
  componentName: string | null
  htmlTagName: string | null
  cssString: string
  attrsArgs: AttrsArg[]
  shouldUseClient: boolean
}
const defaultParseNodeResult: ParseNodeResult = {
  success: false,
  componentName: null,
  htmlTagName: null,
  cssString: '',
  attrsArgs: [],
  shouldUseClient: false,
}
function parseNode(
  node: Node,
  evaluator: Evaluator,
  descendantResult: ParseNodeResult = defaultParseNodeResult,
): ParseNodeResult {
  if (!Node.isTaggedTemplateExpression(node)) return defaultParseNodeResult

  const tagNode = node.getTag()
  const styledExpression = getStyledExpression(tagNode, 'styled') // TODO あとでなんとかする
  if (!styledExpression) return defaultParseNodeResult

  const styledFuncArg = getStyledFuncArg(styledExpression)
  if (/* e.g. styled() */ styledFuncArg === null) {
    return { ...defaultParseNodeResult, shouldUseClient: true }
  }

  const componentName =
    descendantResult.componentName ?? getVariableDeclarationName(node)
  const evaluatedCssString =
    evaluator.evaluateStyledTaggedTemplateExpression(node)
  if (evaluatedCssString === TsEvalError) {
    return { ...defaultParseNodeResult, shouldUseClient: true }
  }
  const attrsArgs = getAttrsArgs(tagNode)

  if (typeof styledFuncArg === 'string') {
    /* e.g. styled('p') or styled.p */
    if (!isHTMLTag(styledFuncArg)) {
      return { ...defaultParseNodeResult, shouldUseClient: true }
    }
    return {
      success: true,
      componentName: descendantResult.componentName ?? componentName,
      htmlTagName: styledFuncArg,
      cssString: evaluatedCssString.replace(/\s+/g, ' ').trim(),
      attrsArgs,
      shouldUseClient: false,
    }
  } else {
    /* e.g. styled(Foo) */
    const definitionNodes = styledFuncArg.getDefinitionNodes()
    const definitionNode: Node | undefined = definitionNodes[0] // TODO [0] might cause unexpected behavior when number of definitionNodes are more than 1

    if (!definitionNode) return defaultParseNodeResult
    const variableDeclarationNode = Node.isVariableDeclaration(definitionNode)
      ? definitionNode
      : definitionNode.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
    if (!variableDeclarationNode) return defaultParseNodeResult
    const initializer = variableDeclarationNode.getInitializer()
    if (!Node.isTaggedTemplateExpression(initializer))
      return defaultParseNodeResult

    const result = parseNode(initializer, evaluator, descendantResult)
    if (!result.success) return result

    return {
      success: true,
      componentName: componentName,
      htmlTagName: result.htmlTagName,
      cssString: result.cssString + evaluatedCssString,
      attrsArgs: [...result.attrsArgs, ...attrsArgs],
      shouldUseClient: false,
    }
  }
}

function getVariableDeclarationName(node: TaggedTemplateExpression) {
  const parent = node.getParent()
  if (Node.isVariableDeclaration(parent)) {
    return parent.getName()
  }
  return null
}

export function getStyledExpression(
  node: Node,
  styledFunctionName: string,
): CallExpression | PropertyAccessExpression | null {
  if (
    /* e.g. styled('p') */ Node.isCallExpression(node) ||
    /* e.g. styled.p */ Node.isPropertyAccessExpression(node)
  ) {
    if (node.getExpression().getText() === styledFunctionName) {
      return node
    }
    // for when .attrs is used
    const expression = node.getExpression()
    return getStyledExpression(expression, styledFunctionName)
  }
  return null
}

export function getStyledFuncArg(
  node: CallExpression | PropertyAccessExpression,
) {
  if (Node.isCallExpression(node)) {
    const arg = node.getArguments()[0]
    if (Node.isStringLiteral(arg)) {
      return arg.getLiteralValue()
    } else if (Node.isIdentifier(arg)) {
      return arg
    } else {
      return null
    }
  } else if (Node.isPropertyAccessExpression(node)) {
    return node.getName()
  }
  return null
}

type AttrsArg = ArrowFunction | ObjectLiteralExpression
export function getAttrsArgs(node: Node): AttrsArg[] {
  let result: AttrsArg[] = []

  if (!Node.isCallExpression(node)) return result
  const expression = node.getExpression()
  if (
    !(
      Node.isPropertyAccessExpression(expression) &&
      expression.getName() === 'attrs'
    )
  )
    return result

  // recursively call getAttrsArgs because attrs can be chained
  // e.g. const Text = styled.p.attrs().attrs()``
  const nextExpression = expression.getExpression()
  const nextExpressionResult = getAttrsArgs(nextExpression)
  if (nextExpressionResult) {
    result = [...nextExpressionResult]
  }

  const argument = node.getArguments()[0]
  if (
    Node.isArrowFunction(argument) ||
    Node.isObjectLiteralExpression(argument)
  ) {
    return [...result, argument]
  } else {
    throw new Error('unexpected expression for attrs')
  }
}
