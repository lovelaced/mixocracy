import { ethers } from 'ethers';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = 'https://westend-asset-hub-eth-rpc.polkadot.io';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

async function main() {
  console.log('🚀 Deploying Robust AMM V2 with Extreme Value Fixes\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Deployer:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'WND\n');
  
  // Read contract bytecode
  const bytecode = fs.readFileSync('../distribution_market_amm_v4_robust.polkavm');
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
  
  // Initialize the contract
  console.log('\n📝 Initializing contract...');
  const initData = '0x8129fc1c'; // initialize()
  
  const initTx = await wallet.sendTransaction({
    to: receipt!.contractAddress,
    data: initData
  });
  
  console.log('Init TX:', initTx.hash);
  await initTx.wait();
  console.log('✅ Contract initialized!');
  
  console.log('\n🎉 Deployment complete!');
  console.log('Contract address:', receipt!.contractAddress);
  
  console.log('\nImprovements in this version:');
  console.log('- Adaptive integration bounds for extreme distributions');
  console.log('- Dynamic step count based on variance (20-100 steps)');
  console.log('- Safety checks to prevent >100x returns');
  console.log('- Market parameter validation (max mean: 1M, max variance: 10M)');
  console.log('- Position value capped at 50% of market backing');
  
  // Save deployment info
  const deploymentInfo = {
    address: receipt!.contractAddress,
    deploymentTx: tx.hash,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
    version: 'robust_v2_extreme_value_fix'
  };
  
  fs.writeFileSync(
    'robust_v2_deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main().catch(console.error);
