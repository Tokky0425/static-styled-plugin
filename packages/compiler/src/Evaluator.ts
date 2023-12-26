import { evaluate } from 'ts-evaluator'
import type { IEnvironment } from 'ts-evaluator'
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
  ObjectLiteralExpression,
  PropertyAccessExpression,
  ReturnStatement,
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
    let value: unknown
    const referencesAsNode = node.findReferencesAsNodes()

    for (const node of referencesAsNode) {
      const nodeParent = node.getParentOrThrow()
      if (!Node.isPropertyAssignment(nodeParent)) continue
      if (!this.recursivelyCheckIsAsConst(nodeParent)) break

      const propertyInitializer = nodeParent.getInitializer()
      if (!propertyInitializer) continue
      const propertyInitializerValue = this.evaluateNode(propertyInitializer)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      value = propertyInitializerValue
      break
    }

    if (!value) {
      // when using ts-evaluator, it return a wrong value because it ignores re-assignment.
      // e.g.
      // ```
      // const theme = { color: 'coral' }
      // theme.color = 'red'
      // const mainColor = theme.color // <- ts-evaluator evaluates as 'coral'
      // ```
      // so, when without `as const`, this method should return an error.
      // but before returning an error, we need to check if it can evaluate properly with extra.

      const accessorTextArr = node.getText().split('.')
      const recursivelyGetValueFromExtra = (
        extra: EvaluateExtra,
        depth = 0,
      ): EvaluateExtra['string'] => {
        const accessorName = accessorTextArr[depth]
        const valueFromExtra = extra[accessorName]
        if (typeof valueFromExtra === 'object' && valueFromExtra !== null) {
          return recursivelyGetValueFromExtra(
            valueFromExtra as EvaluateExtra,
            depth + 1,
          )
        } else {
          return valueFromExtra
        }
      }

      const valueFromExtra = recursivelyGetValueFromExtra(this.extra)
      if (
        typeof valueFromExtra === 'string' ||
        typeof valueFromExtra === 'number' ||
        typeof valueFromExtra === 'object'
      ) {
        value = valueFromExtra
      }
    }
    return (value as PrimitiveType | ObjectType) || TsEvalError
  }

  evaluateIdentifier(node: Identifier) {
    const definitionNodes = node.getDefinitions()
    const definition = definitionNodes[0]
    if (definitionNodes.length !== 1 || !definition) return TsEvalError
    const definitionNode = definition.getNode()
    const definitionNodeParent = definitionNode.getParent()
    const arrowFunctionNodeClosestToDefinition = this.closestNode(
      definitionNode,
      'ArrowFunction',
    )
    const isNodeDeclaredInsideSameScopeArrowFunction =
      !!arrowFunctionNodeClosestToDefinition &&
      this.withinNode(node, arrowFunctionNodeClosestToDefinition)
    const newEvaluator = new Evaluator({
      extra: {},
      definition: this.definition,
      theme: this.theme,
    })

    if (isNodeDeclaredInsideSameScopeArrowFunction) {
      const valueFromExtra = this.extra[node.getText()]
      if (
        typeof valueFromExtra === 'string' ||
        typeof valueFromExtra === 'number' ||
        typeof valueFromExtra === 'object'
      ) {
        return valueFromExtra as PrimitiveType | ObjectType
      }
    }

    if (Node.isPropertyAssignment(definitionNodeParent)) {
      // when the identifier is initialized by object property assignment
      if (!this.recursivelyCheckIsAsConst(definitionNodeParent))
        return TsEvalError
      const propertyInitializer = definitionNodeParent.getInitializer()
      if (!propertyInitializer) return TsEvalError
      const propertyInitializerValue =
        isNodeDeclaredInsideSameScopeArrowFunction
          ? this.evaluateNode(propertyInitializer)
          : newEvaluator.evaluateNode(propertyInitializer)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      return propertyInitializerValue
    } else if (Node.isVariableDeclaration(definitionNodeParent)) {
      // when the identifier is initialized by variable declaration
      const propertyInitializerValue =
        isNodeDeclaredInsideSameScopeArrowFunction
          ? this.evaluateNode(definitionNodeParent)
          : newEvaluator.evaluateNode(definitionNodeParent)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      return propertyInitializerValue
    } else if (Node.isBindingElement(definitionNodeParent)) {
      // when the identifier is initialized by object destructuring
      const referencesAsNode = definitionNodeParent.findReferencesAsNodes()
      for (const node of referencesAsNode) {
        const nodeParent = node.getParentOrThrow()
        if (!Node.isPropertyAssignment(nodeParent)) continue
        if (!this.recursivelyCheckIsAsConst(nodeParent)) break
        const propertyInitializer = nodeParent.getInitializer()
        if (!propertyInitializer) continue
        const propertyInitializerValue =
          isNodeDeclaredInsideSameScopeArrowFunction
            ? this.evaluateNode(propertyInitializer)
            : newEvaluator.evaluateNode(propertyInitializer)
        if (
          typeof propertyInitializerValue === 'string' ||
          typeof propertyInitializerValue === 'number'
        ) {
          return propertyInitializerValue
        }
      }
    }

    // TODO add "only when in 'styled' function" condition
    // e.g. evaluating `m` for the pattern below
    // const Text = styled.p`
    //   font-size: ${(props) => {
    //     const { theme: { fontSize: m } } = props
    //     return m;
    //   }};
    // `

    if (isNodeDeclaredInsideSameScopeArrowFunction) {
      const variableDeclarationNode = this.closestNode(
        definitionNode,
        'VariableDeclaration',
      )

      if (Node.isVariableDeclaration(variableDeclarationNode)) {
        const variableDeclarationNodeInitializer =
          variableDeclarationNode.getInitializer()
        if (variableDeclarationNodeInitializer) {
          let initializerText = '' // e.g. 'props'
          if (
            Node.isPropertyAccessExpression(variableDeclarationNodeInitializer)
          ) {
            initializerText = this.getFirstNodeForPropertyAccessExpression(
              variableDeclarationNodeInitializer,
            ).getText()
          } else {
            initializerText = variableDeclarationNodeInitializer.getText()
          }

          if (this.extra[initializerText]) {
            const name = variableDeclarationNode.getNameNode()
            if (Node.isObjectBindingPattern(name)) {
              const bindingElements = name.getElements()
              if (this.theme) {
                // TODO: this cannot handle the case below
                //  `const { fontSize: { m } } = props.theme`
                //  because recursivelyBuildExtraBasedOnTheme assumes that object destructuring is done from the top level
                const newExtra = {
                  ...this.recursivelyBuildExtraBasedOnTheme(bindingElements, {
                    theme: this.theme,
                  }),
                  ...this.extra, // to prioritize descendant's args, ...extra should come at last
                }

                // do not give theme to avoid infinite loops that may occur
                return new Evaluator({
                  extra: newExtra,
                  definition: { ts: this.definition.ts },
                }).evaluateNode(node)
              }
            }
          }
        }
      }
    }

    return TsEvalError
  }

  evaluateVariableDeclaration(node: VariableDeclaration) {
    const initializer = node.getInitializer()
    if (!initializer) return TsEvalError
    if (
      Node.isObjectLiteralExpression(initializer) ||
      Node.isArrayLiteralExpression(initializer)
    ) {
      // when object literal or array literal, `as const` is required to be parsed
      if (!this.recursivelyCheckIsAsConst(initializer)) return TsEvalError
    } else {
      // otherwise, it is required to be declared with `const` to be parsed
      if (!this.recursivelyCheckIsDeclaredWithConst(initializer))
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
      if (!Node.isPropertyAssignment(property)) continue
      const initializer = property.getInitializer()
      if (!initializer) continue
      if (Node.isObjectLiteralExpression(initializer)) {
        this.evaluateObjectLiteralExpression(initializer)
      } else if (initializer) {
        const result = this.evaluateNode(initializer)
        if (result === TsEvalError) return TsEvalError
        initializer.replaceWithText(JSON.stringify(result))
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
    const parent = node.getParent()
    if (!parent) return undefined
    if (parent.getKindName() === targetNodeKindName) return parent
    return this.closestNode(parent, targetNodeKindName)
  }

  private withinNode(node: Node, targetNode: Node): boolean {
    const parent = node.getParent()
    if (!parent) return false
    if (parent === targetNode) return true
    return this.withinNode(parent, targetNode)
  }

  /**
   * e.g. `theme.fontSize.m` -> `theme`
   * @param node
   * @private
   */
  private getFirstNodeForPropertyAccessExpression(
    node: PropertyAccessExpression,
  ): Identifier {
    const expression = node.getExpression()
    if (Node.isPropertyAccessExpression(expression)) {
      return this.getFirstNodeForPropertyAccessExpression(expression)
    }
    return expression as Identifier
  }

  /**
   * e.g. `theme.fontSize.m` -> `m`
   * @param node
   * @private
   */
  // private getLastNodeForPropertyAccessExpression(
  //   node: PropertyAccessExpression,
  // ): Identifier {
  //   const expression = node.getParent()
  //   if (Node.isPropertyAccessExpression(expression)) {
  //     return this.getLastNodeForPropertyAccessExpression(expression)
  //   }
  //   return node.getNameNode()
  // }

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

  private recursivelyCheckIsAsConst(node: Node): boolean {
    const parent = node.getParent()
    console.log(parent?.getText())
    if (!parent) return false
    if (Node.isAsExpression(parent)) {
      return true
    } else {
      return this.recursivelyCheckIsAsConst(parent)
    }
  }

  private recursivelyCheckIsDeclaredWithConst(node: Node): boolean {
    const parent = node.getParent()
    if (!parent) return false
    if (Node.isVariableDeclarationList(parent)) {
      return parent.getText().startsWith('const')
    } else {
      return this.recursivelyCheckIsDeclaredWithConst(parent)
    }
  }
}
