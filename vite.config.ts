import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // @refinedev/react-router declares react-router as a regular dependency, so
    // a nested copy can be installed alongside the app's copy. Two instances of
    // react-router mean two Router contexts, which breaks hooks like
    // useLocation inside Refine. Force a single copy.
    dedupe: ['react', 'react-dom', 'react-router'],
  },
})
