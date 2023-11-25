import styled from 'styled-components'
import { BoldText } from '@/app/components/BoldText'

console.log('Hello, server!')
export function ServerComponent() {
  return (
    <>
      <h2>Server Component</h2>
      <StaticStyleText>static style text</StaticStyleText>
      <BoldText>bold text</BoldText>
    </>
  )
}

const StaticStyleText = styled.p`
  color: deeppink;
  font-size: ${(props) => props.theme.fontSize.l};
`
