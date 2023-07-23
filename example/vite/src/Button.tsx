import { ReactNode, ButtonHTMLAttributes } from 'react'
import styled from 'styled-components'
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <ButtonComponent {...props}/>
}

const ButtonComponent = styled.button`
  border: solid blue 4px;
  padding: 4px 8px;
`
