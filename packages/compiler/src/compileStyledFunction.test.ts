import { describe, expect, test } from 'vitest'
import { Project, SyntaxKind, TaggedTemplateExpression } from 'ts-morph'
import {
  getAttrs,
  parseTaggedTemplateExpression,
} from './compileStyledFunction'

const project = new Project()

describe('getTagName', () => {
  const getTargetNode = (code: string) => {
    const file = project.createSourceFile('virtual.ts', code, {
      overwrite: true,
    })
    const node = file.getFirstDescendant(
      (node) => node.getKind() === SyntaxKind.TaggedTemplateExpression,
    ) as TaggedTemplateExpression
    return node.getTag()
  }

  describe('PropertyAccessExpression', () => {
    test('', () => {
      const value = `
        const Text = styled.p\`\`
      `
      const result = parseTaggedTemplateExpression(
        getTargetNode(value),
        'styled',
      )
      expect(result).toStrictEqual({ htmlTagName: 'p', isStyledFunction: true })
    })

    describe('with attrs', () => {
      test('taking object', () => {
        const value = `
          const Text = styled.p.attrs({})\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
      test('taking function', () => {
        const value = `
          const Text = styled.p.attrs(() => ({}))\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
      test('chained', () => {
        const value = `
          const Text = styled.p.attrs({}).attrs(() => ({}))\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
    })

    test('non existing html tag', () => {
      const value = `
        const Text = styled.foo\`\`
      `
      const result = parseTaggedTemplateExpression(
        getTargetNode(value),
        'styled',
      )
      expect(result).toStrictEqual({
        htmlTagName: 'foo',
        isStyledFunction: true,
      })
    })
  })

  describe('CallExpression', () => {
    test('', () => {
      const value = `
        const Text = styled('p')\`\`
      `
      const result = parseTaggedTemplateExpression(
        getTargetNode(value),
        'styled',
      )
      expect(result).toStrictEqual({ htmlTagName: 'p', isStyledFunction: true })
    })

    describe('attrs', () => {
      test('attrs taking object', () => {
        const value = `
          const Text = styled('p').attrs({})\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
      test('taking function', () => {
        const value = `
          const Text = styled('p').attrs(() => ({}))\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
      test('chained', () => {
        const value = `
          const Text = styled('p').attrs({}).attrs(() => ({}))\`\`
        `
        const result = parseTaggedTemplateExpression(
          getTargetNode(value),
          'styled',
        )
        expect(result).toStrictEqual({
          htmlTagName: 'p',
          isStyledFunction: true,
        })
      })
    })

    test('non existing html tag', () => {
      const value = `
        const Text = styled('foo')\`\`
      `
      const result = parseTaggedTemplateExpression(
        getTargetNode(value),
        'styled',
      )
      expect(result).toStrictEqual({
        htmlTagName: 'foo',
        isStyledFunction: true,
      })
    })
  })
})

describe('getAttrs', () => {
  const getTargetNode = (code: string) => {
    const file = project.createSourceFile('virtual.ts', code, {
      overwrite: true,
    })
    const node = file.getFirstDescendant(
      (node) => node.getKind() === SyntaxKind.TaggedTemplateExpression,
    ) as TaggedTemplateExpression
    return node.getTag()
  }

  test('no attrs', () => {
    const value = 'const Text = styled.p``'
    const result = getAttrs(getTargetNode(value))
    expect(result).toStrictEqual([])
  })

  describe('attrs', () => {
    test('taking function', () => {
      const value =
        "const Text = styled.p.attrs(() => ({ className: 'foo' }))``"
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([
        {
          nodeKindName: 'ArrowFunction',
          text: "() => ({ className: 'foo' })",
        },
      ])
    })

    test('taking object', () => {
      const value = "const Text = styled.p.attrs({ className: 'bar' })``"
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([
        {
          nodeKindName: 'ObjectLiteralExpression',
          text: "{ className: 'bar' }",
        },
      ])
    })

    test('chained', () => {
      const value =
        "const Text = styled.p.attrs(() => ({ className: 'foo' })).attrs({ style: { width: 100 } })``"
      const result = getAttrs(getTargetNode(value))
      expect(result).toStrictEqual([
        {
          nodeKindName: 'ArrowFunction',
          text: "() => ({ className: 'foo' })",
        },
        {
          nodeKindName: 'ObjectLiteralExpression',
          text: '{ style: { width: 100 } }',
        },
      ])
    })
  })
})
