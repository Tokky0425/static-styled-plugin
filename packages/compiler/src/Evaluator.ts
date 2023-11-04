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
  FunctionDeclaration,
  Identifier,
  Node,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  ReturnStatement,
  TaggedTemplateExpression,
  TemplateExpression
} from 'ts-morph'

type EvaluateExtra = IEnvironment['extra']
type ErrorType = typeof TsEvalError
type PrimitiveType = string | number
type ObjectType = { [key: string]: (PrimitiveType | ObjectType) }
type ArrayType = Array<any>
type Definition = {
  ts?: typeof TS
  cssFunctionName: string | null
}

export const TsEvalError = Symbol('EvalError')

export class Evaluator {
  extra: EvaluateExtra
  definition: Definition
  theme: Theme | null

  constructor(props: { extra: EvaluateExtra, definition: Definition, theme: Theme | null }) {
    this.extra = props.extra
    this.definition = props.definition
    this.theme = props.theme
  }

  evaluateNode(node: Node, inStyledFunction?: boolean): PrimitiveType | ObjectType | ArrayType | ErrorType {
    if (Node.isStringLiteral(node) || Node.isNumericLiteral(node)) {
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
    } else if (Node.isTaggedTemplateExpression(node) && this.definition.cssFunctionName && node.getTag().getText() === this.definition.cssFunctionName) {
      // e.g. css`
      //   font-size: 16rem;
      // `
      return this.evaluateStyledTaggedTemplateExpression(node)
    } else if (Node.isArrowFunction(node)) {
      if (inStyledFunction) {
        this.addAncestorThemeArgsToExtra(node)
      } else {
        // TODO add arg values to extra that comes from ancestor function call
        // `this.addAncestorArgsToExtra(node)` should be similar to `addAncestorThemeArgsToExtra`,
        // but it does not treat theme values because this arrow function node is called outside `styled` function
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
    } else {
      const evaluated = evaluate({
        node: node.compilerNode as any,
        typescript: this.definition.ts,
        environment: { extra: this.extra }
      })
      if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number')) {
        return evaluated.value
      }
      return TsEvalError
    }
  }

  evaluateBinaryExpression(node: BinaryExpression) {
    /* first, evaluate each item of binary expressions, and then evaluate the whole node */
    const items = this.flattenBinaryExpressions(node)
    for (const item of items) {
      const value = this.evaluateNode(item)
      if (value === TsEvalError) return TsEvalError
      item.replaceWithText(typeof value === 'string' ? `'${value}'` : String(value))
    }

    const evaluated = evaluate({
      node: node.compilerNode,
      typescript: this.definition.ts,
      environment: { extra: this.extra }
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
      const recursivelyGetValueFromExtra = (extra: EvaluateExtra, depth = 0): EvaluateExtra['string'] => {
        const accessorName = accessorTextArr[depth]
        const valueFromExtra = extra[accessorName]
        if (typeof valueFromExtra === 'object' && valueFromExtra !== null) {
          return recursivelyGetValueFromExtra(valueFromExtra as EvaluateExtra, depth + 1)
        } else {
          return valueFromExtra
        }
      }

      const valueFromExtra = recursivelyGetValueFromExtra(this.extra)
      if ((typeof valueFromExtra === 'string' || typeof valueFromExtra === 'number' || typeof valueFromExtra === 'object')) {
        value = valueFromExtra
      }
    }
    return (value as PrimitiveType | ObjectType) || TsEvalError
  }

  evaluateIdentifier(node: Identifier) {
    let value: unknown
    const referencesAsNode = node.findReferencesAsNodes()

    for (const node of referencesAsNode) {
      const nodeParent = node.getParentOrThrow()
      if (!Node.isVariableDeclaration(nodeParent)) continue
      if (!this.recursivelyCheckIsDeclaredByConst(nodeParent)) break
      const propertyInitializerValue = this.evaluateNode(nodeParent)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      value = propertyInitializerValue
    }

    if (!value) {
      const valueFromExtra  = this.extra[node.getText()]
      if ((typeof valueFromExtra === 'string' || typeof valueFromExtra === 'number' || typeof valueFromExtra === 'object')) {
        value = valueFromExtra
      }
    }

    return (value as PrimitiveType | ObjectType) || TsEvalError
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
      result += (value + templateMiddle)
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
        result += (value + templateMiddle)
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
      environment: { extra: this.extra }
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
      environment: { extra: this.extra }
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
    // TODO check if it's declared by const (not let or var)
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
        defaultValue: defaultValueNode && new Evaluator({ extra: {}, definition: { ts: this.definition.ts, cssFunctionName: null } , theme: null }).evaluateNode(defaultValueNode)
      }
    })

    const extraForEvaluateFunction = this.buildExtraFromArgsAndParams(argumentNodesMeta, paramsMeta)
    const functionEvaluator = new Evaluator({ extra: extraForEvaluateFunction, definition: { ts: this.definition.ts, cssFunctionName: null } , theme: null })
    return functionEvaluator.evaluateNode(targetNode)
  }

  evaluateStyledArrowFunction(node: ArrowFunction) {
    const body = node.getBody()
    if (Node.isBlock(body)) {
      const returnStatements = body.getStatements().filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
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
      const returnStatements = body.getStatements().filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
      if (returnStatements.length !== 1) return TsEvalError // because conditional return is not supported
      const expression = returnStatements[0].getExpression()
      if (!expression) return TsEvalError
      return this.evaluateNode(expression)
    }
    return TsEvalError
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
              theme: this.theme
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

  private getAllAncestorParams(node: Node, params: BindingName[] = []): BindingName[] {
    const parent = node.getParent()
    if (!parent) return params
    if (Node.isArrowFunction(parent)) {
      const parameters = parent.getParameters()
      const firstParameter = parameters[0]?.getNameNode()
      firstParameter && params.push(firstParameter)
    }
    return this.getAllAncestorParams(parent, params)
  }

  private recursivelyBuildExtraBasedOnTheme(bindingElements: BindingElement[], themeFragment: Theme, extra: EvaluateExtra = {}): EvaluateExtra {
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
        if (!newThemeFragment || typeof newThemeFragment === 'string' || typeof newThemeFragment === 'number') continue
        this.recursivelyBuildExtraBasedOnTheme(name.getElements(), newThemeFragment, extra)
      }
    }
    return extra
  }

  private buildExtraFromArgsAndParams(args: any[], params: Array<{ name: string, defaultValue: any }>) {
    const result: { [key: string]: any } = {}
    params.forEach((param, index) => {
      result[param.name] = args[index] === undefined ? param.defaultValue : args[index]
    })
    return result
  }

  private recursivelyCheckIsAsConst(node: Node): boolean {
    const parent = node.getParent()
    if (!parent) return false
    if (Node.isAsExpression(parent)) {
      return true
    } else {
      return this.recursivelyCheckIsAsConst(parent)
    }
  }

  private recursivelyCheckIsDeclaredByConst(node: Node): boolean {
    const parent = node.getParent()
    if (!parent) return false
    if (Node.isVariableDeclarationList(parent)) {
      return parent.getText().startsWith('const')
    } else {
      return this.recursivelyCheckIsDeclaredByConst(parent)
    }
  }
}
