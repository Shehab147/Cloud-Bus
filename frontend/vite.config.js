import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } },
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes('leaflet'))
                        return 'maps';
                    if (id.includes('lucide-react'))
                        return 'icons';
                    if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/'))
                        return 'forms';
                    if (id.includes('react') || id.includes('@tanstack'))
                        return 'react-vendor';
                }
            }
        }
    },
    test: { environment: 'jsdom', setupFiles: './tests/setup.ts', css: true }
});
