// src/pages/GamePage-Organized.jsx - Game page for organized backend
import React, { useState, useEffect } from 'react';
import { useRandomQuiz, useSubmitAnswer } from '../hooks/useApi';

function GamePageOrganized({ userAccount, mode, onBackToHome, onBalanceUpdate }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);

  const { quiz, loading: quizLoading, error: quizError, fetchRandomQuiz } = useRandomQuiz();
  const { submitAnswer, loading: submitLoading, error: submitError, result } = useSubmitAnswer();

  // Load first question
  useEffect(() => {
    fetchRandomQuiz();
  }, [fetchRandomQuiz]);

  // Set current question when quiz loads
  useEffect(() => {
    if (quiz) {
      setCurrentQuestion(quiz);
      setSelectedAnswer('');
      setShowResult(false);
    }
  }, [quiz]);

  const handleAnswerSelect = (answer) => {
    if (!showResult) {
      setSelectedAnswer(answer);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    try {
      const response = await submitAnswer(currentQuestion.quizId, selectedAnswer, userAccount);
      
      setShowResult(true);
      setQuestionsAnswered(prev => prev + 1);
      
      if (response.isCorrect) {
        setScore(prev => prev + 1);
        // Update balance if reward is given
        if (response.reward) {
          onBalanceUpdate(prev => (parseFloat(prev) + parseFloat(response.reward)).toString());
        }
      }

      // Auto-advance to next question after 3 seconds
      setTimeout(() => {
        if (questionsAnswered < 9) { // Limit to 10 questions per game
          fetchRandomQuiz();
        } else {
          setGameEnded(true);
        }
      }, 3000);

    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  const handlePlayAgain = () => {
    setScore(0);
    setQuestionsAnswered(0);
    setGameEnded(false);
    fetchRandomQuiz();
  };

  // Loading state
  if (quizLoading && !currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Question...</h2>
          <p className="text-gray-300">Fetching from organized backend...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (quizError && !currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-12 border border-red-500/30">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Unable to Load Questions</h2>
          <p className="text-gray-300 mb-6">
            The organized backend might not have quiz questions yet.
          </p>
          <div className="space-y-4">
            <button
              onClick={fetchRandomQuiz}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors mr-4"
            >
              Try Again
            </button>
            <button
              onClick={onBackToHome}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game ended state
  if (gameEnded) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-12 border border-white/10">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-4">Game Complete!</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-2">{score}</div>
              <div className="text-gray-300">Correct Answers</div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-2">{questionsAnswered}</div>
              <div className="text-gray-300">Total Questions</div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-6">
              <div className="text-2xl font-bold text-yellow-400 mb-2">
                {Math.round((score / questionsAnswered) * 100)}%
              </div>
              <div className="text-gray-300">Accuracy</div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handlePlayAgain}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors mr-4"
            >
              Play Again
            </button>
            <button
              onClick={onBackToHome}
              className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mock question if no real question available
  const displayQuestion = currentQuestion || {
    quizId: 'demo-1',
    question: 'What is the main benefit of the organized backend architecture?',
    options: [
      'Better performance',
      'Clear separation of concerns',
      'Faster development',
      'All of the above'
    ],
    correctAnswer: 'All of the above'
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={onBackToHome}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          ← Back to Home
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'solo' ? '🎯 Solo Mode' : '🏆 Pool Mode'}
          </h2>
          <p className="text-gray-300">Question {questionsAnswered + 1} of 10</p>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-semibold text-white">Score: {score}</div>
          <div className="text-sm text-gray-300">
            {questionsAnswered > 0 && `${Math.round((score / questionsAnswered) * 100)}% accuracy`}
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/10 mb-8">
        <h3 className="text-2xl font-bold text-white mb-6 text-center">
          {displayQuestion.question}
        </h3>

        {/* Answer Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {displayQuestion.options?.map((option, index) => {
            let buttonClass = "p-4 rounded-lg border-2 transition-all duration-200 text-left";
            
            if (showResult) {
              if (option === displayQuestion.correctAnswer) {
                buttonClass += " bg-green-500/30 border-green-400 text-green-100";
              } else if (option === selectedAnswer && option !== displayQuestion.correctAnswer) {
                buttonClass += " bg-red-500/30 border-red-400 text-red-100";
              } else {
                buttonClass += " bg-gray-500/20 border-gray-500 text-gray-300";
              }
            } else {
              if (selectedAnswer === option) {
                buttonClass += " bg-blue-500/30 border-blue-400 text-blue-100";
              } else {
                buttonClass += " bg-white/5 border-gray-600 text-white hover:bg-white/10 hover:border-gray-400";
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={buttonClass}
                disabled={showResult}
              >
                <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Submit Button */}
        {!showResult && (
          <div className="text-center">
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || submitLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              {submitLoading ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        )}

        {/* Result Display */}
        {showResult && (
          <div className="text-center">
            <div className={`text-2xl font-bold mb-2 ${result?.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {result?.isCorrect ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            {result?.reward && (
              <div className="text-yellow-400 font-semibold">
                +{result.reward} QZC earned!
              </div>
            )}
            <div className="text-gray-300 mt-2">
              Next question in 3 seconds...
            </div>
          </div>
        )}

        {/* Error Display */}
        {submitError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
            <p className="text-red-300">Error: {submitError}</p>
          </div>
        )}
      </div>

      {/* Demo Notice */}
      {!currentQuestion && (
        <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/30 text-center">
          <p className="text-yellow-300">
            📝 This is a demo question. Add real questions to your organized backend to see them here!
          </p>
        </div>
      )}
    </div>
  );
}

export default GamePageOrganized;
