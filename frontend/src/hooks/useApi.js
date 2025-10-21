// src/hooks/useApi.js - React hook for API integration
import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

// Generic API hook
export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.request(endpoint, options);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, JSON.stringify(options)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Specific hooks for common operations
export function useQuizzes(limit = 20, category = null, difficulty = null) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getQuizzes(limit, category, difficulty);
      setQuizzes(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, category, difficulty]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  return { quizzes, loading, error, refetch: fetchQuizzes };
}

export function useRandomQuiz() {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRandomQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getRandomQuiz();
      setQuiz(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { quiz, loading, error, fetchRandomQuiz };
}

export function useSubmitAnswer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submitAnswer = useCallback(async (quizId, answer, userAccount) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.submitAnswer(quizId, answer, userAccount);
      setResult(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submitAnswer, loading, error, result };
}

export function useStats() {
  const { data: stats, loading, error, refetch } = useApi('/data/stats');
  return { stats, loading, error, refetch };
}

export function useHealthCheck() {
  const [isHealthy, setIsHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.healthCheck();
      setIsHealthy(result.status === 'healthy');
    } catch (err) {
      setError(err.message);
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { isHealthy, loading, error, checkHealth };
}
