import { describe, expect, test } from 'vitest'
import { Node, Project, SyntaxKind } from 'ts-morph'
import { Evaluator, TsEvalError } from './Evaluator'

const project = new Project()

describe('Evaluator', async () => {
  const ts = (await import('typescript')).default
  const theme = { color: { main: 'coral' }, fontSize: { m: 16 } }

  const getFirstNode = (value: string, syntaxKind: SyntaxKind, withoutTheme?: boolean): [Evaluator, Node] => {
    const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
    const node = file.getFirstDescendant(node => node.getKind() === syntaxKind)!
    const evaluator = new Evaluator({ extra: {}, definition: { ts, cssFunctionName: 'css' }, theme: withoutTheme ? null : theme })
    return [evaluator, node]
  }

  test('StringLiteral', () => {
    const value = `
      const mainColor = 'coral';
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.StringLiteral)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  test('NumericLiteral', () => {
    const value = `
      const number = 20;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.NumericLiteral)
    expect(evaluator.evaluateNode(node)).toBe(20)
  })

  test('NoSubstitutionTemplateLiteral', () => {
    const value = `
      const mainColor = \`coral\`;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.NoSubstitutionTemplateLiteral)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  test('PropertyAccessExpression', () => {
    const value = `
      const theme = { color: { main: 'coral' }};
      const mainColor = theme.color.main;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.PropertyAccessExpression)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  test('BinaryExpression', () => {
    const value = `
      const a = 'co';
      const b = 'ral';
      const mainColor = a + b;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.BinaryExpression)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  test('Identifier', () => {
    const value = `
      const color = 'coral';
      const mainColor = color;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.Identifier)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  test('TemplateExpression', () => {
    const value = `
      const a = 'co';
      const b = 'ral';
      const mainColor = \`\$\{a + b\}\`;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.TemplateExpression)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  describe('TemplateExpression', () => {
    test('NoSubstitutionTemplateLiteral', () => {
      const value = `
        const mainColor = \`coral\`;
      `
      const [evaluator, node] = getFirstNode(value, SyntaxKind.NoSubstitutionTemplateLiteral)
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    describe('SubstitutionTemplateLiteral', () => {
      test('with css function', () => {
        const value = `
          const getMainColor = () => \`\${css\`color: coral;\`}\`
        `
        const [evaluator, node] = getFirstNode(value, SyntaxKind.TaggedTemplateExpression)
        expect(evaluator.evaluateNode(node)).toBe('color: coral;')
      })

      test('with not css function', () => {
        const value = `
          const getMainColor = () => \`\${foo\`color: coral;\`}\`
        `
        const [evaluator, node] = getFirstNode(value, SyntaxKind.TaggedTemplateExpression)
        expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
      })
    })
  })

  describe('ArrowFunction', () => {
    describe('in styled function', () => {
      test('nested', () => {
        const value = `
          const getMainColor = (props) => ({ theme }) => props.theme.color.main + theme.color.main;
        `
        const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
        expect(evaluator.evaluateNode(node, true)).toBe('coralcoral')
      })

      test('arg non destructured', () => {
        const value = `
          const getMainColor = (props) => props.theme.color.main;
        `
        const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
        expect(evaluator.evaluateNode(node, true)).toBe('coral')
      })

      describe('arg destructured', () => {
        test('without rename', () => {
          const value = `
            const getMainColor = ({ theme }) => theme.color.main;
          `
          const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })

        test('with rename', () => {
          const value = `
            const getMainColor = ({ theme: myTheme }) => myTheme.color.main;
          `
          const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })

        test('other than "theme"', () => {
          const value = `
            const getMainColor = ({ someObj }) => someObj.color.main;
          `
          const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
          expect(evaluator.evaluateNode(node, true)).toBe(TsEvalError)
        })

        test('without theme', () => {
          const value = `
            const getMainColor = (props) => props.theme.color.main;
          `
          const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction, true)
          expect(evaluator.evaluateNode(node, true)).toBe(TsEvalError)
        })

        test('with block', () => {
          const value = `
            const getMainColor = ({ theme }) => {
              const result = theme.color.main
              return result
            };
          `
          const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })
      })
    })
  })

  test('ObjectLiteralExpression', () => {
    const value = `
      const mainColor = 'coral'
      const color = { main: mainColor };
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.ObjectLiteralExpression)
    expect(evaluator.evaluateNode(node)).toStrictEqual({ main: 'coral' })
  })

  test('ConditionalExpression', () => {
    const value = `
      const color = true ? 'coral' : 'lime';
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.ConditionalExpression)
    expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
  })

  test('CallExpression', () => {
    // TODO
    // const value = `
    //   const joinStr = (a: string, b: string) => a + b
    //   const getMainColor = () => joinStr('co', 'ral');
    // `
    // const value = `
    //   const getMainColor = () => \`${css({ color: 'coral' })}\`
    // `
  })
})
