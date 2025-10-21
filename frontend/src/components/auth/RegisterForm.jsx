// src/components/auth/RegisterForm.jsx - Registration form component
import React, { useState, useEffect } from 'react';
import { useRegister, useUsernameCheck } from '../../hooks/useAuth.jsx';

function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    walletAddress: ''
  });

  const [validationErrors, setValidationErrors] = useState({});
  const { handleRegister, loading, error, setError } = useRegister();
  const { checkUsername, checking, available } = useUsernameCheck();

  // Check username availability when username changes
  useEffect(() => {
    if (formData.username && formData.username.length >= 3) {
      const timer = setTimeout(() => {
        checkUsername(formData.username);
      }, 500); // Debounce

      return () => clearTimeout(timer);
    }
  }, [formData.username, checkUsername]);

  const validateForm = () => {
    const errors = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    // Username validation
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    } else if (available === false) {
      errors.username = 'Username is already taken';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Wallet address validation (optional)
    if (formData.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      errors.walletAddress = 'Invalid Ethereum wallet address';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (available === false) {
      setError('Username is not available');
      return;
    }

    const { confirmPassword, ...registrationData } = formData;
    const result = await handleRegister(registrationData);
    
    if (result.success) {
      onSuccess?.(result.user);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    
    // Clear errors when user starts typing
    if (error) setError(null);
    if (validationErrors[e.target.name]) {
      setValidationErrors(prev => ({
        ...prev,
        [e.target.name]: null
      }));
    }
  };

  const getUsernameStatus = () => {
    if (!formData.username || formData.username.length < 3) return null;
    if (checking) return { type: 'checking', message: 'Checking availability...' };
    if (available === true) return { type: 'success', message: 'Username is available!' };
    if (available === false) return { type: 'error', message: 'Username is taken' };
    return null;
  };

  const usernameStatus = getUsernameStatus();

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Join QuizCoin</h2>
        <p className="text-gray-300">Create your account and start earning</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
              validationErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="your@email.com"
            disabled={loading}
          />
          {validationErrors.email && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.email}</p>
          )}
        </div>

        {/* Username Input */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
            Username *
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
              validationErrors.username || (available === false) ? 'border-red-500 focus:ring-red-500' : 
              available === true ? 'border-green-500 focus:ring-green-500' : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="Choose a username"
            disabled={loading}
          />
          {usernameStatus && (
            <p className={`text-xs mt-1 ${
              usernameStatus.type === 'success' ? 'text-green-400' : 
              usernameStatus.type === 'error' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {usernameStatus.message}
            </p>
          )}
          {validationErrors.username && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.username}</p>
          )}
        </div>

        {/* Display Name Input */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="How others will see you"
            disabled={loading}
          />
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            Password *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
              validationErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="At least 6 characters"
            disabled={loading}
          />
          {validationErrors.password && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.password}</p>
          )}
        </div>

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
            Confirm Password *
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
              validationErrors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="Confirm your password"
            disabled={loading}
          />
          {validationErrors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.confirmPassword}</p>
          )}
        </div>

        {/* Wallet Address Input (Optional) */}
        <div>
          <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-300 mb-1">
            Wallet Address (Optional)
          </label>
          <input
            type="text"
            id="walletAddress"
            name="walletAddress"
            value={formData.walletAddress}
            onChange={handleChange}
            className={`w-full px-4 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
              validationErrors.walletAddress ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
            }`}
            placeholder="0x... (for blockchain rewards)"
            disabled={loading}
          />
          {validationErrors.walletAddress && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.walletAddress}</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || checking || available === false}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>

        {/* Switch to Login */}
        <div className="text-center">
          <p className="text-gray-300">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Sign in here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

export default RegisterForm;
