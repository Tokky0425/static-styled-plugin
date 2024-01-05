const withStaticStyled = require('@static-styled-plugin/next-plugin')({
  themeFilePath: './app/theme.ts',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withStaticStyled(nextConfig)
