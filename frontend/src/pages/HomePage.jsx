import React, { useState } from "react";

const HomePage = ({ connectWallet, userAccount, disconnectWallet, onModeSelect }) => {
  const [showModeSelection, setShowModeSelection] = useState(false);

  const handleConnectClick = async () => {
    await connectWallet();
    setShowModeSelection(true);
  };

  const handleModeSelect = (mode) => {
    onModeSelect(mode);
  };

  // Copy to clipboard function
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('คัดลอกที่อยู่เหรียญ QZC สำเร็จ!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('คัดลอกที่อยู่เหรียญ QZC สำเร็จ!');
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white relative overflow-hidden">
      {/* Top Navigation with MetaMask Connection */}
      <div className="absolute top-0 right-0 z-20 p-6">
        {!userAccount ? (
          <button
            onClick={handleConnectClick}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl flex items-center space-x-2"
          >
            <span>🦊</span>
            <span>เชื่อมต่อ MetaMask</span>
          </button>
        ) : (
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <span className="text-green-400 font-mono text-sm">
                🔗 {userAccount.slice(0, 6)}...{userAccount.slice(-4)}
              </span>
            </div>
            {!showModeSelection && (
              <button
                onClick={() => setShowModeSelection(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 text-sm"
              >
                เลือกโหมด
              </button>
            )}
            <button
              onClick={disconnectWallet}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 text-sm"
            >
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse delay-500"></div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Main Content */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo and Title */}
          <div className="mb-8">
            <div className="relative inline-block">
              <h1 className="text-6xl md:text-8xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
                QuizCoin
              </h1>
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 rounded-lg blur-lg animate-pulse"></div>
            </div>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 font-light">
              🎯 ระบบนิเวศที่พาคุณจากเกมตอบคำถามสู่การสร้างองค์ความรู้และธุรกิจจริง
            </p>
            <p className="text-lg text-purple-300 mt-2 font-medium">
              ✨ 9 ระยะการเดินทาง: จากผู้เล่น → นักวิจัย → ผู้ประกอบการ
            </p>
          </div>

          {/* QZC Token Address Section */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30 mb-8 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold mb-3 text-yellow-400">🪙 QuizCoin (QZC) Token Address</h3>
            <div className="bg-black/30 rounded-xl p-4 mb-3">
              <p className="text-green-400 font-mono text-sm break-all">
0x1234567890123456789012345678901234567890
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => copyToClipboard('0x1234567890123456789012345678901234567890')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2"
              >
                <span>📋</span>
                <span>คัดลอก</span>
              </button>
              <span className="bg-orange-600/20 text-orange-300 px-4 py-2 rounded-lg text-sm">
                🌐 BSC Testnet
              </span>
            </div>
          </div>

          {/* Timeline Chart Section */}
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-sm rounded-3xl p-8 border border-indigo-500/30 mb-12 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              🚀 QuizCoin Ecosystem Timeline: 9 ระยะแห่งการเดินทาง
            </h2>
            
            {/* Timeline Container */}
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 rounded-full"></div>
              
              {/* Timeline Items */}
              <div className="space-y-12">
                {/* Phase 1: Current Phase */}
                <div className="relative flex items-center">
                  <div className="flex-1 text-right pr-8">
                    <div className="bg-green-500/20 border-2 border-green-400 rounded-2xl p-4">
                      <h3 className="text-lg font-bold text-green-400 mb-2">🎮 Phase 1: เกมและการรับเหรียญ</h3>
                      <p className="text-sm text-gray-300">เล่นเกมตอบคำถาม รับ QZC ทันที</p>
                      <div className="mt-2 text-xs text-green-300">✅ Status: เปิดให้บริการแล้ว</div>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-green-400 rounded-full border-4 border-white shadow-lg animate-pulse">
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-400 text-black px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                      👈 เราอยู่ที่นี่
                    </div>
                  </div>
                  <div className="flex-1 pl-8"></div>
                </div>

                {/* Phase 2 */}
                <div className="relative flex items-center">
                  <div className="flex-1 pr-8"></div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                  <div className="flex-1 pl-8">
                    <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
                      <h3 className="text-lg font-bold text-blue-400 mb-2">🏛️ Phase 2: Academy System</h3>
                      <p className="text-sm text-gray-300">สร้างทีม เข้าร่วมการแข่งขัน IQS</p>
                      <div className="mt-2 text-xs text-gray-400">⏳ Coming Soon</div>
                    </div>
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="relative flex items-center">
                  <div className="flex-1 text-right pr-8">
                    <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
                      <h3 className="text-lg font-bold text-purple-400 mb-2">👼 Phase 3: Angel Council</h3>
                      <p className="text-sm text-gray-300">Top 10 Academy ได้สิทธิ์เป็น Angel</p>
                      <div className="mt-2 text-xs text-gray-400">⏳ Coming Soon</div>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                  <div className="flex-1 pl-8"></div>
                </div>

                {/* Phase 4-6 Group */}
                <div className="relative flex items-center">
                  <div className="flex-1 pr-8"></div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                  <div className="flex-1 pl-8">
                    <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
                      <h3 className="text-lg font-bold text-cyan-400 mb-2">🔬 Phase 4-6: Research Era</h3>
                      <p className="text-sm text-gray-300">ทุนวิจัย • สัญญาโอนย้าย • วารสารวิชาการ</p>
                      <div className="mt-2 text-xs text-gray-400">⏳ Future Development</div>
                    </div>
                  </div>
                </div>

                {/* Phase 7-9 Group */}
                <div className="relative flex items-center">
                  <div className="flex-1 text-right pr-8">
                    <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
                      <h3 className="text-lg font-bold text-pink-400 mb-2">🚀 Phase 7-9: Business Era</h3>
                      <p className="text-sm text-gray-300">Startup • Community Funding • Domestic Growth</p>
                      <div className="mt-2 text-xs text-gray-400">⏳ Future Vision</div>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white"></div>
                  <div className="flex-1 pl-8"></div>
                </div>
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="mt-8 text-center">
              <div className="bg-white/10 rounded-full p-4 inline-block">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-300">ความคืบหน้าโครงการ:</div>
                  <div className="flex space-x-2">
                    <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                  </div>
                  <div className="text-sm text-green-400 font-bold">Phase 1/9 (11%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Ranking System */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-3xl p-8 border border-yellow-500/30 mb-12 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              🏆 ระบบจัดอันดับผู้เล่น: 20 ระดับ
            </h2>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-bold text-green-400 mb-2">👶 ผู้เริ่มต้น (1-4)</h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>1. ผู้เรียนรู้ (1-250)</div>
                  <div>2. นักฝึกหัด (251-500)</div>
                  <div>3. นักศึกษา (501-750)</div>
                  <div>4. ผู้เชี่ยวชาญฝึกหัด (751-1K)</div>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-bold text-blue-400 mb-2">🎓 นักวิชาการ (5-8)</h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>5. นักวิจัย (1K-1.5K)</div>
                  <div>6. ผู้ช่วยสอน (1.5K-2K)</div>
                  <div>7. ผู้เชี่ยวชาญเฉพาะทาง (2K-2.5K)</div>
                  <div>8. นักวิชาการ (2.5K-3K)</div>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-bold text-purple-400 mb-2">🧙 ปราชญ์ (9-12)</h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>9. ผู้รอบรู้ (3K-4K)</div>
                  <div>10. ผู้เชี่ยวชาญ (4K-5K)</div>
                  <div>11. ปราชญ์ (5K-6K)</div>
                  <div>12. ผู้ให้ความรู้ (6K-7K)</div>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="font-bold text-pink-400 mb-2">👑 ปรมาจารย์+ (13-20)</h4>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>13-16. ปรมาจารย์ (7K-15K)</div>
                  <div>17-20. ผู้อำนวยการ (15K+)</div>
                  <div className="text-yellow-400 font-bold">20. Grand Director (30K+)</div>
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-gray-400">
              💡 คะแนนมาจาก: ความแม่นยำ + ความสม่ำเสมอ + การสร้างสรรค์ + ความสำเร็จ
            </div>
          </div>

          {/* Academy System */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 backdrop-blur-sm rounded-3xl p-8 border border-cyan-500/30 mb-12 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              🏛️ ระบบ Academy: จากทีมสู่มหาวิทยาลัย
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-4 text-cyan-300">🎯 โครงสร้างภายใน</h3>
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-yellow-400 font-bold">👨‍💼 ผู้อำนวยการ (Director)</span>
                    <p className="text-xs text-gray-400 mt-1">ผู้ก่อตั้ง Academy</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-blue-400 font-bold">👨‍🏫 อาจารย์ (Professor)</span>
                    <p className="text-xs text-gray-400 mt-1">แต่งตั้งโดยผู้อำนวยการ</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-green-400 font-bold">👨‍🎓 นักเรียน (Student)</span>
                    <p className="text-xs text-gray-400 mt-1">สมาชิกทั่วไป</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4 text-teal-300">📊 ระดับ Academy</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-white/5 rounded-lg p-2">
                    <span>🏫 College</span>
                    <span className="text-gray-400">1-1K คะแนน</span>
                  </div>
                  <div className="flex justify-between bg-white/5 rounded-lg p-2">
                    <span>🏛️ Faculty</span>
                    <span className="text-gray-400">1K-5K คะแนน</span>
                  </div>
                  <div className="flex justify-between bg-white/5 rounded-lg p-2">
                    <span>🎓 University</span>
                    <span className="text-gray-400">5K-10K คะแนน</span>
                  </div>
                  <div className="flex justify-between bg-white/5 rounded-lg p-2">
                    <span>🔬 Research University</span>
                    <span className="text-gray-400">10K-20K คะแนน</span>
                  </div>
                  <div className="flex justify-between bg-white/5 rounded-lg p-2">
                    <span className="text-yellow-400 font-bold">🏆 Ivy League</span>
                    <span className="text-yellow-400">20K+ คะแนน</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Research & Startup Ecosystem */}
          <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 backdrop-blur-sm rounded-3xl p-8 border border-rose-500/30 mb-12 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
              🔬 ระบบวิจัยและธุรกิจ
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-3 text-blue-400">👼 Angel Council</h3>
                <p className="text-sm text-gray-300 mb-3">Top 10 Academy มีสิทธิ์:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• แต่งตั้ง Angel</li>
                  <li>• อนุมัติทุนวิจัย</li>
                  <li>• ลงทุนใน Startup</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-3 text-purple-400">📚 Journal System</h3>
                <p className="text-sm text-gray-300 mb-3">วารสารวิชาการ:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• ตีพิมพ์งานวิจัย</li>
                  <li>• แลกเปลี่ยนความรู้</li>
                  <li>• สร้างคุณค่าสู่สังคม</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-3 text-green-400">🚀 Startup Ecosystem</h3>
                <p className="text-sm text-gray-300 mb-3">Company Ranking:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Startup → Sprouts → Pioneers</li>
                  <li>• 🦄 Unicorns (Top 10)</li>
                  <li>• Community Funding</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to Action for Non-Connected Users */}
          {!userAccount && (
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-sm rounded-3xl p-8 border border-green-500/30 mb-12 max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                🎯 พร้อมเริ่มต้นการเดินทางแล้วหรือยัง?
              </h2>
              <p className="text-lg text-gray-300 mb-6">
                เชื่อมต่อ MetaMask เพื่อเข้าสู่ Phase 1 และเริ่มสะสมคะแนนเพื่อก้าวสู่ระดับที่สูงขึ้น
              </p>
              <div className="flex justify-center items-center space-x-4 text-sm text-gray-400 mb-6">
                <span>⚠️ ตรวจสอบให้แน่ใจว่าคุณอยู่ใน BNB Testnet</span>
              </div>
              <button
                onClick={handleConnectClick}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl text-lg"
              >
                <span className="flex items-center justify-center space-x-3">
                  <span>🦊</span>
                  <span>เชื่อมต่อ MetaMask และเริ่มเล่น</span>
                </span>
              </button>
            </div>
          )}

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold mb-2 text-purple-300">คำถามหลากหลาย</h3>
              <p className="text-gray-300 text-sm">คำถามที่สร้างโดย AI ครอบคลุมหลากหลายหัวข้อ</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2 text-pink-300">รางวัล QZC</h3>
              <p className="text-gray-300 text-sm">ตอบถูกแล้วได้รับ QuizCoin ทันที</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-bold mb-2 text-blue-300">Merkle Tree</h3>
              <p className="text-gray-300 text-sm">ตรวจสอบความถูกต้องด้วยเทคโนโลยี Blockchain</p>
            </div>
          </div>

          {/* Game Mode Selection Modal */}
          {showModeSelection && userAccount && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 border border-white/20 max-w-md w-full shadow-2xl">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">เลือกโหมดเกม</h2>
                  <p className="text-green-400 font-mono text-sm break-all">
                    🔗 {userAccount.slice(0, 6)}...{userAccount.slice(-4)}
                  </p>
                </div>
                
                <div className="space-y-4 mb-6">
                  <button
                    onClick={() => handleModeSelect('solo')}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  >
                    <span className="flex items-center justify-center space-x-2">
                      <span>🎯</span>
                      <span>โหมด Solo</span>
                    </span>
                    <p className="text-xs mt-1 opacity-80">ตอบเร็วที่สุดได้รางวัล</p>
                  </button>
                  
                  <button
                    onClick={() => handleModeSelect('pool')}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  >
                    <span className="flex items-center justify-center space-x-2">
                      <span>👥</span>
                      <span>โหมด Pool</span>
                    </span>
                    <p className="text-xs mt-1 opacity-80">แบ่งรางวัลกันหลายคน</p>
                  </button>
                </div>
                
                <button
                  onClick={() => setShowModeSelection(false)}
                  className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-12 text-center">
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400 mb-6 max-w-4xl mx-auto">
              <div className="flex flex-col items-center space-y-1">
                <span>🎮 เกมและการเรียนรู้</span>
                <span className="text-xs">เริ่มต้นจากการเล่นเกม</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <span>🔬 วิจัยและนวัตกรรม</span>
                <span className="text-xs">สร้างองค์ความรู้ใหม่</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <span>🚀 ธุรกิจและการลงทุน</span>
                <span className="text-xs">พัฒนาสู่ธุรกิจจริง</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 inline-block">
              <p className="text-xs text-gray-500">
                🌐 Powered by BNB Smart Chain • 🎯 ระบบนิเวศครบวงจร • 💎 Built with ❤️ for Innovation
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;