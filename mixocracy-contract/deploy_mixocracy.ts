import { ethers } from 'ethers';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = 'https://westend-asset-hub-eth-rpc.polkadot.io';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
  console.log('🎵 Deploying Mixocracy - Live DJ Voting Contract\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Deployer:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'WND\n');
  
  // Read contract bytecode
  const bytecode = fs.readFileSync('mixocracy.polkavm');
  console.log('Contract size:', bytecode.length, 'bytes');
  
  // Deploy contract
  console.log('\n📝 Deploying contract...');
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
  
  console.log('\nContract features:');
  console.log('- Owner can register/remove DJs');
  console.log('- DJs can add songs to their setlist');
  console.log('- Users can vote for songs (one vote per song)');
  console.log('- Real-time vote tracking');
  console.log('- Owner can clear votes for fresh rounds');
  
  // Save deployment info
  const deploymentInfo = {
    address: receipt!.contractAddress,
    deploymentTx: tx.hash,
    deployer: wallet.address,
    owner: wallet.address,
    timestamp: new Date().toISOString(),
    network: 'westend',
    rpcUrl: RPC_URL
  };
  
  fs.writeFileSync(
    'mixocracy_deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('\nDeployment info saved to mixocracy_deployment.json');
  console.log('\nNext steps:');
  console.log('1. Use registerDj(address) to add DJ addresses');
  console.log('2. DJs use addSong(string) to add tracks');
  console.log('3. Users vote with vote(djAddress, songId)');
}

main().catch(console.error);