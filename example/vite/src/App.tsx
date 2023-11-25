import styled, { ThemeProvider } from 'styled-components'
import { theme } from './theme'
import { BoldText } from './BoldText'

function App() {
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

export default App
