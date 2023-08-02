import { useState, ReactNode } from 'react'
import styled from 'styled-components'
import { Button } from './Button'

function App() {
  const [showText, setShowText] = useState(true)
  return (
    <div>
      <Button onClick={() => setShowText((prev) => !prev)}>toggle color</Button>
      <Title color="red">Blue</Title>
      <OrangeText>orange</OrangeText>
      {showText && <Text>red</Text>}
      <BlackText>black</BlackText>
      {showText && <PinkText>pink</PinkText>}
      <PinkText>pink</PinkText>
    </div>
  )
}


function TextComponent (props: { color: "red" | "blue", children: ReactNode, className?: string }) {
  return <h1 color={props.color} className={props.className}>{props.children}</h1>
}

const Title = styled(TextComponent)`
  font-size: 54px;
  color: blue;
`

const Text = styled.p`
  display: flex;
  color: red;
`

const BlackText = styled(Text)`
  color: black;
`

const OrangeText = styled(BlackText)`
  color: orange;
`

const PinkText = styled(Text)`
  color: pink;
`

export default App
