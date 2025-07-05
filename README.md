# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```
# quizcoin
Blockchain-based quiz reward system (Proof of Brain)
# QuizCoin

**QuizCoin** is a decentralized, blockchain-based quiz game where users earn tokens by answering science and math questions.

## 🎯 Concept
- New quiz every 3 minutes (1 block)
- Difficulty levels 1–100
- Rewards scale with difficulty
- Level 100 = 10,000 token reward
- Levels 1–99 follow halving model

## 💡 Features
- Burn token for hints
- On-chain answer validation
- Unlimited supply with control mechanisms
- Leaderboard and ranking system

## 📁 Structure
