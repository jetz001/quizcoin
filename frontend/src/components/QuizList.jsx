// src/components/QuizList.jsx
import React from 'react';

const QuizList = ({ quizzes, selectedQuiz, onSelectQuiz, answeredQuizzes }) => {
  // Filter available quizzes (exclude already answered)
  const availableQuizzes = quizzes.filter(quiz => 
    !answeredQuizzes.some(answered => answered.quizId === quiz.quizId)
  );

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 custom-scrollbar">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">คำถามรอตอบ</h2>
        <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm">
          {availableQuizzes.length}
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
        {availableQuizzes.length > 0 ? (
          availableQuizzes.map((quiz) => (
            <QuizItem 
              key={quiz.quizId}
              quiz={quiz}
              isSelected={selectedQuiz?.quizId === quiz.quizId}
              onSelect={() => onSelectQuiz(quiz)}
            />
          ))
        ) : (
          <EmptyQuizState />
        )}
      </div>
    </div>
  );
};

const QuizItem = ({ quiz, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border card-hover ${
        isSelected 
          ? "bg-purple-600/30 border-purple-400" 
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-sm text-purple-300">
          {quiz.quizId.length > 15 ? `${quiz.quizId.substring(0, 12)}...` : quiz.quizId}
        </span>
        <div className="flex items-center space-x-1">
          <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
            LV.{quiz.difficulty || Math.floor(Math.random() * 100) + 1}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-300 line-clamp-2">
        {quiz.question?.substring(0, 80)}
        {quiz.question?.length > 80 ? "..." : ""}
      </p>
      <div className="mt-2 text-xs text-green-400">
        💰 ~{Math.floor((quiz.difficulty || 50) * 2 + 50)} QZC
      </div>
    </div>
  );
};

const EmptyQuizState = () => (
  <div className="text-center py-8">
    <div className="text-4xl mb-2 animate-bounce">⏳</div>
    <p className="text-gray-400 text-sm">ไม่มีคำถามใหม่</p>
    <p className="text-xs text-purple-400 mt-2">กรุณารอสักครู่</p>
  </div>
);

export default QuizList;