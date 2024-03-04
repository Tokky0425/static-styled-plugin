import type { IEnvironment } from 'ts-evaluator'
import { evaluate } from 'ts-evaluator'
import * as TS from 'typescript'
import { Theme } from './types'
import {
  ArrayLiteralExpression,
  ArrowFunction,
  BinaryExpression,
  BindingElement,
  BindingName,
  CallExpression,
  ElementAccessExpression,
  FunctionDeclaration,
  Identifier,
  Node,
  ObjectBindingPattern,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  ReturnStatement,
  SyntaxKind,
  TaggedTemplateExpression,
  TemplateExpression,
  VariableDeclaration,
} from 'ts-morph'

type EvaluateExtra = IEnvironment['extra']
type ErrorType = typeof TsEvalError
type PrimitiveType = string | number
type ObjectType = { [key: string]: PrimitiveType | ObjectType }
type ArrayType = Array<unknown>
type Definition = {
  ts?: typeof TS
  styledFunctionName?: string | null
  cssFunctionName?: string | null
}

export const TsEvalError = Symbol('EvalError')

export class Evaluator {
  extra: EvaluateExtra
  definition: Definition
  theme?: Theme | null

  constructor(props: {
    extra: EvaluateExtra
    definition: Definition
    theme?: Theme | null
  }) {
    this.extra = props.extra
    this.definition = props.definition
    this.theme = props.theme
  }

  evaluateNode(
    node: Node,
    inStyledFunction?: boolean,
  ): PrimitiveType | ObjectType | ArrayType | ErrorType {
    if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node)) {
      const expressionNode = node.getExpression()
      return this.evaluateNode(expressionNode)
    } else if (
      Node.isStringLiteral(node) ||
      Node.isNumericLiteral(node) ||
      Node.isNoSubstitutionTemplateLiteral(node)
    ) {
      return node.getLiteralValue()
    } else if (Node.isBinaryExpression(node)) {
      // e.g. width * 2
      return this.evaluateBinaryExpression(node)
    } else if (Node.isPropertyAccessExpression(node)) {
      // e.g. theme.fontSize.m
      return this.evaluatePropertyAccessExpression(node)
    } else if (Node.isIdentifier(node)) {
      // e.g. width
      return this.evaluateIdentifier(node)
    } else if (Node.isTemplateExpression(node)) {
      // e.g. `${fontSize.m}px`
      return this.evaluateTemplateExpression(node)
    } else if (Node.isTaggedTemplateExpression(node)) {
      if (
        this.definition.cssFunctionName &&
        node.getTag().getText() === this.definition.cssFunctionName
      ) {
        // e.g. css`
        //   font-size: 16rem;
        // `
        return this.evaluateStyledTaggedTemplateExpression(node)
      }
      return TsEvalError
    } else if (Node.isArrowFunction(node)) {
      if (inStyledFunction) {
        this.addAncestorThemeArgsToExtra(node)
      }
      // e.g. (props) => props.fontSize.m
      return this.evaluateStyledArrowFunction(node)
    } else if (Node.isFunctionDeclaration(node)) {
      // e.g. function someYourFunction(a, b) { return a + b }
      return this.evaluateFunctionDeclaration(node)
    } else if (Node.isObjectLiteralExpression(node)) {
      // for when parsing theme
      return this.evaluateObjectLiteralExpression(node)
    } else if (Node.isArrayLiteralExpression(node)) {
      // e.g. ['co', 'ral']
      return this.evaluateArrayLiteralExpression(node)
    } else if (Node.isCallExpression(node)) {
      // e.g. someYourFunction('co', 'ral')
      return this.evaluateCallExpression(node)
    } else if (Node.isConditionalExpression(node)) {
      return TsEvalError
    } else if (Node.isVariableDeclaration(node)) {
      return this.evaluateVariableDeclaration(node)
    } else if (Node.isElementAccessExpression(node)) {
      return this.evaluateElementAccessExpression(node)
    } else {
      return TsEvalError
    }
  }

  evaluateBinaryExpression(node: BinaryExpression) {
    /* first, evaluate each item of binary expressions, and then evaluate the whole node */
    const items = this.flattenBinaryExpressions(node)
    for (const item of items) {
      const value = this.evaluateNode(item)
      if (value === TsEvalError) return TsEvalError
      item.replaceWithText(
        typeof value === 'string' ? `'${value}'` : String(value),
      )
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: this.extra },
    })
    if (evaluated.success) {
      const value = evaluated.value
      if (typeof value === 'string' || typeof value === 'number') return value
    }
    return TsEvalError
  }

  evaluatePropertyAccessExpression(node: PropertyAccessExpression) {
    const firstIdentifier = node.getFirstDescendantByKind(SyntaxKind.Identifier) // e.g. `color`
    if (!firstIdentifier) return TsEvalError

    const definitionNodes = firstIdentifier.getDefinitionNodes()
    const definitionNode: Node | undefined = definitionNodes[0] // TODO [0] might cause unexpected behavior when number of definitionNodes are more than 1
    const newExtra = structuredClone(this.extra)
    if (definitionNode) {
      /**
       * e.g.
       * const { color } = { color: { main: 'coral' } } as const
       * const Text = styled.p`
       *   color: ${() => color.main}; <- when evaluating this property access expression, we need to add `{ color: { main: 'coral' } }` to `extra`
       * `
       */
      this.buildExtraFromVariableDeclaration(definitionNode, newExtra)
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: newExtra },
    })

    if (evaluated.success) {
      const value = evaluated.value
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'object'
      )
        return value as PrimitiveType | ObjectType
    }
    return TsEvalError
  }

  evaluateIdentifier(node: Identifier) {
    const definitionNodes = node.getDefinitionNodes()
    const definitionNode: Node | undefined = definitionNodes[0] // TODO [0] might cause unexpected behavior when number of definitionNodes are more than 1
    const newExtra = structuredClone(this.extra)
    if (definitionNode) {
      /**
       * e.g.
       * const { color } = { color: 'coral' } as const;
       * const Text = styled.p`
       *   color: ${() => color}; <- when evaluating this identifier, we need to add `{ color: 'coral' }` to `extra`};
       * `
       */
      this.buildExtraFromVariableDeclaration(definitionNode, newExtra)
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: newExtra },
    })

    if (evaluated.success) {
      const value = evaluated.value
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'object'
      )
        return value as PrimitiveType | ObjectType
    }
    return TsEvalError
  }

  evaluateVariableDeclaration(node: VariableDeclaration) {
    const isDeclaredWithConst = this.recursivelyCheckIsDeclaredWithConst(node)
    if (!isDeclaredWithConst) return TsEvalError

    const initializer = node.getInitializer()
    if (!initializer) return TsEvalError

    let isDeclaredWithAsConst = false
    if (Node.isAsExpression(initializer)) {
      isDeclaredWithAsConst = true
    } else if (Node.isSatisfiesExpression(initializer)) {
      const expression = initializer.getExpression()
      if (Node.isAsExpression(expression)) {
        isDeclaredWithAsConst = true
      }
    }

    // when declared with `as const`, it is safe to evaluate
    if (isDeclaredWithAsConst) {
      return this.evaluateNode(initializer)
    }

    // object and array are mutable without `as const`, so it is not safe to evaluate
    if (
      Node.isObjectLiteralExpression(initializer) ||
      Node.isArrayLiteralExpression(initializer)
    ) {
      return TsEvalError
    }
    return this.evaluateNode(initializer)
  }

  evaluateElementAccessExpression(node: ElementAccessExpression) {
    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: this.extra },
    })
    if (evaluated.success) {
      const value = evaluated.value
      if (typeof value === 'string' || typeof value === 'number') return value
    }
    return TsEvalError
  }

  evaluateTemplateExpression(node: TemplateExpression) {
    let result = node.getHead().getLiteralText()
    const templateSpans = node.getTemplateSpans()

    for (let i = 0; i < templateSpans.length; i++) {
      const templateSpan = templateSpans[i]
      const templateMiddle = templateSpan.getLiteral().getLiteralText()
      const templateSpanExpression = templateSpan.getExpression()
      const value = this.evaluateNode(templateSpanExpression)
      if (value === TsEvalError) return TsEvalError
      result += value + templateMiddle
    }

    return result
  }

  evaluateStyledTaggedTemplateExpression(node: TaggedTemplateExpression) {
    const template = node.getTemplate()
    let result = ''

    if (Node.isNoSubstitutionTemplateLiteral(template)) {
      result = template.getLiteralText()
    } else {
      result = template.getHead().getLiteralText()
      const templateSpans = template.getTemplateSpans()

      for (let i = 0; i < templateSpans.length; i++) {
        const templateSpan = templateSpans[i]
        const templateMiddle = templateSpan.getLiteral().getLiteralText()
        const templateSpanExpression = templateSpan.getExpression()
        const value = this.evaluateNode(templateSpanExpression, true)
        if (value === TsEvalError) return TsEvalError
        result += value + templateMiddle
      }
    }
    return result
  }

  evaluateObjectLiteralExpression(node: ObjectLiteralExpression) {
    const properties = node.getProperties()

    for (const property of properties) {
      if (Node.isPropertyAssignment(property)) {
        const initializer = property.getInitializer()
        if (!initializer) continue
        if (Node.isObjectLiteralExpression(initializer)) {
          this.evaluateObjectLiteralExpression(initializer)
        } else {
          const result = this.evaluateNode(initializer)
          if (result === TsEvalError) return TsEvalError
          initializer.replaceWithText(JSON.stringify(result))
        }
      } else if (Node.isShorthandPropertyAssignment(property)) {
        const name = property.getNameNode()
        const nameValue = this.evaluateNode(name)
        if (nameValue === TsEvalError) return TsEvalError
        property.replaceWithText(
          `${name.getText()}: ${JSON.stringify(nameValue)}`,
        )
      }
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: this.extra },
    })

    if (evaluated.success && typeof evaluated.value === 'object') {
      return evaluated.value as ObjectType
    }
    return TsEvalError
  }

  evaluateArrayLiteralExpression(node: ArrayLiteralExpression) {
    const elements = node.getElements()
    for (const element of elements) {
      const val = this.evaluateNode(element)
      if (val === TsEvalError) return TsEvalError
      element.replaceWithText(JSON.stringify(val))
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: this.extra },
    })

    if (evaluated.success && typeof evaluated.value === 'object') {
      return evaluated.value as ArrayType
    }
    return TsEvalError
  }

  evaluateCallExpression(node: CallExpression) {
    // Only functions declared by const or function declaration are supported.
    const expression = node.getExpression()
    if (Node.isCallExpression(expression)) {
      // TODO maybe support curry function
      /**
       * e.g.
       * const joinStr = (a: string) => (b: string) => a + b
       * const getMainColor = () => {
       *   return joinStr('co')('ral')
       * }
       */
    }
    if (!Node.isIdentifier(expression)) return TsEvalError

    const argumentNodes = node.getArguments()
    const argumentNodesMeta = argumentNodes.map((argumentNode) => {
      return this.evaluateNode(argumentNode)
    })

    const definitions = expression.getDefinitions()
    let definitionNode: Node | undefined = undefined
    for (const definitionInfo of definitions) {
      if (definitionNode) continue
      definitionNode = definitionInfo.getDeclarationNode()
    }

    if (!definitionNode) return TsEvalError
    let targetNode: ArrowFunction | FunctionDeclaration | undefined = undefined

    if (Node.isVariableDeclaration(definitionNode)) {
      /*
       * e.g. const joinStr = (a: string, b: string) => a + b
       **/
      if (!this.recursivelyCheckIsDeclaredWithConst(definitionNode))
        return TsEvalError
      const initializerNode = definitionNode.getInitializer()
      if (!Node.isArrowFunction(initializerNode)) return TsEvalError
      targetNode = initializerNode
    } else if (Node.isFunctionDeclaration(definitionNode)) {
      /*
       * e.g. function joinStr(a: string, b: string) { return a + b }
       **/
      targetNode = definitionNode
    }

    if (!targetNode) return TsEvalError
    const params = targetNode.getParameters()
    const paramsMeta = params.map((param) => {
      const defaultValueNode = param.getInitializer()
      return {
        name: param.getName(),
        defaultValue:
          defaultValueNode &&
          new Evaluator({
            extra: {},
            definition: { ts: this.definition.ts },
          }).evaluateNode(defaultValueNode),
      }
    })

    const extraForEvaluateFunction = this.buildExtraFromArgsAndParams(
      argumentNodesMeta,
      paramsMeta,
    )
    // TODO: when this function is declared inside a function, it might need to take over `this.extra` doing like `extra: { ...this.extra, ...extraForEvaluateFunction }`
    //  this can happen in the following situation
    //  `const joinFunc = (arg1: string) => { const anotherJoinFunc = (arg2: string) => arg1 + arg2; return anotherJoinFunc('foo'); }`
    const functionEvaluator = new Evaluator({
      extra: extraForEvaluateFunction,
      definition: { ts: this.definition.ts },
    })
    return functionEvaluator.evaluateNode(targetNode)
  }

  evaluateStyledArrowFunction(node: ArrowFunction) {
    const body = node.getBody()
    if (Node.isBlock(body)) {
      const returnStatements = body
        .getStatements()
        .filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
      if (returnStatements.length !== 1) return TsEvalError // because conditional return is not supported
      const expression = returnStatements[0].getExpression()
      if (!expression) return TsEvalError
      return this.evaluateNode(expression)
    } else {
      return this.evaluateNode(body, true) // inStyledFunction needs to be true for higher order function like `(props) => ({ theme }) => ...`
    }
  }

  evaluateFunctionDeclaration(node: FunctionDeclaration) {
    const body = node.getBody()
    if (Node.isBlock(body)) {
      const returnStatements = body
        .getStatements()
        .filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
      if (returnStatements.length !== 1) return TsEvalError // because conditional return is not supported
      const expression = returnStatements[0].getExpression()
      if (!expression) return TsEvalError
      return this.evaluateNode(expression)
    }
    return TsEvalError
  }

  private closestNode(
    node: Node,
    targetNodeKindName: string,
  ): Node | undefined {
    if (node.getKindName() === targetNodeKindName) return node
    const parent = node.getParent()
    if (!parent) return undefined
    return this.closestNode(parent, targetNodeKindName)
  }

  private addAncestorThemeArgsToExtra(node: ArrowFunction) {
    const body = node.getBody()

    // `getAllAncestorParams` searches parent nodes recursively and get all arrow functions' first parameter.
    // We do this because arrow functions can be nested (e.g. `(props) => ({ theme }) => ...`) and we need to know from which arrow function the arg comes.
    const params = this.getAllAncestorParams(body)
    params.forEach((param) => {
      if (Node.isIdentifier(param)) {
        // (props) => ...
        this.extra = {
          [param.getFullText()]: { theme: this.theme },
          ...this.extra, // to prioritize descendant's args, ...extra should come at last
        }
      } else if (Node.isObjectBindingPattern(param)) {
        // ({ theme }) => ...
        // ({ theme: myTheme }) => ...
        // ({ theme: { fontSize } }) => ...
        const bindingElements = param.getElements()
        if (this.theme) {
          this.extra = {
            ...this.recursivelyBuildExtraBasedOnTheme(bindingElements, {
              theme: this.theme,
            }),
            ...this.extra, // to prioritize descendant's args, ...extra should come at last
          }
        }
      }
    })
  }

  private flattenBinaryExpressions(node: BinaryExpression): Node[] {
    const left = node.getLeft()
    const right = node.getRight()
    if (Node.isBinaryExpression(left)) {
      return [...this.flattenBinaryExpressions(left), right]
    } else {
      return [left, right]
    }
  }

  private getAllAncestorParams(
    node: Node,
    params: BindingName[] = [],
  ): BindingName[] {
    const parent = node.getParent()
    if (!parent) return params
    if (Node.isArrowFunction(parent)) {
      const parameters = parent.getParameters()
      const firstParameter = parameters[0]?.getNameNode()
      firstParameter && params.push(firstParameter)
    }
    return this.getAllAncestorParams(parent, params)
  }

  private recursivelyBuildExtraBasedOnTheme(
    bindingElements: BindingElement[],
    themeFragment: Theme,
    extra: EvaluateExtra = {},
  ): EvaluateExtra {
    for (const bindingElement of bindingElements) {
      const name = bindingElement.getNameNode()
      const propertyName = bindingElement.getPropertyNameNode()
      if (Node.isIdentifier(name)) {
        /**
         * just destructure: `({ theme }) => ...`
         * or
         * destructure and rename: `({ theme: myTheme }) => ...`
         */
        const keyForExtra = name.getText() // 'theme' when Identifier, 'myTheme' when ObjectBindingPattern
        const keyForTheme = propertyName?.getText() ?? keyForExtra // propertyName.getText() returns 'theme' when ObjectBindingPattern
        const value = themeFragment[keyForTheme]
        if (value) {
          extra[keyForExtra] = value
        }
      } else if (Node.isObjectBindingPattern(name)) {
        /**
         * ({ theme: { fontSize } }) => ...
         */
        const keyForExtra = propertyName?.getText() // 'theme'
        if (!keyForExtra) continue // not sure if this possibly happens
        const newThemeFragment = themeFragment[keyForExtra]
        if (
          !newThemeFragment ||
          typeof newThemeFragment === 'string' ||
          typeof newThemeFragment === 'number'
        )
          continue
        this.recursivelyBuildExtraBasedOnTheme(
          name.getElements(),
          newThemeFragment,
          extra,
        )
      }
    }
    return extra
  }

  private buildExtraFromArgsAndParams(
    args: unknown[],
    params: Array<{ name: string; defaultValue: unknown }>,
  ) {
    const result: { [key: string]: unknown } = {}
    params.forEach((param, index) => {
      result[param.name] =
        args[index] === undefined ? param.defaultValue : args[index]
    })
    return result as EvaluateExtra
  }

  private buildExtraFromVariableDeclaration(
    definitionNode: Node,
    targetExtra: EvaluateExtra,
  ) {
    const variableDeclarationNode = this.closestNode(
      definitionNode,
      'VariableDeclaration',
    )
    if (Node.isVariableDeclaration(variableDeclarationNode)) {
      const nameNode = variableDeclarationNode.getNameNode()
      const variableDeclarationNodeInitializer =
        variableDeclarationNode.getInitializer()
      if (
        variableDeclarationNodeInitializer &&
        !Node.isArrowFunction(variableDeclarationNodeInitializer)
      ) {
        const variableDeclarationNodeInitializerValue = this.evaluateNode(
          variableDeclarationNode,
        )
        if (Node.isIdentifier(nameNode)) {
          /**
           *
           * e.g.
           * const Text = styled.p`
           *   color: ${(props) => {
           *     const newProps = props;
           *     return newProps.theme.color.main; <- when evaluating `main` of this line
           *   }};
           * `
           */
          const keyName = nameNode.getText() // 'newProps' in the case above
          targetExtra[keyName] = variableDeclarationNodeInitializerValue
        } else if (Node.isObjectBindingPattern(nameNode)) {
          /**
           *
           * e.g.
           * const Text = styled.p`
           *   color: ${(props) => {
           *     const { color: { border } } = props.theme;
           *     return border.main; <- when evaluating `main` of this line
           *   }};
           * `
           *
           * recursivelyBuildProperty function recursively builds a new object for newExtra.
           * In the case above, when `theme` is `{ color: { border: { main: 'coral' } } }`, it returns the object below.
           * `{ border: { main: 'coral' } }`
           */
          type RecursivelyBuildPropertyResult = {
            [key: string]:
              | PrimitiveType
              | ObjectType
              | ArrayType
              | typeof TsEvalError
          }

          const recursivelyBuildProperty = (
            objectBindingPatternNode: ObjectBindingPattern,
            prevValue:
              | PrimitiveType
              | ObjectType
              | ArrayType
              | typeof TsEvalError,
            result: RecursivelyBuildPropertyResult = {},
          ): RecursivelyBuildPropertyResult => {
            const elements = objectBindingPatternNode.getElements()
            for (const element of elements) {
              const propertyName = element.getPropertyNameNode()
              const nameNode = element.getNameNode()
              const keyNode = propertyName ?? nameNode
              const keyName = keyNode.getText()
              const nextValue =
                typeof prevValue === 'object' && !Array.isArray(prevValue)
                  ? prevValue[keyName]
                  : prevValue

              if (Node.isObjectBindingPattern(nameNode)) {
                recursivelyBuildProperty(nameNode, nextValue, result)
              } else {
                if (typeof prevValue !== 'object' || Array.isArray(prevValue))
                  continue
                const val = prevValue[keyName]
                if (!val) continue
                const resultKeyName = nameNode.getText()
                result[resultKeyName] = val
              }
            }
            return result
          }

          Object.assign(
            targetExtra,
            recursivelyBuildProperty(
              nameNode,
              variableDeclarationNodeInitializerValue,
            ),
          )
        }
      }
    }
  }

  private recursivelyCheckIsDeclaredWithConst(node: Node): boolean {
    if (Node.isVariableDeclarationList(node)) {
      return node.getText().startsWith('const')
    }
    const parent = node.getParent()
    if (!parent) return false
    return this.recursivelyCheckIsDeclaredWithConst(parent)
  }
}
