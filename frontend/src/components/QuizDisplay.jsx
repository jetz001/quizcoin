// src/components/QuizDisplay.jsx
import React from 'react';

const QuizDisplay = ({ 
  selectedQuiz, 
  rewardAmount, 
  loading, 
  message, 
  onSubmitAnswer 
}) => {
  if (!selectedQuiz) {
    return <EmptyQuizDisplay />;
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 min-h-96">
      <div className="text-center">
        <QuizHeader 
          selectedQuiz={selectedQuiz} 
          rewardAmount={rewardAmount} 
        />
        
        <QuizOptions 
          options={selectedQuiz.options}
          loading={loading}
          onSubmitAnswer={onSubmitAnswer}
        />

        <QuizMessage 
          message={message}
          loading={loading}
        />
      </div>
    </div>
  );
};

const QuizHeader = ({ selectedQuiz, rewardAmount }) => (
  <div className="mb-6">
    <div className="inline-flex items-center space-x-2 bg-purple-600/20 px-4 py-2 rounded-full mb-4">
      <span className="text-purple-300 font-mono text-sm">
        {selectedQuiz.quizId.length > 20 ? `${selectedQuiz.quizId.substring(0, 17)}...` : selectedQuiz.quizId}
      </span>
      <span className="text-gray-400">•</span>
      <span className="text-blue-300 text-sm">
        Level {selectedQuiz.difficulty || Math.floor(Math.random() * 100) + 1}
      </span>
    </div>
    <h3 className="text-2xl font-bold mb-2 leading-tight">
      {selectedQuiz.question}
    </h3>
    <p className="text-green-400 text-sm animate-pulse">
      💰 รางวัล: {rewardAmount} QZC
    </p>
    <p className="text-yellow-400 text-xs mt-1">
      🦊 จะใช้ MetaMask ในการบันทึกคำตอบ
    </p>
  </div>
);

const QuizOptions = ({ options, loading, onSubmitAnswer }) => (
  <div className="space-y-4 max-w-lg mx-auto">
    {options?.map((option, index) => (
      <button
        key={index}
        onClick={() => onSubmitAnswer(option)}
        disabled={loading}
        className="w-full p-4 bg-white/10 hover:bg-purple-600/30 rounded-xl text-left transition-all duration-300 border border-white/20 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] interactive"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600/50 rounded-full flex items-center justify-center text-sm font-bold">
            {String.fromCharCode(65 + index)}
          </div>
          <span className="flex-1 text-left">{option}</span>
        </div>
      </button>
    ))}
  </div>
);

const QuizMessage = ({ message, loading }) => {
  if (!message) return null;

  return (
    <div className={`mt-6 p-4 rounded-xl border transition-all duration-500 ${
      message.includes('🎉') 
        ? 'bg-green-600/20 border-green-600/30 animate-bounce-in' 
        : message.includes('❌') 
        ? 'bg-red-600/20 border-red-600/30 animate-shake'
        : 'bg-white/10 border-white/20'
    }`}>
      <p className="text-sm text-center">{message}</p>
      {loading && (
        <div className="mt-3 w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full animate-progress"></div>
        </div>
      )}
    </div>
  );
};

const EmptyQuizDisplay = () => (
  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 min-h-96">
    <div className="text-center py-12">
      <div className="text-6xl mb-4 animate-float">🎯</div>
      <h3 className="text-2xl font-bold text-purple-400 mb-2">
        เลือกคำถามเพื่อเริ่มเล่น
      </h3>
      <p className="text-gray-400 mb-6">
        คลิกเลือกคำถามจากด้านซ้ายเพื่อเริ่มทำแบบทดสอบ
      </p>
      <div className="text-sm text-purple-300 animate-pulse">
        💡 ตอบถูกได้ QZC ทันทีผ่าน MetaMask!
      </div>
    </div>
  </div>
);

export default QuizDisplay;