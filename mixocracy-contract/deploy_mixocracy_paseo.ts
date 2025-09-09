import { ethers } from 'ethers';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Paseo TestNet configuration
const PASEO_RPC_URL = 'https://testnet-passet-hub-eth-rpc.polkadot.io';
const PASEO_CHAIN_ID = 420420422;
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
  console.log('🎵 Deploying Mixocracy - Live DJ Voting Contract to Paseo TestNet\n');
  
  const provider = new ethers.JsonRpcProvider(PASEO_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Verify network
  const network = await provider.getNetwork();
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId.toString());
  
  if (network.chainId !== BigInt(PASEO_CHAIN_ID)) {
    throw new Error(`Wrong network! Expected chain ID ${PASEO_CHAIN_ID}, got ${network.chainId}`);
  }
  
  console.log('Deployer:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'PAS\n');
  
  if (balance === 0n) {
    console.log('⚠️  Warning: Your account has no PAS tokens!');
    console.log('Get testnet PAS tokens from a faucet before deploying.');
    process.exit(1);
  }
  
  // Read contract bytecode
  const bytecode = fs.readFileSync('mixocracy.polkavm');
  console.log('Contract size:', bytecode.length, 'bytes');
  
  // Deploy contract
  console.log('\n📝 Deploying contract to Paseo TestNet...');
  const tx = await wallet.sendTransaction({
    data: '0x' + bytecode.toString('hex'),
  });
  
  console.log('Transaction hash:', tx.hash);
  console.log('Waiting for confirmation...');
  
  const receipt = await tx.wait();
  console.log('✅ Contract deployed!');
  console.log('Contract address:', receipt!.contractAddress);
  console.log('Gas used:', receipt!.gasUsed.toString());
  
  console.log('\n🎉 Deployment complete!');
  console.log('Contract address:', receipt!.contractAddress);
  console.log('\nContract owner:', wallet.address);
  
  console.log('\nView on BlockScout:');
  console.log(`https://blockscout-passet-hub.parity-testnet.parity.io/address/${receipt!.contractAddress}`);
  
  console.log('\nContract features:');
  console.log('- Owner can register/remove DJs');
  console.log('- DJs can add songs to their setlist');
  console.log('- Users can vote for songs (one vote per song)');
  console.log('- Users can unvote to change their selection');
  console.log('- Real-time vote tracking');
  console.log('- DJs can start/stop their sets');
  console.log('- Tracks played history');
  
  // Save deployment info
  const deploymentInfo = {
    address: receipt!.contractAddress,
    deploymentTx: tx.hash,
    deployer: wallet.address,
    owner: wallet.address,
    timestamp: new Date().toISOString(),
    network: 'paseo',
    chainId: PASEO_CHAIN_ID,
    rpcUrl: PASEO_RPC_URL,
    blockExplorer: `https://blockscout-passet-hub.parity-testnet.parity.io/address/${receipt!.contractAddress}`
  };
  
  fs.writeFileSync(
    'mixocracy_deployment_paseo.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('\nDeployment info saved to mixocracy_deployment_paseo.json');
  console.log('\nNext steps:');
  console.log('1. Update NEXT_PUBLIC_MIXOCRACY_CONTRACT_ADDRESS in your .env file');
  console.log('2. Use registerDj(address) to add DJ addresses');
  console.log('3. DJs use addSong(string) to add tracks');
  console.log('4. Users vote with vote(djAddress, songId)');
}

main().catch(console.error);