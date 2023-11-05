type RuleMap = {
  [classNameHash: string]: string
}

class StyleRegistry {
  ruleMap: RuleMap

  constructor() {
    this.ruleMap = {} // this can be just an array, but leave it as it is for the convenience of the future
  }
  addRule(classNameHash: string, cssString: string) {
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
      result += this.ruleMap[classNameHash]
    })

    return result
  }
}

export const styleRegistry = new StyleRegistry()
