#!/usr/bin/env node

/**
 * OneSignal Notification Setup Script
 * 
 * This script helps you set up web push notifications for your chat app.
 * Run this script to check your configuration and get setup instructions.
 */

const fs = require('fs');
const path = require('path');

console.log('🔔 OneSignal Notification Setup\n');

// Check if .env files exist
const backendEnvPath = path.join(__dirname, 'backend', '.env');
const frontendEnvPath = path.join(__dirname, '.env.local');

console.log('📁 Checking environment files...\n');

// Check backend .env
if (fs.existsSync(backendEnvPath)) {
  console.log('✅ Backend .env file found');
  const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
  
  const hasAppId = backendEnv.includes('ONESIGNAL_APP_ID=');
  const hasApiKey = backendEnv.includes('ONESIGNAL_REST_API_KEY=');
  
  console.log(`   ONESIGNAL_APP_ID: ${hasAppId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ONESIGNAL_REST_API_KEY: ${hasApiKey ? '✅ Set' : '❌ Missing'}`);
} else {
  console.log('❌ Backend .env file not found');
  console.log('   Create chatApp/backend/.env with:');
  console.log('   ONESIGNAL_APP_ID=your_app_id_here');
  console.log('   ONESIGNAL_REST_API_KEY=your_api_key_here\n');
}

// Check frontend .env.local
if (fs.existsSync(frontendEnvPath)) {
  console.log('✅ Frontend .env.local file found');
  const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  
  const hasPublicAppId = frontendEnv.includes('NEXT_PUBLIC_ONESIGNAL_APP_ID=');
  
  console.log(`   NEXT_PUBLIC_ONESIGNAL_APP_ID: ${hasPublicAppId ? '✅ Set' : '❌ Missing'}`);
} else {
  console.log('❌ Frontend .env.local file not found');
  console.log('   Create chatApp/.env.local with:');
  console.log('   NEXT_PUBLIC_ONESIGNAL_APP_ID=your_app_id_here\n');
}

// Check service worker files
const swPath = path.join(__dirname, 'public', 'sw.js');
const oneSignalSwPath = path.join(__dirname, 'public', 'OneSignalSDKWorker.js');

console.log('\n🔧 Checking service worker files...');

if (fs.existsSync(swPath)) {
  console.log('✅ Custom service worker (sw.js) found');
} else {
  console.log('❌ Custom service worker (sw.js) missing');
}

if (fs.existsSync(oneSignalSwPath)) {
  console.log('✅ OneSignal service worker (OneSignalSDKWorker.js) found');
} else {
  console.log('❌ OneSignal service worker (OneSignalSDKWorker.js) missing');
}

console.log('\n📋 Setup Instructions:');
console.log('1. Sign up at https://onesignal.com');
console.log('2. Create a new Web Push app');
console.log('3. Copy your App ID and REST API Key');
console.log('4. Add them to your environment files');
console.log('5. Restart your backend server');
console.log('6. Test notifications using the debug menu in the chat app');

console.log('\n🔍 Debug Endpoints:');
console.log('- GET /api/debug/onesignal-config - Check configuration');
console.log('- GET /api/debug/onesignal-users - List users with player IDs');
console.log('- POST /api/debug/test-notification/:userId - Send test notification');

console.log('\n📖 For detailed instructions, see: NOTIFICATION_SETUP.md\n'); 