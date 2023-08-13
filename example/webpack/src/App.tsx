import styled, { ThemeProvider } from 'styled-components'
import { theme } from './theme'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <StaticStyleText>static style text</StaticStyleText>
      <DynamicStyleText>dynamic style text</DynamicStyleText>
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
