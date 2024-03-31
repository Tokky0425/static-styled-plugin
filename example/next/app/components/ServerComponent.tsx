import styled from 'styled-components'
import { BoldText } from '@/app/components/BoldText'

console.log('Hello, server!')
export function ServerComponent() {
  return (
    <>
      <h2>Client Component</h2>
      <StaticStyleText>text</StaticStyleText>
      <ExtendedText>extended text</ExtendedText>
      <BoldText>bold text</BoldText>
    </>
  )
}

const StaticStyleText = styled.p`
  color: coral;
  font-size: ${(props) => props.theme.fontSize.l};
`

const ExtendedText = styled(StaticStyleText)`
  color: navy;
`
