import { describe, expect, test } from 'vitest'
import {
  CallExpression,
  Node,
  Project,
  SyntaxKind,
  PropertyAccessExpression,
} from 'ts-morph'
import {
  getAttrsArgs,
  getStyledExpression,
  getStyledFuncArg,
} from './compileStyledFunction'

const project = new Project()

const getLastNodeByName = (value: string, targetName: string): Node => {
  const file = project.createSourceFile('virtual.ts', value, {
    overwrite: true,
  })
  const nodes = file.getDescendants()
  let node

  for (const nodeElement of nodes) {
    if (nodeElement.getText() === targetName) {
      node = nodeElement
    }
  }

  return node as Node
}

describe('getStyledExpression', () => {
  test('styled.p', () => {
    const value = `
        const Text = styled.p\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, 'styled.p'),
      'styled',
    )
    expect(result?.getKindName()).toBe('PropertyAccessExpression')
  })
  test('styled.p', () => {
    const value = `
        const Text = styled.p\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, 'styled.p'),
      'myStyled',
    )
    expect(result).toBe(null)
  })
  test('styled.p.attrs({})', () => {
    const value = `
        const Text = styled.p.attrs({})\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, 'styled.p.attrs({})'),
      'styled',
    )
    expect(result?.getKindName()).toBe('PropertyAccessExpression')
  })
  test("styled('p')", () => {
    const value = `
        const Text = styled('p')\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, "styled('p')"),
      'styled',
    )
    expect(result?.getKindName()).toBe('CallExpression')
  })
  test("styled('p').attrs({})", () => {
    const value = `
        const Text = styled('p').attrs({})\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, "styled('p').attrs({})"),
      'styled',
    )
    expect(result?.getKindName()).toBe('CallExpression')
  })
  test('styled(Foo)', () => {
    const value = `
        const Text = styled(Foo)\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, 'styled(Foo)'),
      'styled',
    )
    expect(result?.getKindName()).toBe('CallExpression')
  })
  test('styled(Foo).attrs({})', () => {
    const value = `
        const Text = styled(Foo).attrs({})\`\`
      `
    const result = getStyledExpression(
      getLastNodeByName(value, 'styled(Foo).attrs({})'),
      'styled',
    )
    expect(result?.getKindName()).toBe('CallExpression')
  })
})

describe('getStyledFuncArg', () => {
  type ResultType = CallExpression | PropertyAccessExpression

  test('styled.p', () => {
    const value = `
        const Text = styled.p\`\`
      `
    const result = getLastNodeByName(value, 'styled.p') as ResultType
    expect(getStyledFuncArg(result)).toBe('p')
  })
  test("styled('foo')", () => {
    const value = `
        const Text = styled('foo')\`\`
      `
    const result = getLastNodeByName(value, "styled('foo')") as ResultType
    expect(getStyledFuncArg(result)).toBe('foo')
  })
  test("styled('p')", () => {
    const value = `
        const Text = styled('p')\`\`
      `
    const result = getLastNodeByName(value, "styled('p')") as ResultType
    expect(getStyledFuncArg(result)).toBe('p')
  })
})

describe('getAttrsArgs', () => {
  const getTargetNode = (code: string) => {
    const file = project.createSourceFile('virtual.ts', code, {
      overwrite: true,
    })
    const nodes = file.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression)
    return nodes.at(-1).getTag()
  }

  test('no attrs', () => {
    const value = 'const Text = styled.p``'
    const result = getAttrsArgs(getTargetNode(value))
    expect(result).toStrictEqual([])
  })

  describe('attrs', () => {
    test('taking function', () => {
      const value =
        "const Text = styled.p.attrs(() => ({ className: 'foo' }))``"
      const result = getAttrsArgs(getTargetNode(value))
      expect(result.map((arg) => arg.getText())).toStrictEqual([
        "() => ({ className: 'foo' })",
      ])
    })

    test('taking object', () => {
      const value = "const Text = styled.p.attrs({ className: 'bar' })``"
      const result = getAttrsArgs(getTargetNode(value))
      expect(result.map((arg) => arg.getText())).toStrictEqual([
        "{ className: 'bar' }",
      ])
    })

    test('chained', () => {
      const value =
        "const Text = styled.p.attrs(() => ({ className: 'foo' })).attrs({ style: { width: 100 } })``"
      const result = getAttrsArgs(getTargetNode(value))
      expect(result.map((arg) => arg.getText())).toStrictEqual([
        "() => ({ className: 'foo' })",
        '{ style: { width: 100 } }',
      ])
    })
  })
})
