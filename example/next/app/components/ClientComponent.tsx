import styled from 'styled-components'
import { BoldText } from '@/app/components/BoldText'

console.log('Hello, client!')
export function ClientComponent() {
  return (
    <>
      <h2>Client Component</h2>
      <StaticStyleText>static style text</StaticStyleText>
      <DynamicStyleText>dynamic style text</DynamicStyleText>
      <BoldText>bold text</BoldText>
    </>
  )
}

const StaticStyleText = styled.p`
  color: coral;
  font-size: ${(props) => props.theme.fontSize.l};
`

const DynamicStyleText = styled(StaticStyleText)`
  color: navy;
`
