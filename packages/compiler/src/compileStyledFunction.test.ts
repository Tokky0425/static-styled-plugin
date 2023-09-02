import { describe, expect, test } from 'vitest'
import {
  ArrowFunction,
  BinaryExpression,
  Identifier,
  Project,
  PropertyAccessExpression,
  SyntaxKind,
  TaggedTemplateExpression,
  TemplateExpression
} from 'ts-morph'
import {
  evaluateBinaryExpression,
  evaluateIdentifier,
  evaluatePropertyAccessExpression,
  evaluateTemplateExpression,
  evaluateSyntax,
  getAttrs,
  getTagName,
  TsEvalError,
} from './compileStyledFunction'

const project = new Project()

describe('getTagName', () => {
  const getTargetNode = (code: string) => {
    const file = project.createSourceFile('virtual.ts', code, { overwrite: true })
    const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.TaggedTemplateExpression) as TaggedTemplateExpression
    return node.getTag()
  }

  describe('PropertyAccessExpression', () => {
    test('', () => {
      const value = `
        const Text = styled.p\`\`
      `
      const result = getTagName(getTargetNode(value), 'styled')
      expect(result).toBe('p')
    })

    describe('with attrs', () => {
      test('taking object', () => {
        const value = `
          const Text = styled.p.attrs({})\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
      test('taking function', () => {
        const value = `
          const Text = styled.p.attrs(() => ({}))\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
      test('chained', () => {
        const value = `
          const Text = styled.p.attrs({}).attrs(() => ({}))\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
    })

    test('non existing html tag', () => {
      const value = `
        const Text = styled.foo\`\`
      `
      const result = getTagName(getTargetNode(value), 'styled')
      expect(result).toBe('foo')
    })
  })

  describe('CallExpression', () => {
    test('', () => {
      const value = `
        const Text = styled('p')\`\`
      `
      const result = getTagName(getTargetNode(value), 'styled')
      expect(result).toBe('p')
    })

    describe('attrs', () => {
      test('attrs taking object', () => {
        const value = `
          const Text = styled('p').attrs({})\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
      test('taking function', () => {
        const value = `
          const Text = styled('p').attrs(() => ({}))\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
      test('chained', () => {
        const value = `
          const Text = styled('p').attrs({}).attrs(() => ({}))\`\`
        `
        const result = getTagName(getTargetNode(value), 'styled')
        expect(result).toBe('p')
      })
    })

    test('non existing html tag', () => {
      const value = `
        const Text = styled('foo')\`\`
      `
      const result = getTagName(getTargetNode(value), 'styled')
      expect(result).toBe('foo')
    })
  })
})

describe('getAttrs', () => {
  const getTargetNode = (code: string) => {
    const file = project.createSourceFile('virtual.ts', code, { overwrite: true })
    const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.TaggedTemplateExpression) as TaggedTemplateExpression
    return node.getTag()
  }

  test('no attrs', () => {
    const value = `const Text = styled.p\`\``
    const result = getAttrs(getTargetNode(value))
    expect(result).toStrictEqual([])
  })

  describe('attrs', () => {
    test('taking function', () => {
      const value = `const Text = styled.p.attrs(() => ({ className: 'foo' }))\`\``
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([{
        nodeKindName: 'ArrowFunction',
        text: `() => ({ className: 'foo' })`
      }])
    })

    test('taking object', () => {
      const value = `const Text = styled.p.attrs({ className: 'bar' })\`\``
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([{
        nodeKindName: 'ObjectLiteralExpression',
        text: `{ className: 'bar' }`
      }])
    })

    test('chained', () => {
      const value = `const Text = styled.p.attrs(() => ({ className: 'foo' })).attrs({ style: { width: 100 } })\`\``
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([
        {
          nodeKindName: 'ArrowFunction',
          text: `() => ({ className: 'foo' })`
        },
        {
          nodeKindName: 'ObjectLiteralExpression',
          text: `{ style: { width: 100 } }`
        }
      ])
    })
  })
})

test('evaluateBinaryExpression', async () => {
  const ts = (await import('typescript')).default
  const value = '2 + 3';
  const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
  const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.BinaryExpression)
  const result = evaluateBinaryExpression(node as BinaryExpression, {}, { ts, cssFunctionName: null } )
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
  const result = evaluatePropertyAccessExpression(node as PropertyAccessExpression, {}, { ts, cssFunctionName: null })
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
  const result = evaluateIdentifier(node as Identifier, {}, { ts, cssFunctionName: null })
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
  const result = evaluateTemplateExpression(node as TemplateExpression, {}, { ts, cssFunctionName: null })
  expect(result).toBe('5')
})

describe('evaluateInterpolation', async () => {
  const ts = (await import('typescript')).default
  const theme = { color: { main: 'coral' }, fontSize: { m: 16 } }
  const assert = (value: string, expectedResult: ReturnType<typeof evaluateSyntax>) => {
    const file = project.createSourceFile('virtual.ts', value, { overwrite: true })
    const node = file.getFirstDescendant(node => node.getKind() === SyntaxKind.ArrowFunction)
    const result = evaluateSyntax(node as ArrowFunction, {}, { ts, cssFunctionName: null }, theme)
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

  describe('ArrowFunction', () => {
    test('nested', () => {
      const value = `
        const getMainColor = (props) => ({ theme }) => props.theme.color.main + theme.color.main;
      `
      assert(value, 'coralcoral')
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

      test('with block', () => {
        const value = `
        const getMainColor = ({ theme }) => {
          const result = theme.color.main
          return result
        };
      `
        assert(value, 'coral')
      })
    })
  })

  test('CallExpression', () => {
    // TODO
    // const value = `
    //   const joinStr = (a: string, b: string) => a + b
    //   const getMainColor = () => joinStr('co', 'ral');
    // `
  })
})
