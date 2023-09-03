import { evaluate } from 'ts-evaluator'
import type { IEnvironment } from 'ts-evaluator'
import * as TS from 'typescript'
import { Theme } from './types'
import {
  ArrowFunction,
  BinaryExpression,
  BindingElement,
  BindingName,
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

  evaluateSyntax(node: Node): PrimitiveType | ObjectType | ErrorType {
    if (Node.isBinaryExpression(node)) {
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
    } else if (Node.isTaggedTemplateExpression(node) && this.definition.cssFunctionName && node.getTag().getFullText() === this.definition.cssFunctionName) {
      // e.g. css`
      //   font-size: 16rem;
      // `
      return this.evaluateTaggedTemplateExpression(node)
    } else if (Node.isArrowFunction(node)) {
      // e.g. (props) => props.fontSize.m
      return this.evaluateArrowFunction(node)
    } else if (Node.isObjectLiteralExpression(node)) {
      // for when parsing theme
      return this.evaluateObjectLiteralExpression(node)
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
      const value = this.evaluateSyntax(item)
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
      const propertyInitializer = nodeParent.getInitializer()
      if (!propertyInitializer) continue
      const propertyInitializerValue = this.evaluateSyntax(propertyInitializer)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      value = propertyInitializerValue
    }

    if (!value && this.extra) {
      const evaluated = evaluate({
        node: node.compilerNode,
        typescript: this.definition.ts,
        environment: { extra: this.extra }
      })
      if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number' || typeof evaluated.value === 'object')) {
        value = evaluated.value
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
      const propertyInitializerValue = this.evaluateSyntax(nodeParent)
      if (propertyInitializerValue === TsEvalError) return TsEvalError
      value = propertyInitializerValue
    }

    if (!value && this.extra) {
      const evaluated = evaluate({
        node: node.compilerNode,
        typescript: this.definition.ts,
        environment: { extra: this.extra }
      })
      if (evaluated.success && (typeof evaluated.value === 'string' || typeof evaluated.value === 'number' || typeof evaluated.value === 'object')) {
        value = evaluated.value
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
      const value = this.evaluateSyntax(templateSpanExpression)
      if (value === TsEvalError) return TsEvalError
      result += (value + templateMiddle)
    }

    return result
  }

  evaluateTaggedTemplateExpression(node: TaggedTemplateExpression) {
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
        const value = this.evaluateSyntax(templateSpanExpression)
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
        const result = this.evaluateSyntax(initializer)
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

  evaluateArrowFunction(node: ArrowFunction) {
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

    if (Node.isBlock(body)) {
      const returnStatements = body.getStatements().filter((s) => Node.isReturnStatement(s)) as ReturnStatement[]
      if (returnStatements.length !== 1) return TsEvalError // because conditional return is not supported
      const expression = returnStatements[0].getExpression()
      if (!expression) return TsEvalError
      return this.evaluateSyntax(expression)
    } else {
      return this.evaluateSyntax(body)
    }
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
}
