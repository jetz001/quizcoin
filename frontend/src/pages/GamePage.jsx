import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { doc, updateDoc } from "firebase/firestore";

// ABI ที่ถูกต้องสำหรับ QuizGameModeFacet's submitAnswer
const quizGameModeAbi = [
  "function submitAnswer(uint256 questionId, bytes32 submittedAnswerHash) public",
];

// Address of the deployed QuizCoin smart contract (Diamond Proxy)
const QUIZ_CONTRACT_ADDRESS = "0x751f0C05fECF7adea4010e4538254E2Ce1e60a40";

const GamePage = ({ quizzes, onGoBack, db, userAccount }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // UseEffect hook to handle contract initialization
  useEffect(() => {
    let isMounted = true;
    let contractWithSigner = null;

    const initWeb3 = async () => {
      if (!window.ethereum) {
        setMessage("ไม่พบ Web3 provider โปรดติดตั้ง MetaMask");
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum, { name: "bnb testnet", chainId: 97 });
        await provider.ready;
        const signer = await provider.getSigner();

        // ใช้ ABI ที่ถูกต้องสำหรับ QuizGameModeFacet's submitAnswer function
        const tempContract = new ethers.Contract(QUIZ_CONTRACT_ADDRESS, quizGameModeAbi, provider);
        contractWithSigner = tempContract.connect(signer);

        if (isMounted) {
          setContract(contractWithSigner);
          console.log("Successfully connected to the QuizCoin smart contract.");
        }

      } catch (error) {
        console.error("Error initializing contract or provider:", error);
        setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อกับกระเป๋าเงิน กรุณาลองใหม่");
      }
    };
    
    initWeb3();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateQuizStatusInFirestore = async (quizId) => {
    try {
      const quizDocRef = doc(db, "questions", quizId);
      await updateDoc(quizDocRef, { isAnswered: true });
      console.log(`Firestore document for ${quizId} updated successfully.`);
    } catch (error) {
      console.error("Error updating Firestore document:", error);
    }
  };

  // Corrected handleSubmitAnswer to call the smart contract with correct arguments
  const handleSubmitAnswer = async (answer) => {
    if (!selectedQuiz || !contract || loading) {
      setMessage("ไม่พบกระเป๋าเงินที่ใช้งานอยู่ กรุณาลองล็อกอินใหม่อีกครั้ง");
      return;
    }
    
    setLoading(true);
    setMessage("กำลังส่งคำตอบไปยัง Smart Contract...");

    try {
      // 1. Convert quizId string to uint256
      const questionId = parseInt(selectedQuiz.quizId.replace('quiz', ''), 10);
      
      // 2. Hash the chosen answer string to bytes32, as required by QuizGameModeFacet
      const answerHash = ethers.keccak256(ethers.toUtf8Bytes(answer));
      
      // 3. Call the correct function on the contract with the correct arguments
      const tx = await contract.submitAnswer(questionId, answerHash);
      setMessage("Transaction sent. Waiting for confirmation...");
      
      await tx.wait();
      
      console.log("Answer submitted successfully! (Real transaction)");

      await updateQuizStatusInFirestore(selectedQuiz.quizId);
      
      // Manually update the answered quizzes list
      setAnsweredQuizzes(prev => [...prev, { quizId: selectedQuiz.quizId }]);

      setMessage("ตอบคำถามสำเร็จ! 🎉");
      setSelectedQuiz(null);

    } catch (error) {
      console.error("Error submitting answer to contract:", error);
      // Display a user-friendly error message
      if (error.reason) {
          setMessage(`Error: ${error.reason}`);
      } else {
          setMessage("เกิดข้อผิดพลาดในการส่งคำตอบไปยัง Smart Contract");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-inter">
      {/* Sidebar ซ้าย: กระเป๋าเงินและคำถามที่รอตอบ */}
      <div className="w-full md:w-1/4 bg-gray-800 p-6 rounded-lg shadow-lg m-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">กระเป๋าเงินของคุณ</h2>
        </div>
        <p className="text-gray-300 font-mono text-sm break-all mb-4">{userAccount}</p>
        <hr className="my-2 border-gray-600" />
        <h2 className="text-xl font-bold mb-4 mt-4">รอคำตอบ</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {quizzes.length > 0 ? (
            quizzes.map((quiz) => (
              <div
                key={quiz.quizId}
                onClick={() => setSelectedQuiz(quiz)}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  selectedQuiz?.quizId === quiz.quizId ? "bg-purple-700" : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <span className="font-mono text-sm">{quiz.quizId}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">
              <span className="text-pink-400 font-semibold">คำถามกำลังถูกสร้าง...</span> <br />
              คำถามใหม่จะถูกสร้างโดยอัตโนมัติทุก 3 นาที กรุณารอซักครู่
            </p>
          )}
        </div>
      </div>

      {/* Main Content ตรงกลาง: คำถามและตัวเลือก */}
      <div className="flex-1 bg-gray-800 p-6 rounded-lg shadow-lg m-4 flex flex-col items-center justify-center">
        {selectedQuiz ? (
          <div>
            <p className="text-lg mb-8 text-center">{selectedQuiz.question}</p>
            <div className="space-y-4 max-w-lg w-full mx-auto">
              {selectedQuiz.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmitAnswer(option)}
                  className="w-full p-4 bg-gray-700 rounded-md text-center hover:bg-purple-600 transition-colors duration-200 shadow-md disabled:opacity-50"
                  disabled={loading}
                >
                  {option}
                </button>
              ))}
            </div>
            {message && (
              <p className="mt-8 text-center text-sm text-yellow-400">
                {message}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <h3 className="text-2xl font-bold text-purple-400 mb-2">
              ยินดีต้อนรับสู่โหมด Solo
            </h3>
            <p className="text-gray-400">
              กรุณาเลือก ID คำถามที่ด้านซ้ายเพื่อเริ่มตอบ
            </p>
          </div>
        )}
      </div>

      {/* Sidebar ขวา: รายการคำถามที่ตอบแล้ว */}
      <div className="w-full md:w-1/4 bg-gray-800 p-6 rounded-lg shadow-lg m-4 flex flex-col relative">
        <button
          onClick={onGoBack}
          className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-colors z-10"
        >
          ออกจากระบบ
        </button>
        <h2 className="text-xl font-bold mb-4">คำถามที่ตอบแล้ว</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {answeredQuizzes.length > 0 ? (
            answeredQuizzes.map((quiz, index) => (
              <div
                key={index}
                className="p-3 rounded-md bg-green-700"
              >
                <span className="font-mono text-sm">{quiz.quizId}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">ส่วนนี้จะแสดงรายการคำถามที่ถูกตอบแล้ว</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamePage;
