import { describe, expect, test } from 'vitest'
import {
  ArrowFunction,
  BinaryExpression,
  Identifier,
  Project,
  PropertyAccessExpression,
  SyntaxKind,
  TemplateExpression
} from 'ts-morph'
import {
  evaluateBinaryExpression,
  evaluateIdentifier,
  evaluatePropertyAccessExpression,
  evaluateTemplateExpression,
  evaluateInterpolation,
  TsEvalError
} from './compileStyledFunction'

const project = new Project()

test('evaluateBinaryExpression', async () => {
  const ts = (await import('typescript')).default
  const value = '2 + 3';
  const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
  const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.BinaryExpression)
  const result = evaluateBinaryExpression(node as BinaryExpression, {}, ts)
  expect(result).toBe(5)
})

test('evaluatePropertyAccessExpression', async () => {
  const ts = (await import('typescript')).default
  const value = `
    const user = { name: 'Jack Sparrow' };
    user.name
  `
  const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
  const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.PropertyAccessExpression)
  const result = evaluatePropertyAccessExpression(node as PropertyAccessExpression, {}, ts)
  expect(result).toBe('Jack Sparrow')
})

test('evaluateIdentifier', async () => {
  const ts = (await import('typescript')).default
  const value = `
    const userName = 'Jack Sparrow';
    userName
  `
  const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
  const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.Identifier)
  const result = evaluateIdentifier(node as Identifier, {}, ts)
  expect(result).toBe('Jack Sparrow')
})

test('evaluateTemplateExpression', async () => {
  const ts = (await import('typescript')).default
  const value = `
    const a = 2;
    const b = 3;
    \`\$\{a + b\}\`
  `
  const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
  const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.TemplateExpression)
  const result = evaluateTemplateExpression(node as TemplateExpression, {}, ts)
  expect(result).toBe('5')
})

describe('evaluateInterpolation', async () => {
  const ts = (await import('typescript')).default

  describe('with theme', () => {
    const theme = { color: { main: 'coral' }, fontSize: { m: 16 } }
    const assert = (value: string, expectedResult: ReturnType<typeof evaluateInterpolation>) => {
      const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
      const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.ArrowFunction)
      const result = evaluateInterpolation(node as ArrowFunction, {}, theme, ts)
      expect(result).toBe(expectedResult)
    }

    test('arrow function nested', () => {
      // TODO
      // const value = `
      //   const getMainColor = (props) => () => props.theme.color.main;
      // `
      // assert(value, 'coral')
    })

    test('arg non destructured', () => {
      const value = `
        const getMainColor = (props) => props.theme.color.main;
      `
      assert(value, 'coral')
    })

    describe('arg destructured', () => {
      test('without rename', () => {
        const value = `
          const getMainColor = ({ theme }) => theme.color.main;
        `
        assert(value, 'coral')
      })

      test('with rename', () => {
        const value = `
          const getMainColor = ({ theme: myTheme }) => myTheme.color.main;
        `
        assert(value, 'coral')
      })

      test('other than "theme"', () => {
        const value = `
          const getMainColor = ({ someObj }) => someObj.color.main;
        `
        assert(value, TsEvalError)
      })
    })
  })

  describe('without theme', () => {
    const assert = (value: string, expectedResult: ReturnType<typeof evaluateInterpolation>) => {
      const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
      const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.ArrowFunction)
      const result = evaluateInterpolation(node as ArrowFunction, {}, undefined, ts)
      expect(result).toBe(expectedResult)
    }

    test('StringLiteral', () => {
      const value = `
        const getMainColor = () => 'coral';
      `
      assert(value, 'coral')
    })

    test('NumberLiteral', () => {
      const value = `
        const getNumber = () => 20;
      `
      assert(value, 20)
    })

    test('NoSubstitutionTemplateLiteral', () => {
      const value = `
        const getMainColor = () => \`coral\`;
      `
      assert(value, 'coral')
    })

    test('PropertyAccessExpression', () => {
      const value = `
        const theme = { color: { main: 'coral' }};
        const getMainColor = () => theme.color.main;
      `
      assert(value, 'coral')
    })

    test('BinaryExpression', () => {
      const value = `
        const a = 'co';
        const b = 'ral';
        const getMainColor = () => a + b;
      `
      assert(value, 'coral')
    })

    test('Identifier', () => {
      const value = `
        const mainColor = 'coral';
        const getMainColor = () => mainColor;
      `
      assert(value, 'coral')
    })

    test('TemplateExpression', () => {
      const value = `
        const a = 'co';
        const b = 'ral';
        const getMainColor = () => \`\$\{a + b\}\`;
      `
      assert(value, 'coral')
    })

    test('ArrowFunction', () => {
      const value = `
        const mainColor = 'coral';
        const getMainColor = () => () => mainColor;
      `
      assert(value, 'coral')
    })

    test('CallExpression', () => {
      // TODO
      // const value = `
      //   const joinStr = (a: string, b: string) => a + b
      //   const getMainColor = () => joinStr('co', 'ral');
      // `
    })
  })
})
