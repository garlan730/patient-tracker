import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site from https://<user>.github.io/patient-tracker/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/patient-tracker/' : '/',
  plugins: [react(), tailwindcss()],
}));
