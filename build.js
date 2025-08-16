#!/usr/bin/env node

/**
 * Build Script for Focus Guard Extension
 * Creates Chrome and Firefox builds
 */

const fs = require('fs');
const path = require('path');

function createBuild(browser) {
  const buildDir = `build-${browser}`;
  
  // Create build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  
  // Copy all source files
  const srcDirs = ['src'];
  srcDirs.forEach(dir => {
    copyDir(dir, path.join(buildDir, dir));
  });
  
  // Copy appropriate manifest
  const manifestFile = browser === 'firefox' ? 'manifest-firefox.json' : 'manifest.json';
  fs.copyFileSync(manifestFile, path.join(buildDir, 'manifest.json'));
  
  console.log(`✅ ${browser} build created in ${buildDir}/`);
  
  // Create ZIP for distribution
  console.log(`📦 Creating ${browser} package...`);
  console.log(`   Run: cd ${buildDir} && zip -r ../focus-guard-${browser}.zip .`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  
  const items = fs.readdirSync(src);
  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Main execution
console.log('🚀 Building Focus Guard Extension...\n');

createBuild('chrome');
createBuild('firefox');

console.log('\n🎉 Both builds completed!');
console.log('\n📋 Next steps:');
console.log('   Chrome: Load build-chrome/ in chrome://extensions/');
console.log('   Firefox: Load build-firefox/ in about:debugging');
console.log('   Package: Use the zip commands shown above');