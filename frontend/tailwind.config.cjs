/** @type {import('tailwindcss').Config} */
// ใช้ module.exports เพราะ Vite React template (JavaScript) มักจะไม่ได้ตั้งค่า "type": "module" ใน package.json
// หาก package.json ของคุณมี "type": "module" คุณจะต้องเปลี่ยนเป็น export default
module.exports = { // <-- ตรวจสอบให้แน่ใจว่าใช้ module.exports
  content: [
    "./index.html", // สำหรับไฟล์ HTML หลักของ Vite
    "./src/**/*.{js,ts,jsx,tsx}", // สำหรับไฟล์ React components
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // เพิ่ม font Inter
      },
    },
  },
  plugins: [],
}
