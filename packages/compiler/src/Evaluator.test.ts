import { describe, expect, test } from 'vitest'
import { evaluateSyntax, TsEvalError } from './compileStyledFunction'
import { Project, SyntaxKind } from 'ts-morph'
import { Evaluator } from './Evaluator'

const project = new Project()

describe('Evaluator.evaluateSyntax', async () => {
  const ts = (await import('typescript')).default
  const theme = { color: { main: 'coral' }, fontSize: { m: 16 } }
  const assert = (value: string, expectedResult: ReturnType<typeof evaluateSyntax>, syntaxKind: SyntaxKind, withoutTheme?: boolean) => {
    const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
    const node = file.getFirstDescendant(node => node.getKind() === syntaxKind)
    const evaluator = new Evaluator({ extra: {}, definition: { ts, cssFunctionName: 'css' }, theme: withoutTheme ? null : theme })
    const result = evaluator.evaluateSyntax(node as any)
    expect(result).toStrictEqual(expectedResult)
  }

  test('StringLiteral', () => {
    const value = `
      const getMainColor = () => 'coral';
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  test('NumberLiteral', () => {
    const value = `
      const getNumber = () => 20;
    `
    assert(value, 20, SyntaxKind.ArrowFunction)
  })

  test('NoSubstitutionTemplateLiteral', () => {
    const value = `
      const getMainColor = () => \`coral\`;
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  test('PropertyAccessExpression', () => {
    const value = `
      const theme = { color: { main: 'coral' }};
      const getMainColor = () => theme.color.main;
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  test('BinaryExpression', () => {
    const value = `
      const a = 'co';
      const b = 'ral';
      const getMainColor = () => a + b;
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  test('Identifier', () => {
    const value = `
      const mainColor = 'coral';
      const getMainColor = () => mainColor;
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  test('TemplateExpression', () => {
    const value = `
      const a = 'co';
      const b = 'ral';
      const getMainColor = () => \`\$\{a + b\}\`;
    `
    assert(value, 'coral', SyntaxKind.ArrowFunction)
  })

  describe('TemplateExpression', () => {
    test('NoSubstitutionTemplateLiteral', () => {
      const value = `
        const getMainColor = () => \`coral\`
      `
      assert(value, 'coral', SyntaxKind.ArrowFunction)
    })

    describe('SubstitutionTemplateLiteral', () => {
      test('with css function', () => {
        const value = `
          const getMainColor = () => \`\${css\`color: coral;\`}\`
        `
        assert(value, 'color: coral;', SyntaxKind.ArrowFunction)
      })

      test('with not css function', () => {
        const value = `
          const getMainColor = () => \`\${foo\`color: coral;\`}\`
        `
        assert(value, TsEvalError, SyntaxKind.ArrowFunction)
      })
    })
  })

  describe('ArrowFunction', () => {
    test('nested', () => {
      const value = `
        const getMainColor = (props) => ({ theme }) => props.theme.color.main + theme.color.main;
      `
      assert(value, 'coralcoral', SyntaxKind.ArrowFunction)
    })

    test('arg non destructured', () => {
      const value = `
        const getMainColor = (props) => props.theme.color.main;
      `
      assert(value, 'coral', SyntaxKind.ArrowFunction)
    })

    describe('arg destructured', () => {
      test('without rename', () => {
        const value = `
          const getMainColor = ({ theme }) => theme.color.main;
        `
        assert(value, 'coral', SyntaxKind.ArrowFunction)
      })

      test('with rename', () => {
        const value = `
          const getMainColor = ({ theme: myTheme }) => myTheme.color.main;
        `
        assert(value, 'coral', SyntaxKind.ArrowFunction)
      })

      test('other than "theme"', () => {
        const value = `
          const getMainColor = ({ someObj }) => someObj.color.main;
        `
        assert(value, TsEvalError, SyntaxKind.ArrowFunction)
      })

      test('without theme', () => {
        const value = `
          const getMainColor = (props) => props.theme.color.main;
        `
        assert(value, TsEvalError, SyntaxKind.ArrowFunction, true)
      })

      test('with block', () => {
        const value = `
        const getMainColor = ({ theme }) => {
          const result = theme.color.main
          return result
        };
      `
        assert(value, 'coral', SyntaxKind.ArrowFunction)
      })
    })
  })

  test('ObjectLiteralExpression', () => {
    const value = `
      const mainColor = 'coral'
      const color = { main: mainColor };
    `
    assert(value, { main: 'coral' }, SyntaxKind.ObjectLiteralExpression)
  })

  test('ObjectLiteralExpression with arrow function', () => {
    const value = `
      const mainColor = (props) => props.theme.color.main;
      const color = { main: mainColor };
    `
    assert(value, TsEvalError, SyntaxKind.ObjectLiteralExpression)
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
