const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react({ include: /\.[jt]sx?$/ })],
  base: './',
  build: {
    outDir: 'build',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfmake/build/vfs_fonts')) {
            return 'pdf-fonts';
          }

          if (id.includes('pdfmake')) {
            return 'pdfmake';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
