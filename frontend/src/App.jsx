    import React, { useState, useEffect } from 'react';
    import { ethers } from 'ethers';

    // นำเข้า ABI และที่อยู่สัญญาจากไฟล์ config ใหม่
    import {
      QUIZ_GAME_MODE_ABI,
      QUIZ_GAME_BASE_ABI,
      QUIZ_GAME_REWARD_ABI,
      QUIZ_COIN_ABI,
      ACCESS_CONTROL_ABI
    } from './config/abi';
    import { DIAMOND_ADDRESS, QuestionMode, QuestionCategory } from './config/addresses';

    function App() {
      const [provider, setProvider] = useState(null);
      const [signer, setSigner] = useState(null);
      const [account, setAccount] = useState(null);
      const [network, setNetwork] = useState(null);
      const [quizModeContract, setQuizModeContract] = useState(null);
      const [quizBaseContract, setQuizBaseContract] = useState(null);
      const [quizRewardContract, setQuizRewardContract] = useState(null);
      const [quizCoinContract, setQuizCoinContract] = useState(null);
      const [accessControlContract, setAccessControlContract] = useState(null);
      const [balance, setBalance] = useState('0');
      const [message, setMessage] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);
      const [isAdmin, setIsAdmin] = useState(false);

      // State สำหรับการสร้างคำถาม
      const [newQuestionCorrectAnswer, setNewQuestionCorrectAnswer] = useState('');
      const [newQuestionHint, setNewQuestionHint] = useState('');
      const [newQuestionDifficulty, setNewQuestionDifficulty] = useState('');
      const [newQuestionMode, setNewQuestionMode] = useState(QuestionMode.Solo);
      const [newQuestionCategory, setNewQuestionCategory] = useState(QuestionCategory.General);

      // State สำหรับการตอบคำถาม
      const [answerQuestionId, setAnswerQuestionId] = useState('');
      const [submittedAnswer, setSubmittedAnswer] = useState('');

      // State สำหรับการแจกจ่ายรางวัล
      const [distributeQuestionId, setDistributeQuestionId] = useState('');

      // State สำหรับการดูคำถาม
      const [fetchQuestionId, setFetchQuestionId] = useState('');
      const [fetchedQuestion, setFetchedQuestion] = useState(null);

      useEffect(() => {
        const connectWallet = async () => {
          if (typeof window.ethereum !== 'undefined') {
            try {
              const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
              const currentAccount = accounts[0];
              setAccount(currentAccount);

              const newProvider = new ethers.BrowserProvider(window.ethereum);
              setProvider(newProvider);
              const newSigner = await newProvider.getSigner();
              setSigner(newSigner);

              const currentNetwork = await newProvider.getNetwork();
              setNetwork(currentNetwork.name);

              // สร้าง Contract instances ที่เชื่อมต่อกับ Diamond Proxy
              const modeContract = new ethers.Contract(DIAMOND_ADDRESS, QUIZ_GAME_MODE_ABI, newSigner);
              setQuizModeContract(modeContract);

              const baseContract = new ethers.Contract(DIAMOND_ADDRESS, QUIZ_GAME_BASE_ABI, newSigner);
              setQuizBaseContract(baseContract);

              const rewardContract = new ethers.Contract(DIAMOND_ADDRESS, QUIZ_GAME_REWARD_ABI, newSigner);
              setQuizRewardContract(rewardContract);

              // สร้าง instance ของ AccessControlUpgradeable เพื่อตรวจสอบ Role
              const accessControl = new ethers.Contract(DIAMOND_ADDRESS, ACCESS_CONTROL_ABI, newSigner);
              setAccessControlContract(accessControl);

              setMessage('Wallet connected successfully!');
              setError('');

              // อัปเดตยอดคงเหลือและตรวจสอบ Role
              await updateBalanceAndRoles(currentAccount, baseContract, accessControl, newProvider);

            } catch (err) {
              console.error("Failed to connect wallet:", err);
              setError(`Failed to connect wallet: ${err.message || err}`);
            }
          } else {
            setError("MetaMask is not installed. Please install it to use this DApp.");
          }
        };

        const updateBalanceAndRoles = async (currentAccount, baseContract, accessControl, currentProvider) => {
            if (!currentAccount || !baseContract || !accessControl || !currentProvider) return;

            try {
                // อัปเดตยอดคงเหลือ QuizCoin
                const coinAddress = await baseContract.getQuizCoinAddress();
                if (coinAddress && coinAddress !== ethers.ZeroAddress) {
                    const quizCoinInstance = new ethers.Contract(coinAddress, QUIZ_COIN_ABI, currentProvider);
                    setQuizCoinContract(quizCoinInstance); // ตั้งค่า quizCoinContract ที่นี่
                    const bal = await quizCoinInstance.balanceOf(currentAccount);
                    setBalance(ethers.formatUnits(bal, 18));
                } else {
                    setBalance('0');
                    setQuizCoinContract(null); // Clear if address is not set
                }

                // ตรวจสอบ Admin Role
                const adminRole = await baseContract.DEFAULT_ADMIN_ROLE();
                const hasAdminRole = await accessControl.hasRole(adminRole, currentAccount);
                setIsAdmin(hasAdminRole);

            } catch (err) {
                console.error("Failed to fetch balance or roles:", err);
                setError(`Failed to fetch balance or roles: ${err.message || err}`);
            }
        };


        connectWallet();

        if (window.ethereum) {
          window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
              // Reconnect to update signer, contracts, balance, and roles
              connectWallet();
            } else {
              setAccount(null);
              setSigner(null);
              setProvider(null);
              setQuizModeContract(null);
              setQuizBaseContract(null);
              setQuizRewardContract(null);
              setQuizCoinContract(null);
              setAccessControlContract(null);
              setIsAdmin(false);
              setMessage('Wallet disconnected.');
              setBalance('0');
            }
          });

          window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
          });
        }

        return () => {
          if (window.ethereum) {
            window.ethereum.removeListener('accountsChanged', () => {});
            window.ethereum.removeListener('chainChanged', () => {});
          }
        };
      }, []);

      const updateBalance = async () => {
        if (account && quizCoinContract && provider) {
          try {
            const bal = await quizCoinContract.balanceOf(account);
            setBalance(ethers.formatUnits(bal, 18));
          } catch (err) {
            console.error("Failed to fetch balance:", err);
            setError(`Failed to fetch balance: ${err.message || err}`);
          }
        }
      };

      useEffect(() => {
        updateBalance();
      }, [account, quizCoinContract]);

      const hashString = (str) => {
        return ethers.keccak256(ethers.toUtf8Bytes(str));
      };

      const handleCreateQuestion = async (e) => {
        e.preventDefault();
        if (!quizModeContract || !signer) {
          setError("Please connect your wallet and ensure contracts are loaded.");
          return;
        }
        if (!isAdmin) {
          setError("You must be an admin to create questions.");
          return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        try {
          const correctAnswerHash = hashString(newQuestionCorrectAnswer);
          const hintHash = hashString(newQuestionHint);
          const difficulty = parseInt(newQuestionDifficulty);

          if (isNaN(difficulty) || difficulty < 1 || difficulty > 100) {
            throw new Error("Difficulty level must be between 1 and 100.");
          }

          const tx = await quizModeContract.createQuestion(
            correctAnswerHash,
            hintHash,
            difficulty,
            newQuestionMode,
            newQuestionCategory
          );
          await tx.wait();
          setMessage(`Question created! Transaction hash: ${tx.hash}`);
          setNewQuestionCorrectAnswer('');
          setNewQuestionHint('');
          setNewQuestionDifficulty('');
        } catch (err) {
          console.error("Error creating question:", err);
          setError(`Error creating question: ${err.message || err.reason || err}`);
        } finally {
          setLoading(false);
        }
      };

      const handleSubmitAnswer = async (e) => {
        e.preventDefault();
        if (!quizModeContract || !signer) {
          setError("Please connect your wallet and ensure contracts are loaded.");
          return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        try {
          const submittedHash = hashString(submittedAnswer);
          const tx = await quizModeContract.connect(signer).submitAnswer(answerQuestionId, submittedHash);
          await tx.wait();
          setMessage(`Answer submitted! Transaction hash: ${tx.hash}`);
          setAnswerQuestionId('');
          setSubmittedAnswer('');
          updateBalance();
        } catch (err) {
          console.error("Error submitting answer:", err);
          setError(`Error submitting answer: ${err.message || err.reason || err}`);
        } finally {
          setLoading(false);
        }
      };

      const handleDistributeRewards = async (e) => {
        e.preventDefault();
        if (!quizRewardContract || !signer) {
          setError("Please connect your wallet and ensure contracts are loaded.");
          return;
        }
        if (!isAdmin) {
          setError("You must be an admin to distribute rewards.");
          return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        try {
          const tx = await quizRewardContract.connect(signer).distributeRewards(distributeQuestionId);
          await tx.wait();
          setMessage(`Rewards distributed for question ID ${distributeQuestionId}! Transaction hash: ${tx.hash}`);
          setDistributeQuestionId('');
          updateBalance();
        } catch (err) {
          console.error("Error distributing rewards:", err);
          setError(`Error distributing rewards: ${err.message || err.reason || err}`);
        } finally {
          setLoading(false);
        }
      };

      const handleFetchQuestion = async (e) => {
        e.preventDefault();
        if (!quizBaseContract || !provider) {
          setError("Please connect your wallet and ensure contracts are loaded.");
          return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        setFetchedQuestion(null);
        try {
          const questionData = await quizBaseContract.getQuestion(fetchQuestionId);
          setFetchedQuestion({
            correctAnswerHash: questionData.correctAnswerHash,
            hintHash: questionData.hintHash,
            questionCreator: questionData.questionCreator,
            difficultyLevel: questionData.difficultyLevel.toString(),
            baseRewardAmount: ethers.formatUnits(questionData.baseRewardAmount, 18),
            isClosed: questionData.isClosed,
            mode: Object.keys(QuestionMode).find(key => QuestionMode[key] === questionData.mode),
            category: Object.keys(QuestionCategory).find(key => QuestionCategory[key] === questionData.category),
            blockCreationTime: new Date(Number(questionData.blockCreationTime) * 1000).toLocaleString(),
            firstCorrectAnswerTime: questionData.firstCorrectAnswerTime > 0 ? new Date(Number(questionData.firstCorrectAnswerTime) * 1000).toLocaleString() : 'N/A',
            firstSolverAddress: questionData.firstSolverAddress !== ethers.ZeroAddress ? questionData.firstSolverAddress : 'N/A',
            poolCorrectSolvers: questionData.poolCorrectSolvers.length > 0 ? questionData.poolCorrectSolvers.join(', ') : 'None'
          });
          setMessage(`Fetched data for Question ID: ${fetchQuestionId}`);
        } catch (err) {
          console.error("Error fetching question:", err);
          setError(`Error fetching question: ${err.message || err.reason || err}`);
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-800 to-indigo-900 text-white p-6 font-inter">
          <header className="text-center mb-10">
            <h1 className="text-5xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
              QuizCoin DApp
            </h1>
            <p className="text-lg text-gray-300">Interact with your Smart Contract Diamond</p>
          </header>

          <div className="max-w-4xl mx-auto bg-gray-800 bg-opacity-70 rounded-2xl shadow-2xl p-8 space-y-8 border border-purple-600">
            {/* Wallet Connection Status */}
            <section className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-300">Wallet Status</h2>
              <p className="text-lg">
                <span className="font-semibold">Account:</span> {account ? account : 'Not connected'}
              </p>
              <p className="text-lg">
                <span className="font-semibold">Network:</span> {network ? network : 'N/A'}
              </p>
              <p className="text-lg">
                <span className="font-semibold">QuizCoin Balance:</span> {balance} QC
              </p>
              <p className="text-lg">
                <span className="font-semibold">Admin Role:</span> {isAdmin ? 'Yes' : 'No'}
              </p>
              {error && <p className="text-red-400 mt-2">{error}</p>}
              {message && <p className="text-green-400 mt-2">{message}</p>}
            </section>

            {/* Create Question Form (แสดงเฉพาะ Admin) */}
            {isAdmin && (
              <section className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
                <h2 className="text-2xl font-bold mb-4 text-purple-300">Create New Question</h2>
                <form onSubmit={handleCreateQuestion} className="space-y-4">
                  <div>
                    <label htmlFor="correctAnswer" className="block text-gray-300 text-sm font-bold mb-2">
                      Correct Answer:
                    </label>
                    <input
                      type="text"
                      id="correctAnswer"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={newQuestionCorrectAnswer}
                      onChange={(e) => setNewQuestionCorrectAnswer(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="hint" className="block text-gray-300 text-sm font-bold mb-2">
                      Hint:
                    </label>
                    <input
                      type="text"
                      id="hint"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={newQuestionHint}
                      onChange={(e) => setNewQuestionHint(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="difficulty" className="block text-gray-300 text-sm font-bold mb-2">
                      Difficulty Level (1-100):
                    </label>
                    <input
                      type="number"
                      id="difficulty"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={newQuestionDifficulty}
                      onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                      min="1"
                      max="100"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="mode" className="block text-gray-300 text-sm font-bold mb-2">
                      Mode:
                    </label>
                    <select
                      id="mode"
                      className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={newQuestionMode}
                      onChange={(e) => setNewQuestionMode(parseInt(e.target.value))}
                    >
                      {Object.entries(QuestionMode).map(([key, value]) => (
                        <option key={key} value={value}>{key}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-gray-300 text-sm font-bold mb-2">
                      Category:
                    </label>
                    <select
                      id="category"
                      className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={newQuestionCategory}
                      onChange={(e) => setNewQuestionCategory(parseInt(e.target.value))}
                    >
                      {Object.entries(QuestionCategory).map(([key, value]) => (
                        <option key={key} value={value}>{key}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Question'}
                  </button>
                </form>
              </section>
            )}

            {/* Submit Answer Form */}
            <section className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-300">Submit Answer</h2>
              <form onSubmit={handleSubmitAnswer} className="space-y-4">
                <div>
                  <label htmlFor="answerQuestionId" className="block text-gray-300 text-sm font-bold mb-2">
                    Question ID:
                  </label>
                  <input
                    type="number"
                    id="answerQuestionId"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                    value={answerQuestionId}
                    onChange={(e) => setAnswerQuestionId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="submittedAnswer" className="block text-gray-300 text-sm font-bold mb-2">
                    Your Answer:
                  </label>
                  <input
                    type="text"
                    id="submittedAnswer"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                    value={submittedAnswer}
                    onChange={(e) => setSubmittedAnswer(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Answer'}
                </button>
              </form>
            </section>

            {/* Distribute Rewards Form (แสดงเฉพาะ Admin) */}
            {isAdmin && (
              <section className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
                <h2 className="text-2xl font-bold mb-4 text-purple-300">Distribute Pool Rewards (Admin)</h2>
                <form onSubmit={handleDistributeRewards} className="space-y-4">
                  <div>
                    <label htmlFor="distributeQuestionId" className="block text-gray-300 text-sm font-bold mb-2">
                      Question ID:
                    </label>
                    <input
                      type="number"
                      id="distributeQuestionId"
                      className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                      value={distributeQuestionId}
                      onChange={(e) => setDistributeQuestionId(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Distributing...' : 'Distribute Rewards'}
                  </button>
                </form>
              </section>
            )}

            {/* Fetch Question Details */}
            <section className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-300">Fetch Question Details</h2>
              <form onSubmit={handleFetchQuestion} className="space-y-4">
                <div>
                  <label htmlFor="fetchQuestionId" className="block text-gray-300 text-sm font-bold mb-2">
                    Question ID:
                  </label>
                  <input
                    type="number"
                    id="fetchQuestionId"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 border-gray-500"
                    value={fetchQuestionId}
                    onChange={(e) => setFetchQuestionId(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Fetching...' : 'Fetch Question'}
                </button>
              </form>

              {fetchedQuestion && (
                <div className="mt-6 p-4 bg-gray-600 bg-opacity-50 rounded-lg border border-gray-500">
                  <h3 className="text-xl font-semibold mb-2 text-blue-300">Question Details:</h3>
                  <p><strong>Correct Answer Hash:</strong> {fetchedQuestion.correctAnswerHash}</p>
                  <p><strong>Hint Hash:</strong> {fetchedQuestion.hintHash}</p>
                  <p><strong>Creator:</strong> {fetchedQuestion.questionCreator}</p>
                  <p><strong>Difficulty:</strong> {fetchedQuestion.difficultyLevel}</p>
                  <p><strong>Base Reward:</strong> {fetchedQuestion.baseRewardAmount} QC</p>
                  <p><strong>Is Closed:</strong> {fetchedQuestion.isClosed ? 'Yes' : 'No'}</p>
                  <p><strong>Mode:</strong> {fetchedQuestion.mode}</p>
                  <p><strong>Category:</strong> {fetchedQuestion.category}</p>
                  <p><strong>Creation Time:</strong> {fetchedQuestion.blockCreationTime}</p>
                  <p><strong>First Answer Time:</strong> {fetchedQuestion.firstCorrectAnswerTime}</p>
                  <p><strong>First Solver:</strong> {fetchedQuestion.firstSolverAddress}</p>
                  <p><strong>Pool Solvers:</strong> {fetchedQuestion.poolCorrectSolvers}</p>
                </div>
              )}
            </section>
          </div>
        </div>
      );
    }

    export default App;
    