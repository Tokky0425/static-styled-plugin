import { describe, expect, test } from 'vitest'
import {
  CallExpression,
  Node,
  Project,
  SyntaxKind,
  PropertyAccessExpression,
} from 'ts-morph'
import {
  compileStyledFunction,
  getAttrsArgs,
  getStyledExpression,
  getStyledFuncArg,
} from './compileStyledFunction'

const project = new Project()

const getLastNodeByName = (value: string, targetName: string): Node => {
  const file = project.createSourceFile('virtual.tsx', value, {
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

describe('compileStyledFunction', () => {
  test('styled with parsable css', () => {
    const value = `
const Text = styled.p\`
  color: red;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const expected = `
const Text = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'eTSWxy', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}`
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('styled with parsable css with variables', () => {
    const value = `
const color = 'red'
const Text = styled.p\`
  color: \${color};
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const expected = `
const color = 'red'
const Text = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'eIjkTb', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}`
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('styled with unparsable css', () => {
    const value = `
const SomeText = styled.p<{ color: string }>\`
  color: \${({ color }) => color};
\`;`
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(true)
    expect(file.getFullText()).toBe(value)
  })

  test('styled with unparsable html tag', () => {
    const value = `
const SomeText = styled.foo<{ color: string }>\`
  color: red;
\`;`
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(true)
    expect(file.getFullText()).toBe(value)
  })

  test('styled with attrs', () => {
    const value = `
const Text = styled.p.attrs({ foo: "bar" })\`
  color: red;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const expected = `
const Text = (props: any) => {
  const attrs0 = { foo: "bar" }
  const attrsProps = { ...attrs0 } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'eTSWxy', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}`

    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('styled with parsable styled-components extension', () => {
    const value = `
const RedText = styled.p\`
  color: red;
\`
const BlueText = styled(RedText)\`
  color: blue;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const expected = `
const RedText = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'eTSWxy', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}
const BlueText = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'ckfFBv', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}`
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('styled with unparsable styled-components extension', () => {
    const value = `
const SomeText = styled.p<{ color: string }>\`
  color: \${({ color }) => color};
\`
const BlueText = styled(SomeText)\`
  color: blue;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })

    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(true)
    expect(file.getFullText()).toBe(value)
  })

  test('styled with non-styled-components extension', () => {
    const value = `
const SomeText = (props: any) => <p {...props}/>
const ExtendedText = styled(SomeText)\`
  color: blue;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })

    const expected = `
const SomeText = (props: any) => <p {...props}/>
const ExtendedText = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = SomeText
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'ezvRVm', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} as={as || forwardedAs} $preventForwardingByStaticStyled={!!as} />;
}`

    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('styled with unknown component extension', () => {
    const value = `
import { SomeText } from 'maybe-some-node-module'
const ExtendedText = styled(SomeText)\`
  color: blue;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })

    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(true)
    expect(file.getFullText()).toBe(value)
  })

  test('styled with with dev mode', () => {
    const value = `
const Text = styled.p\`
  color: red;
\``
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const expected = `
const Text = (props: any) => {
  
  const attrsProps = {  } as any
  const { as, forwardedAs, $preventForwardingByStaticStyled, ...rest } = { ...props, ...attrsProps } as any
  const Tag = as || 'p'
  const joinedClassName = [$preventForwardingByStaticStyled ? '' : 'virtual__Text-ss ss-eTSWxy', attrsProps.className, props.className].filter(Boolean).join(' ')
  return <Tag { ...rest } className={joinedClassName} />;
}`

    const shouldUseClient = compileStyledFunction(file, 'styled', 'css', {
      devMode: true,
    })
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(expected)
  })

  test('no compile target exists', () => {
    const value = `
const SomeText = 'foo';`
    const file = project.createSourceFile('virtual.tsx', value, {
      overwrite: true,
    })
    const shouldUseClient = compileStyledFunction(file, 'styled', 'css')
    expect(shouldUseClient).toBe(false)
    expect(file.getFullText()).toBe(value)
  })
})

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
    const file = project.createSourceFile('virtual.tsx', code, {
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
