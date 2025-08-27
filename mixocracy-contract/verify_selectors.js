const { ethers } = require('ethers');

// Define the ABI for all our functions
const abi = [
    "function registerDj(address djAddress)",
    "function addSong(string songName)",
    "function vote(address djAddress, uint256 songId)",
    "function getVotes(address djAddress, uint256 songId) view returns (uint256)",
    "function getSong(address djAddress, uint256 songId) view returns (string)",
    "function getSongCount(address djAddress) view returns (uint256)",
    "function isDj(address djAddress) view returns (bool)",
    "function removeDj(address djAddress)",
    "function clearVotes(address djAddress, uint256 songId)",
    "function hasVoted(address voter, address djAddress, uint256 songId) view returns (bool)",
    "function startSet(address djAddress)",
    "function stopSet(address djAddress)",
    "function isSetActive(address djAddress) view returns (bool)",
    "function getActiveDjs() view returns (address[])",
    "function getSongsWithVotes(address djAddress) view returns (tuple(uint256 id, string name, uint256 votes)[])",
    "function getTopSongs(address djAddress, uint256 limit) view returns (tuple(uint256 id, string name, uint256 votes)[])",
    "function setDjMetadata(address djAddress, string metadata)",
    "function getDjMetadata(address djAddress) view returns (string)",
    "function getDjInfo(address djAddress) view returns (tuple(bool isRegistered, bool isActive, uint256 startTime, uint256 songCount, string metadata))"
];

// Our hardcoded selectors from the contract (updated to match ethers)
const contractSelectors = {
    registerDj: [0x19, 0xc2, 0x36, 0xc0],
    addSong: [0x7f, 0x59, 0x0f, 0x5e],
    vote: [0x5f, 0x74, 0xbb, 0xde],
    getVotes: [0xeb, 0x90, 0x19, 0xd4],
    getSong: [0xa4, 0xa2, 0x29, 0xcb],
    getSongCount: [0xe8, 0x77, 0x1f, 0xbe],
    isDj: [0x41, 0xd1, 0x0b, 0xee],
    removeDj: [0x7b, 0x6b, 0x47, 0xa8],
    clearVotes: [0xba, 0x37, 0x82, 0x9d],
    hasVoted: [0xa1, 0x87, 0x30, 0x2b],
    startSet: [0xb4, 0xd6, 0xb5, 0x62],
    stopSet: [0x6b, 0x41, 0xc1, 0x69],
    isSetActive: [0x2e, 0x81, 0x78, 0x2f],
    getActiveDjs: [0x9a, 0x70, 0x9f, 0xa4],
    getSongsWithVotes: [0x0d, 0x35, 0x7d, 0x3d],
    getTopSongs: [0xe7, 0xb9, 0x6e, 0x73],
    setDjMetadata: [0xb4, 0xa3, 0x14, 0x27],
    getDjMetadata: [0x19, 0x7e, 0x05, 0x3e],
    getDjInfo: [0xe9, 0x23, 0x0c, 0x05]
};

console.log('Verifying function selectors...\n');

// Create interface
const iface = new ethers.Interface(abi);

// Track any mismatches
let mismatches = 0;

// Verify each function
for (const func of abi) {
    try {
        // Parse function signature to get the name
        const match = func.match(/function\s+(\w+)/);
        if (!match) continue;
        
        const functionName = match[1];
        const fragment = iface.getFunction(functionName);
        
        // Get the selector from ethers (first 4 bytes of keccak256 hash)
        const sighash = fragment.selector;
        const ethersSelectorBytes = ethers.getBytes(sighash);
        
        // Get our hardcoded selector
        const ourSelector = contractSelectors[functionName];
        
        if (ourSelector) {
            // Convert our array to hex string for comparison
            const ourSelectorHex = '0x' + ourSelector.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Check if they match
            const match = ourSelectorHex === sighash;
            
            console.log(`${functionName}:`);
            console.log(`  Contract: ${ourSelectorHex}`);
            console.log(`  Ethers:   ${sighash}`);
            console.log(`  Status:   ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
            
            if (!match) {
                mismatches++;
                // Show the correct selector as a Rust array
                const correctBytes = Array.from(ethersSelectorBytes);
                const rustArray = `[${correctBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`;
                console.log(`  Correct:  ${rustArray}`);
            }
            console.log('');
        } else {
            console.log(`${functionName}: ❓ Not found in contract selectors\n`);
        }
    } catch (e) {
        console.log(`Error processing ${func}: ${e.message}\n`);
    }
}

console.log('='.repeat(50));
if (mismatches === 0) {
    console.log('✅ All selectors match! Your contract is ready to use.');
} else {
    console.log(`❌ Found ${mismatches} mismatches. Please update the contract selectors.`);
    console.log('\nTo fix, update the selectors in your Rust contract with the correct values shown above.');
}

// Also show how to create a contract instance in JavaScript
console.log('\n' + '='.repeat(50));
console.log('Example usage in JavaScript:\n');
console.log(`const contractAddress = "YOUR_CONTRACT_ADDRESS";
const provider = new ethers.JsonRpcProvider("YOUR_RPC_URL");
const signer = await provider.getSigner();

const contract = new ethers.Contract(contractAddress, ${JSON.stringify(abi, null, 2)}, signer);

// Example calls:
// await contract.registerDj("0x...");
// await contract.startSet("0x...");
// const activeDjs = await contract.getActiveDjs();`);