import styled from 'styled-components'

console.log('Hello, server!')
export function ServerComponent() {
  return (
    <>
      <h2>Server Component</h2>
      <StaticStyleText>static style text</StaticStyleText>
    </>
  )
}

const StaticStyleText = styled.p`
  color: deeppink;
  font-size: ${(props) => props.theme.fontSize.l};
`

