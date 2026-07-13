import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths so the build works from a subpath (GitHub Pages
  // serves this at /pm_trainsim/) as well as any other static host.
  base: './',
  build: {
    target: 'es2022',
  },
})
