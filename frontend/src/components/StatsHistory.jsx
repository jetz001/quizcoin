// src/components/StatsHistory.jsx
import React from 'react';

const StatsHistory = ({ 
  stats, 
  answeredQuizzes, 
  qzcBalance, 
  onRefreshBalance,
  onGoBack 
}) => {
  return (
    <div className="lg:col-span-1">
      {/* Stats Card */}
      <StatsCard 
        stats={stats} 
        qzcBalance={qzcBalance}
        onRefreshBalance={onRefreshBalance}
      />
      
      {/* History Card */}
      <HistoryCard answeredQuizzes={answeredQuizzes} />
      
      {/* Back Button */}
      <BackButton onGoBack={onGoBack} />
    </div>
  );
};

const StatsCard = ({ stats, qzcBalance, onRefreshBalance }) => (
  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold">สถิติของคุณ</h2>
      <button
        onClick={onRefreshBalance}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        🔄 อัพเดท
      </button>
    </div>
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-300">ยอดคงเหลือ:</span>
        <span className="font-bold text-green-400 animate-count-up">{qzcBalance} QZC</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-300">ตอบแล้ว:</span>
        <span className="font-bold text-blue-400 animate-count-up">{stats.totalAnswered}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-300">QZC รวม:</span>
        <span className="font-bold text-green-400 animate-count-up">{stats.totalEarned}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-300">Streak:</span>
        <span className="font-bold text-orange-400">
          {stats.streak} {stats.streak > 0 && <span className="animate-pulse">🔥</span>}
        </span>
      </div>
    </div>
  </div>
);

const HistoryCard = ({ answeredQuizzes }) => (
  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
    <h2 className="text-xl font-bold mb-4">ประวัติการตอบ</h2>
    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {answeredQuizzes.length > 0 ? (
        answeredQuizzes.slice(-10).reverse().map((quiz, index) => (
          <HistoryItem key={index} quiz={quiz} />
        ))
      ) : (
        <p className="text-gray-400 text-sm text-center py-4">
          ยังไม่มีประวัติการตอบ
        </p>
      )}
    </div>
  </div>
);

const HistoryItem = ({ quiz }) => (
  <div className="p-3 bg-green-600/20 rounded-lg border border-green-600/30 animate-fade-in">
    <div className="flex justify-between items-center">
      <span className="font-mono text-sm text-green-300">
        {quiz.quizId.length > 12 ? `${quiz.quizId.substring(0, 9)}...` : quiz.quizId}
      </span>
      <div className="flex items-center space-x-1">
        <span className="text-xs text-green-400">✅</span>
        {quiz.txHash && (
          <a
            href={`https://testnet.bscscan.com/tx/${quiz.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
            title="ดูธุรกรรมใน BSCScan"
          >
            🔗
          </a>
        )}
      </div>
    </div>
    <div className="text-xs text-gray-300 mt-1">
      {quiz.mode === 'solo' ? '🎯 Solo' : '👥 Pool'} • 
      +{quiz.earnedAmount || 0} QZC • 
      {new Date(quiz.answeredAt).toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}
    </div>
  </div>
);

const BackButton = ({ onGoBack }) => (
  <button
    onClick={onGoBack}
    className="w-full mt-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 btn-glow"
  >
    🏠 กลับหน้าแรก
  </button>
);

export default StatsHistory;