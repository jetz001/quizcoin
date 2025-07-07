require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config(); 
require("@openzeppelin/hardhat-upgrades");


const config = { 
    solidity: {
        compilers: [
            {
                version: "0.8.28", // กำหนดให้ใช้เวอร์ชัน 0.8.28
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200 // ค่านี้สามารถปรับได้ตามความเหมาะสม
                    },
                    // *** เพิ่มบรรทัดนี้เข้ามาครับ ***
                    viaIR: true // เปิดใช้งาน IR optimizer
                }
            }
        ]
    },
    
    networks: {
        hardhat: {
            chainId: 31337,
        },
        'bsc-testnet': {
      url: process.env.BSC_TESTNET_RPC,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY, // บัญชีแรก (deployer)
        process.env.PLAYER1_PRIVATE_KEY,  // บัญชีที่สอง (player1)
        process.env.PLAYER2_PRIVATE_KEY   // บัญชีที่สาม (player2)
        // ... เพิ่ม Private Key อื่นๆ ตามต้องการ
      ].filter(key => key !== undefined), // กรอง undefined ออก ถ้าบาง key ไม่มีใน .env
      chainId: 97,
      gasPrice: 0.1 * 1e9,
    },
    },

    etherscan: {
        apiKey: {
            bscTestnet: process.env.BSCSCAN_API_KEY || '',
        },
        
    },
};

module.exports = config;