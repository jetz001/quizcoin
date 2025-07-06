require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config(); 



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
            accounts: process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
            chainId: 97,
            gasPrice: 10 * 1e9,
        },
    },

    etherscan: {
        apiKey: {
            bscTestnet: process.env.BSCSCAN_API_KEY || '',
        },
        
    },
};

module.exports = config;