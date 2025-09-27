#!/usr/bin/env node

/**
 * SEO Testing Script for CouponCycle
 * 
 * This script tests various SEO implementations to ensure they're working correctly.
 * Run with: node scripts/test-seo.js
 */

import https from 'https';
import http from 'http';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coupon-cycle.site';

// Test functions
async function testUrl(url, description) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      console.log(`✅ ${description}: ${res.statusCode} ${res.statusMessage}`);
      resolve({ status: res.statusCode, headers: res.headers });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${description}: ${err.message}`);
      resolve({ status: 0, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      console.log(`⏰ ${description}: Timeout`);
      req.destroy();
      resolve({ status: 0, error: 'Timeout' });
    });
    
    req.end();
  });
}

async function testMetaTags(url, description) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const tests = [
          { name: 'Title tag', pattern: /<title[^>]*>([^<]+)<\/title>/i },
          { name: 'Meta description', pattern: /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i },
          { name: 'Meta keywords', pattern: /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i },
          { name: 'Open Graph title', pattern: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i },
          { name: 'Open Graph description', pattern: /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i },
          { name: 'Twitter card', pattern: /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["']/i },
          { name: 'Canonical URL', pattern: /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i },
          { name: 'Structured data', pattern: /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i }
        ];
        
        console.log(`\n🔍 ${description} - Meta Tag Analysis:`);
        
        tests.forEach(test => {
          const match = data.match(test.pattern);
          if (match) {
            console.log(`  ✅ ${test.name}: ${match[1] || 'Found'}`);
          } else {
            console.log(`  ❌ ${test.name}: Not found`);
          }
        });
        
        resolve({ status: res.statusCode, data });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${description}: ${err.message}`);
      resolve({ status: 0, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      console.log(`⏰ ${description}: Timeout`);
      req.destroy();
      resolve({ status: 0, error: 'Timeout' });
    });
    
    req.end();
  });
}

async function runSEOTests() {
  console.log('🚀 Starting SEO Tests for CouponCycle\n');
  console.log(`Testing URL: ${BASE_URL}\n`);
  
  // Test basic accessibility
  console.log('📋 Testing Basic Accessibility:');
  await testUrl(`${BASE_URL}/`, 'Homepage');
  await testUrl(`${BASE_URL}/guide`, 'Guide page');
  await testUrl(`${BASE_URL}/contact`, 'Contact page');
  await testUrl(`${BASE_URL}/robots.txt`, 'Robots.txt');
  await testUrl(`${BASE_URL}/sitemap.xml`, 'Sitemap.xml');
  await testUrl(`${BASE_URL}/favicon.png`, 'Favicon');
  
  // Test meta tags
  console.log('\n📋 Testing Meta Tags:');
  await testMetaTags(`${BASE_URL}/`, 'Homepage');
  await testMetaTags(`${BASE_URL}/guide`, 'Guide page');
  
  // Test API endpoints
  console.log('\n📋 Testing API Endpoints:');
  await testUrl(`${BASE_URL}/api/predefined-cards`, 'Predefined cards API');
  await testUrl(`${BASE_URL}/api/predefined-cards-with-benefits`, 'Cards with benefits API');
  
  console.log('\n✅ SEO Tests Complete!');
  console.log('\n📝 Next Steps:');
  console.log('1. Fix any failed tests above');
  console.log('2. Set up Google Search Console');
  console.log('3. Configure Google Analytics');
  console.log('4. Submit sitemap to search engines');
  console.log('5. Test mobile usability');
}

// Run tests
runSEOTests().catch(console.error);
