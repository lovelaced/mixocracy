const { ethers } = require('ethers');

// Test one function
const sig = "registerDj(address)";
const hash = ethers.id(sig);
const selector = hash.slice(0, 10);

console.log(`Function: ${sig}`);
console.log(`Keccak256: ${hash}`);
console.log(`Selector: ${selector}`);

// Convert to bytes
const bytes = ethers.getBytes(selector);
console.log(`Bytes: [${Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);