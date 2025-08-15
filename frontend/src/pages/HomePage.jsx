import React from "react";

const HomePage = ({ connectWallet, userAccount, disconnectWallet }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-inter">
      <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <h1 className="text-4xl md:text-6xl font-extrabold text-purple-400 mb-4 animate-fade-in">
          QuizCoin
        </h1>
        <p className="text-lg text-gray-300 mb-8 animate-slide-up">
          ท้าทายความรู้ของคุณและรับรางวัลในโลก Web3
        </p>
        <div className="flex flex-col items-center space-y-4">
          {userAccount ? (
            <>
              <p className="text-sm md:text-base font-mono text-green-400 break-all animate-fade-in-late">
                เชื่อมต่อแล้ว: {userAccount}
              </p>
              <button
                onClick={() => { /* This button now routes to the game page */ }}
                className="bg-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-105"
              >
                เข้าสู่โหมด Solo
              </button>
              <button
                onClick={disconnectWallet}
                className="bg-red-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-red-700 transition-transform transform hover:scale-105"
              >
                เปลี่ยนบัญชี
              </button>
            </>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-green-700 transition-transform transform hover:scale-105"
            >
              เชื่อมต่อ MetaMask
            </button>
          )}
        </div>
        <p className="text-gray-500 text-xs mt-8">
          โปรดตรวจสอบให้แน่ใจว่าคุณอยู่ใน BNB Testnet
        </p>
      </div>
    </div>
  );
};

export default HomePage;
