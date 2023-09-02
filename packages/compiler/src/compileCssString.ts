import { compile, serialize, stringify } from 'stylis'

export function compileCssString(code: string, className: string) {
  const compiled = compile(`.${className} { ${code} }`)
  return serialize(compiled, stringify)
}
