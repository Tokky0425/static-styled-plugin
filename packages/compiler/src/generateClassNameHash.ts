// this is a copy of the styled-components hash function
// https://github.com/styled-components/styled-components/blob/22e8b7f233e12500a68be4268b1d79c5d7f2a661/packages/styled-components/src/utils/hash.ts
// https://github.com/styled-components/styled-components/blob/main/packages/styled-components/src/utils/generateAlphabeticName.ts
export const SEED = 5381 + 1

export const djb2 = (h: number, x: string) => {
  let i = x.length

  while (i) {
    h = (h * 33) ^ x.charCodeAt(--i)
  }

  return h
}

const charsLength = 52
const getAlphabeticChar = (code: number) =>
  String.fromCharCode(code + (code > 25 ? 39 : 97))
const AD_REPLACER_R = /(a)(d)/gi // https://github.com/styled-components/styled-components/issues/2803

function generateAlphabeticName(code: number) {
  let name = ''
  let x

  /* get a char and divide by alphabet-length */
  for (x = Math.abs(code); x > charsLength; x = (x / charsLength) | 0) {
    name = getAlphabeticChar(x % charsLength) + name
  }

  return (getAlphabeticChar(x % charsLength) + name).replace(
    AD_REPLACER_R,
    '$1-$2',
  )
}

export function generateClassNameHash(x: string) {
  return generateAlphabeticName(djb2(SEED, x))
}
