import withStaticStyled from '@static-styled-plugin/next-plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
    compiler: {
      styledComponents: true,
    },
}

export default withStaticStyled({ themeFilePath: './theme/theme.ts' })(nextConfig)
