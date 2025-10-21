import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';
import '@openzeppelin/hardhat-upgrades';

const config = { 
  solidity: { 
    compilers: [
      {
        version: "0.8.28", 
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true
        }
      }
    ]
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    ...(process.env.BSC_TESTNET_RPC && {
      'bsc-testnet': {
        url: process.env.BSC_TESTNET_RPC,
        accounts: [
          process.env.DEPLOYER_PRIVATE_KEY,
          process.env.PLAYER1_PRIVATE_KEY,
          process.env.PLAYER2_PRIVATE_KEY
        ].filter(Boolean),
        chainId: 97,
        gasPrice: 0.1 * 1e9,
      },
    }),
  },

  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
    },
  },
};

export default config;
