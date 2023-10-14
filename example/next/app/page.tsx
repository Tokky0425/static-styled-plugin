'use client'

import styled from 'styled-components'

export default function Home() {
  return (
    <>
      <StaticStyleText>static style text</StaticStyleText>
      <DynamicStyleText>dynamic style text</DynamicStyleText>
    </>
  )
}

const StaticStyleText = styled.p`
  color: coral;
`

const DynamicStyleText = styled(StaticStyleText)`
  color: navy;
`
