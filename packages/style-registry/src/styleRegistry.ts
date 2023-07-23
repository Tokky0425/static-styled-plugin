type RuleMap = {
  [componentId: string]: {
    classNameHash: string,
    cssString: string,
  }
}

class StyleRegistry {
  ruleMap: RuleMap

  constructor() {
    this.ruleMap = {}
  }
  addRule(componentId: string, classNameHash: string, cssString: string,) {
    this.ruleMap[componentId] = {
      classNameHash,
      cssString,
    }
  }

  reset() {
    this.ruleMap = {}
  }

  getRule() {
    return this.buildStyleString()
  }

  buildStyleString() {
    let result = ''

    const build = () => {
      Object.values(this.ruleMap).forEach(({ classNameHash, cssString }) => {
        result += `.static-styled-${classNameHash}{${cssString}}`
      })
    }
    build()

    return result
  }
}

export const styleRegistry = new StyleRegistry()

