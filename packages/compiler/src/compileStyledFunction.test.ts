import { describe, expect, test } from 'vitest'
import { Project, SyntaxKind, TaggedTemplateExpression } from 'ts-morph'
import { getAttrs, getTagName } from './compileStyledFunction'

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
