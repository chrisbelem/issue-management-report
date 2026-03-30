import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/issue-management-report/steerco/',
  build: {
    outDir: '../docs/steerco',
    emptyOutDir: true,
  },
})
