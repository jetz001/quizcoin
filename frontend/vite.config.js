import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // อนุญาตให้ Vite เข้าถึงไฟล์จากไดเรกทอรีแม่ (D:/Project/quizcoin)
      // ซึ่งจำเป็นสำหรับการนำเข้า ABI จาก backend/artifacts
      allow: ['..'],
    },
  },
});
