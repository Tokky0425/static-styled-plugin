import { ReactNode } from 'react'
import styled from 'styled-components'

export function App(): ReactNode {
  return <Title>Hello</Title>
}

const Title = styled.h1`
  color: red;
`
