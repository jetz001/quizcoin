#!/usr/bin/env node

// Server control script for QuizCoin backend
const { spawn, exec } = require('child_process');
const path = require('path');

const command = process.argv[2];

switch (command) {
  case 'start':
    console.log('🚀 Starting QuizCoin backend server...');
    const server = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    server.on('close', (code) => {
      console.log(`✅ Server exited with code ${code}`);
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down server...');
      server.kill('SIGINT');
    });
    break;
    
  case 'stop':
    console.log('🛑 Stopping all Node.js processes...');
    exec('taskkill /F /IM node.exe', (error, stdout, stderr) => {
      if (error) {
        console.log('ℹ️ No Node.js processes found or already stopped');
      } else {
        console.log('✅ All Node.js processes stopped');
      }
    });
    break;
    
  case 'restart':
    console.log('🔄 Restarting server...');
    exec('taskkill /F /IM node.exe', () => {
      setTimeout(() => {
        console.log('🚀 Starting server...');
        const server = spawn('node', ['server.js'], {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit'
        });
        
        process.on('SIGINT', () => {
          server.kill('SIGINT');
        });
      }, 1000);
    });
    break;
    
  default:
    console.log(`
QuizCoin Server Control

Usage:
  node scripts/server-control.js <command>

Commands:
  start    - Start the server
  stop     - Stop all Node.js processes
  restart  - Restart the server

Examples:
  node scripts/server-control.js start
  node scripts/server-control.js stop
  node scripts/server-control.js restart
    `);
}
