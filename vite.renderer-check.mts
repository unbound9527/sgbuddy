import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// 临时校验用：只构建渲染层，输出到临时目录，避免清空 dist/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'D:/tmp/sgbuddy-renderer-check',
    emptyOutDir: false,
    rollupOptions: { input: path.resolve(__dirname, 'index.html') },
  },
})
