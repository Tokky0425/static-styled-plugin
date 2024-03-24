import styled from 'styled-components'

console.log('Hello, client!')
export function ClientComponent() {
  const color = 'deeppink'
  return (
    <>
      <h2>Client Component</h2>
      <TextWithVar $color={color}>static style text</TextWithVar>
    </>
  )
}

const TextWithVar = styled.p<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-size: ${(props) => props.theme.fontSize.l};
`
