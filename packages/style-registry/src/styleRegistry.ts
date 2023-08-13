type RuleMap = {
  [classNameHash: string]: string
}

class StyleRegistry {
  ruleMap: RuleMap

  constructor() {
    this.ruleMap = {}
  }
  addRule(classNameHash: string, cssString: string,) {
    this.ruleMap[classNameHash] = cssString
  }

  reset() {
    this.ruleMap = {}
  }

  getRule() {
    return this.buildStyleString()
  }

  buildStyleString() {
    let result = ''

    Object.keys(this.ruleMap).forEach((classNameHash) => {
      result += `.static-styled-${classNameHash}{${this.ruleMap[classNameHash]}}`
    })

    return result
  }
}

export const styleRegistry = new StyleRegistry()

