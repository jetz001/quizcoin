import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

// ABI for the QuizGameDiamond contract.
import QuizGameDiamondABI_base from "../abi/QuizGameDiamond.json";
import contractAddresses from '../config/addresses.json';

// Combined ABI with necessary functions.
const combinedQuizDiamondABI = [
  ...QuizGameDiamondABI_base.abi,
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_quizId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "_submittedAnswerHash",
        "type": "bytes32"
      }
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const GamePage = ({ quizzes, onGoBack, userAccount }) => {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [answeredQuizzes, setAnsweredQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [quizDiamondContract, setQuizDiamondContract] = useState(null);

  // useEffect to initialize the contract instance
  useEffect(() => {
    const setupContract = async () => {
      if (!window.ethereum) {
        setMessage("ไม่พบ MetaMask กรุณาติดตั้งหรือเปิดใช้งาน");
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const quizGameDiamondAddress = contractAddresses.QuizGameDiamond;
        
        const contractInstance = new ethers.Contract(quizGameDiamondAddress, combinedQuizDiamondABI, provider);
        setQuizDiamondContract(contractInstance);
      } catch (error) {
        console.error("Error setting up contract:", error);
        setMessage("เกิดข้อผิดพลาดในการตั้งค่าสัญญา");
      }
    };
    setupContract();
  }, []);

  // useEffect to fetch answered quizzes from the server
  useEffect(() => {
    const fetchAnsweredQuizzes = async () => {
      try {
        const response = await fetch('/api/get-answered-quizzes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userAccount }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch answered quizzes from server.");
        }
        
        const data = await response.json();
        setAnsweredQuizzes(data.answeredQuizzes || []);
      } catch (error) {
        console.error("Error fetching answered quizzes:", error);
        setMessage("เกิดข้อผิดพลาดในการดึงข้อมูลคำถามที่ตอบแล้วจากเซิร์ฟเวอร์ กรุณาลองใหม่ในภายหลัง");
      }
    };
    fetchAnsweredQuizzes();
  }, [userAccount]);

  /**
    * Sends the user's answer to the blockchain after confirming it's correct off-chain.
    * @param {string} quizIdString Quiz ID as a string, e.g., "quiz12345"
    * @param {string} selectedOption The selected answer option
    * @returns {Promise<boolean>} True if the transaction is successful, False otherwise.
    */
  const submitAnswerOnChain = async (quizIdString, selectedOption) => {
    try {
      const quizIdNumeric = parseInt(quizIdString.replace("quiz", ""), 10);
      
      const submittedAnswerHash = ethers.keccak256(ethers.toUtf8Bytes(selectedOption));

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const quizContract = quizDiamondContract.connect(signer);

      setMessage("โปรดยืนยันการทำธุรกรรมเพื่อส่งคำตอบใน MetaMask...");
      
      const tx = await quizContract.submitAnswer(quizIdNumeric, submittedAnswerHash);
      console.log("Submit answer transaction sent:", tx.hash);
      
      await tx.wait();
      console.log("Submit answer transaction confirmed.");
      setMessage("คำตอบถูกส่งสำเร็จ! 🎉 กำลังบันทึกการชนะของคุณบนบล็อกเชน...");
      return true;
    } catch (error) {
      if (error.code === 4001) {
        setMessage("ผู้ใช้ปฏิเสธการทำธุรกรรมใน MetaMask");
      } else {
        setMessage(`เกิดข้อผิดพลาดในการทำธุรกรรม: ${error.message}`);
      }
      console.error("Blockchain transaction error:", error);
      return false;
    }
  };

  const handleSubmitAnswer = async (selectedOption) => {
    if (!selectedQuiz || loading) {
      setMessage("กำลังดำเนินการ โปรดรอสักครู่");
      return;
    }
    
    setLoading(true);
    setMessage("กำลังตรวจสอบคำตอบ...");

    // Find the correct answer from the loaded quizzes
    const quizData = quizzes.find(q => q.quizId === selectedQuiz.quizId);
    
    if (quizData && quizData.options && quizData.options[quizData.answerIndex] === selectedOption) {
      setMessage("คำตอบถูกต้อง! กำลังส่งไปที่บล็อกเชน...");
      
      const transactionSuccess = await submitAnswerOnChain(selectedQuiz.quizId, selectedOption);
      
      if (transactionSuccess) {
        setAnsweredQuizzes(prev => [...prev, { quizId: selectedQuiz.quizId }]);
        setSelectedQuiz(null);
      }
    } else {
      setMessage("คำตอบผิด! ลองใหม่นะครับ");
    }

    setLoading(false);
  };

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setMessage("");
  };
  
  const availableQuizzes = quizzes.filter(quiz => 
    !answeredQuizzes.some(answered => answered.quizId === quiz.quizId)
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-inter">
      {/* Sidebar ซ้าย: กระเป๋าเงินและควิซที่รอคำตอบ */}
      <div className="w-full md:w-1/4 bg-gray-800 p-6 rounded-lg shadow-lg m-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">กระเป๋าเงินของคุณ</h2>
        </div>
        <p className="text-gray-300 font-mono text-sm break-all mb-4">{userAccount}</p>
        <hr className="my-2 border-gray-600" />
        <h2 className="text-xl font-bold mb-4 mt-4">รอคำตอบ</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableQuizzes.length > 0 ? (
            availableQuizzes.map((quiz) => (
              <div
                key={quiz.quizId}
                onClick={() => handleSelectQuiz(quiz)}
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

      {/* เนื้อหาหลัก: คำถามและตัวเลือก */}
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
