import { describe, expect, test } from 'vitest'
import { Node, Project, SyntaxKind } from 'ts-morph'
import { Evaluator, TsEvalError } from './Evaluator'

const project = new Project()

describe('Evaluator', async () => {
  const ts = (await import('typescript')).default
  const theme = { color: { main: 'coral' }, fontSize: { m: 16 } }

  const getFirstNode = (
    value: string,
    syntaxKind: SyntaxKind,
    withoutTheme?: boolean,
    extra: Evaluator['extra'] = {},
  ): [Evaluator, Node] => {
    const file = project.createSourceFile('virtual.ts', value, {
      overwrite: true,
    })
    const node = file.getFirstDescendant(
      (node) => node.getKind() === syntaxKind,
    )!
    const evaluator = new Evaluator({
      extra,
      definition: { ts, styledFunctionName: 'styled', cssFunctionName: 'css' },
      theme: withoutTheme ? null : theme,
    })
    return [evaluator, node]
  }

  const getLastNodeByName = (
    value: string,
    targetName: string,
    withoutTheme?: boolean,
    extra: Evaluator['extra'] = {},
  ): [Evaluator, Node] => {
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

    const evaluator = new Evaluator({
      extra,
      definition: { ts, styledFunctionName: 'styled', cssFunctionName: 'css' },
      theme: withoutTheme ? null : theme,
    })
    return [evaluator, node!]
  }

  test('AsExpression', () => {
    const value = `
      const theme = { color: { main: 'coral' } } as const;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.AsExpression)
    expect(evaluator.evaluateNode(node)).toStrictEqual({
      color: { main: 'coral' },
    })
  })

  test('SatisfiesExpression', () => {
    const value = `
      type Theme = { color: { main: string } }
      const theme = { color: { main: 'coral' } } as const satisfies Theme;
    `
    const [evaluator, node] = getFirstNode(
      value,
      SyntaxKind.SatisfiesExpression,
    )
    expect(evaluator.evaluateNode(node)).toStrictEqual({
      color: { main: 'coral' },
    })
  })

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
    const [evaluator, node] = getFirstNode(
      value,
      SyntaxKind.NoSubstitutionTemplateLiteral,
    )
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  describe('PropertyAccessExpression', () => {
    test('with as const', () => {
      const value = `
        const theme = { color: { main: 'coral' } } as const;
        const mainColor = theme.color.main;
      `
      const [evaluator, node] = getFirstNode(
        value,
        SyntaxKind.PropertyAccessExpression,
      )
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    test('without as const', () => {
      const value = `
        const theme = { color: { main: 'coral' } };
        const mainColor = theme.color.main;
      `
      const [evaluator, node] = getFirstNode(
        value,
        SyntaxKind.PropertyAccessExpression,
      )
      expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
    })

    test('with extra', () => {
      const value = `
        const firstName = user.name.firstName;
      `
      const extra = {
        user: { name: { firstName: 'Michael', lastName: 'Jackson' } },
      }
      const [evaluator, node] = getFirstNode(
        value,
        SyntaxKind.PropertyAccessExpression,
        true,
        extra,
      )
      expect(evaluator.evaluateNode(node)).toBe('Michael')
    })
  })

  describe('Identifier', () => {
    test('declared by const', () => {
      const value = `
        const color = 'coral';
        const mainColor = color;
      `
      const [evaluator, node] = getLastNodeByName(value, 'color')
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    test('declared by let', () => {
      const value = `
        let color = 'coral';
        return color;
      `
      const [evaluator, node] = getLastNodeByName(value, 'color')
      expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
    })

    test('declared by object destructuring', () => {
      const value = `
        const color = { main: 'coral' } as const;
        const { main } = color;
        return main;
      `
      const [evaluator, node] = getLastNodeByName(value, 'main')
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    test('object with `as const`', () => {
      const value = `
        const color = { main: 'coral' } as const;
        return color;
      `
      const [evaluator, node] = getLastNodeByName(value, 'color')
      expect(evaluator.evaluateNode(node)).toStrictEqual({ main: 'coral' })
    })

    test('object without `as const`', () => {
      const value = `
        const color = { main: 'coral' };
        return color;
      `
      const [evaluator, node] = getLastNodeByName(value, 'color')
      expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
    })

    test('object destructuring', () => {
      const value = `
        const theme = { color: { main: 'coral' } } as const;
        const { color: { main } } = theme
      `
      const [evaluator, node] = getLastNodeByName(value, 'main')
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    describe('when the target is related to theme', () => {
      test('object destructuring from `props`', () => {
        const value = `
          const Text = styled.p\`
            color: \${(props) => {
              const { theme: { color: { main } } } = props;
              return main;
            }};
          \`
        `

        // this extra is expected to be added before coming here
        const extra = {
          props: { theme },
        }
        const [evaluator, node] = getLastNodeByName(value, 'main', false, extra)
        expect(evaluator.evaluateNode(node)).toBe('coral')
      })

      // TODO: fix code to pass this test
      test('object destructuring from `props.theme`', () => {
        const value = `
          const Text = styled.p\`
            color: \${(props) => {
              const { color: { main } } = props.theme;
              return main;
            }};
          \`
        `

        // this extra is expected to be added before coming here
        const extra = {
          props: { theme },
        }
        const [evaluator, node] = getLastNodeByName(value, 'main', false, extra)
        expect(evaluator.evaluateNode(node)).toBe('coral')
      })
    })
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
      const mainColor = \`\${a + b}\`;
    `
    const [evaluator, node] = getFirstNode(value, SyntaxKind.TemplateExpression)
    expect(evaluator.evaluateNode(node)).toBe('coral')
  })

  describe('TemplateExpression', () => {
    test('NoSubstitutionTemplateLiteral', () => {
      const value = `
        const mainColor = \`coral\`;
      `
      const [evaluator, node] = getFirstNode(
        value,
        SyntaxKind.NoSubstitutionTemplateLiteral,
      )
      expect(evaluator.evaluateNode(node)).toBe('coral')
    })

    describe('SubstitutionTemplateLiteral', () => {
      test('with css function', () => {
        const value = `
          const getMainColor = () => \`\${css\`color: coral;\`}\`
        `
        const [evaluator, node] = getFirstNode(
          value,
          SyntaxKind.TaggedTemplateExpression,
        )
        expect(evaluator.evaluateNode(node)).toBe('color: coral;')
      })

      test('with not css function', () => {
        const value = `
          const getMainColor = () => \`\${foo\`color: coral;\`}\`
        `
        const [evaluator, node] = getFirstNode(
          value,
          SyntaxKind.TaggedTemplateExpression,
        )
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
          const [evaluator, node] = getFirstNode(
            value,
            SyntaxKind.ArrowFunction,
          )
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })

        test('with rename', () => {
          const value = `
            const getMainColor = ({ theme: myTheme }) => myTheme.color.main;
          `
          const [evaluator, node] = getFirstNode(
            value,
            SyntaxKind.ArrowFunction,
          )
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })

        test('other than "theme"', () => {
          const value = `
            const getMainColor = ({ someObj }) => someObj.color.main;
          `
          const [evaluator, node] = getFirstNode(
            value,
            SyntaxKind.ArrowFunction,
          )
          expect(evaluator.evaluateNode(node, true)).toBe(TsEvalError)
        })

        test('without theme', () => {
          const value = `
            const getMainColor = (props) => props.theme.color.main;
          `
          const [evaluator, node] = getFirstNode(
            value,
            SyntaxKind.ArrowFunction,
            true,
          )
          expect(evaluator.evaluateNode(node, true)).toBe(TsEvalError)
        })

        test('with block', () => {
          const value = `
            const getMainColor = ({ theme }) => {
              const result = theme.color.main
              return result
            };
          `
          const [evaluator, node] = getFirstNode(
            value,
            SyntaxKind.ArrowFunction,
          )
          expect(evaluator.evaluateNode(node, true)).toBe('coral')
        })
      })
    })

    test('NOT in styled function', () => {
      const value = `
        const getMainColor = (props) => props.theme.color.main;
      `
      const [evaluator, node] = getFirstNode(value, SyntaxKind.ArrowFunction)
      expect(evaluator.evaluateNode(node, false)).toBe(TsEvalError)
    })
  })

  test('ObjectLiteralExpression', () => {
    const value = `
      const mainColor = 'coral'
      const color = { main: mainColor };
    `
    const [evaluator, node] = getFirstNode(
      value,
      SyntaxKind.ObjectLiteralExpression,
    )
    expect(evaluator.evaluateNode(node)).toStrictEqual({ main: 'coral' })
  })

  test('ArrayLiteralExpression', () => {
    const value = `
      const a = 'co'
      const b = 'ral'
      const color = [a, b];
    `
    const [evaluator, node] = getFirstNode(
      value,
      SyntaxKind.ArrayLiteralExpression,
    )
    expect(evaluator.evaluateNode(node)).toStrictEqual(['co', 'ral'])
  })

  test('ConditionalExpression', () => {
    const value = `
      const color = true ? 'coral' : 'lime';
    `
    const [evaluator, node] = getFirstNode(
      value,
      SyntaxKind.ConditionalExpression,
    )
    expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
  })

  describe('CallExpression', () => {
    const getNode = (value: string) => {
      const file = project.createSourceFile('virtual.ts', value, {
        overwrite: true,
      })
      const nodes = file.getDescendants()
      let targetNode: Node
      let count = 0
      for (const node of nodes) {
        if (count === 1) continue
        if (Node.isCallExpression(node)) count += 1
        if (count === 1) targetNode = node
      }
      const evaluator = new Evaluator({
        extra: {},
        definition: { ts },
      })
      return [evaluator, targetNode!] as const
    }

    describe('when arrow function', () => {
      test('when args are passed directly', () => {
        const value = `
        const joinStr = (a: string, b: string) => a + b
        const getMainColor = () => {
          return joinStr('co', 'ral')
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      test('when params are variables', () => {
        const value = `
        const joinStr = (a: string, b: string) => a + b
        const getMainColor = () => {
          const first = 'co'
          const second = 'ral'
          return joinStr(first, second)
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      test('when args have default value', () => {
        const value = `
        const joinStr = (a: string, b: string = 'ral') => a + b
        const getMainColor = () => {
          return joinStr('co')
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      test('when args are object', () => {
        const value = `
        const joinStr = (arg: { a: string, b: string }) => arg.a + arg.b
        const getMainColor = () => {
          return joinStr({ a: 'co', b: 'ral' })
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      // test('when curry function', () => {
      //   const value = `
      //   const joinStr = (a: string) => (b: string) => a + b
      //   const getMainColor = () => {
      //     return joinStr('co')('ral')
      //   }
      //   `
      //   const [evaluator, node] = getNode(value)
      //   expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      // })

      test('when args are array', () => {
        const value = `
        const joinStr = (arg: [string, string]) => arg[0] + arg[1]
        const getMainColor = () => {
          return joinStr(['co', 'ral'])
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      // test('when args are function', () => {
      //   const value = `
      //   const buildFirstArg = () => 'c' + 'o'
      //   const joinStr = (a: () => string, b: string) => a() + b
      //   const getMainColor = () => {
      //     return joinStr(buildFirstArg, 'ral')
      //   }
      //   `
      //   const [evaluator, node] = getNode(value)
      //   expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      // })

      test('when function is declared inside the function', () => {
        const value = `
        const getMainColor = () => {
          const joinStr = (a: string, b: string) => a + b
          return joinStr('co', 'ral')
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })

      test('when function is declared by let', () => {
        const value = `
        let joinStr = (a: string, b: string) => a + b
        const getMainColor = () => {
          return joinStr('co', 'ral')
        }
        `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toBe(TsEvalError)
      })
    })

    describe('when function declaration', () => {
      test('when args are passed directly', () => {
        const value = `
        function joinStr(a: string, b: string) {
          return a + b
        }
        const getMainColor = () => {
          return joinStr('co', 'ral')
        }
      `
        const [evaluator, node] = getNode(value)
        expect(evaluator.evaluateNode(node)).toStrictEqual('coral')
      })
    })
  })
})
