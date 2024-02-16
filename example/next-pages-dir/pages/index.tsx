import styled from 'styled-components'

import { ThemeProvider } from 'styled-components'
import { BoldText } from '@/components/BoldText'
import { theme } from '@/theme/theme'

export default function Home() {
  return (
    <ThemeProvider theme={theme}>
      <StaticStyleText>static style text</StaticStyleText>
      <DynamicStyleText>dynamic style text</DynamicStyleText>
      <BoldText>bold text</BoldText>
    </ThemeProvider>
  )
}

const StaticStyleText = styled.p`
  color: coral;
  font-size: ${(props) => props.theme.fontSize.l};
`

const DynamicStyleText = styled(StaticStyleText)`
  color: navy;
`
