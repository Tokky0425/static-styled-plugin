const { withStaticStyled } = require('@static-styled-plugin/next-plugin')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withStaticStyled(nextConfig)
