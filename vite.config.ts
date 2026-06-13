import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH || '/xeriscape-designer/'

export default defineConfig({
  base,
  plugins: [react()],
})
