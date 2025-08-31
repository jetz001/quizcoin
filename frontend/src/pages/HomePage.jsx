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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white relative overflow-hidden">
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
              🎯 ท้าทายความรู้ของคุณและรับรางวัล QZC ในโลก Web3
            </p>
          </div>

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

          {/* Wallet Connection */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 max-w-md mx-auto">
            {!userAccount ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">เริ่มเล่นเลย!</h2>
                  <p className="text-gray-300 text-sm mb-6">เชื่อมต่อ MetaMask เพื่อเข้าสู่เกม</p>
                </div>
                <button
                  onClick={handleConnectClick}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <span>🦊</span>
                    <span>เชื่อมต่อ MetaMask</span>
                  </span>
                </button>
                <p className="text-gray-500 text-xs">
                  ⚠️ โปรดตรวจสอบให้แน่ใจว่าคุณอยู่ใน BNB Testnet
                </p>
              </div>
            ) : showModeSelection ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">เลือกโหมดเกม</h2>
                  <p className="text-green-400 font-mono text-sm break-all mb-6">
                    🔗 {userAccount.slice(0, 6)}...{userAccount.slice(-4)}
                  </p>
                </div>
                
                <div className="space-y-4">
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
                  onClick={disconnectWallet}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  เปลี่ยนบัญชี
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">เชื่อมต่อแล้ว</h2>
                  <p className="text-green-400 font-mono text-sm break-all mb-6">
                    🔗 {userAccount}
                  </p>
                </div>
                <button
                  onClick={() => setShowModeSelection(true)}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  เลือกโหมดเกม
                </button>
                <button
                  onClick={disconnectWallet}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  เปลี่ยนบัญชี
                </button>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="mt-12 text-center">
            <div className="flex justify-center space-x-8 text-sm text-gray-400 mb-4">
              <span>🔗 Blockchain-based</span>
              <span>⚡ Instant Rewards</span>
              <span>🛡️ Secure & Fair</span>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 inline-block">
              <p className="text-xs text-gray-500">
                Powered by BNB Smart Chain • Built with ❤️ for Web3 Community
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;