import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { MIXOCRACY_CONTRACT_ADDRESS } from '@/lib/contract-config';

// API route to remove played songs using a hot wallet
// The private key is stored in Vercel environment variables
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Remove played song request:', body);
    
    const { songId, djAddress } = body;
    
    if (typeof songId !== 'number' || !djAddress) {
      console.error('Invalid parameters:', { songId, djAddress });
      return NextResponse.json(
        { error: 'Invalid parameters', details: { songId: typeof songId, djAddress: !!djAddress } },
        { status: 400 }
      );
    }
    
    // Get hot wallet private key from environment
    const privateKey = process.env.HOT_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.warn('HOT_WALLET_PRIVATE_KEY not configured - automatic song removal disabled');
      return NextResponse.json(
        { error: 'Automatic removal not configured', warning: true },
        { status: 200 } // Return 200 to not break the app flow
      );
    }
    
    // Set up provider
    const network = process.env.NEXT_PUBLIC_NETWORK || 'paseo';
    const rpcUrl = network === 'westend'
      ? 'https://westend-asset-hub-eth-rpc.polkadot.io'
      : 'https://testnet-passet-hub-eth-rpc.polkadot.io';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`Hot wallet address: ${wallet.address}`);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    if (balance.toString() === '0') {
      console.error(`Hot wallet ${wallet.address} has no funds for gas`);
      return NextResponse.json(
        { error: 'Hot wallet needs funding', address: wallet.address },
        { status: 503 }
      );
    }
    
    console.log(`Hot wallet balance: ${ethers.formatEther(balance)} tokens`);
    
    // First check if the hot wallet is a registered DJ
    const isDjSelector = '0x41d10bee'; // isDj(address)
    const isDjParams = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [wallet.address]);
    const isDjData = isDjSelector + isDjParams.slice(2);
    
    const isDjResult = await provider.call({
      to: MIXOCRACY_CONTRACT_ADDRESS,
      data: isDjData
    });
    
    const [isRegisteredDj] = ethers.AbiCoder.defaultAbiCoder().decode(['bool'], isDjResult);
    console.log(`Hot wallet is registered DJ: ${isRegisteredDj}`);
    
    if (!isRegisteredDj) {
      console.error('Hot wallet is not a registered DJ - cannot remove songs');
      return NextResponse.json(
        { 
          error: 'Hot wallet not authorized', 
          details: 'The hot wallet must be registered as a DJ to remove songs',
          hotWalletAddress: wallet.address 
        },
        { status: 403 }
      );
    }
    
    // Use the universal remover function that allows any DJ to remove any song
    const selector = '0x42ed653b'; // removeSongUniversal(address,uint256)
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'], 
      [djAddress, songId]
    );
    const data = selector + params.slice(2);
    
    console.log(`Attempting to remove song ${songId} for DJ ${djAddress}`);
    console.log(`Using removeSongUniversal function with hot wallet: ${wallet.address}`);
    
    // Send transaction
    const tx = await wallet.sendTransaction({
      to: MIXOCRACY_CONTRACT_ADDRESS,
      data,
    });
    
    console.log(`🔗 Blockchain transaction sent to remove song ${songId}:`, {
      transactionHash: tx.hash,
      djAddress,
      songId,
      hotWallet: wallet.address,
      timestamp: new Date().toISOString()
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log(`✅ Song removal confirmed on blockchain:`, {
      songId,
      djAddress,
      transactionHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString()
    });
    
    // Verify the song is now marked as removed
    const verifySelector = '0x59d23866'; // isSongRemoved(address,uint256)
    const verifyParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [djAddress, songId]);
    const verifyData = verifySelector + verifyParams.slice(2);
    
    try {
      const verifyResult = await provider.call({
        to: MIXOCRACY_CONTRACT_ADDRESS,
        data: verifyData
      });
      const [isNowRemoved] = ethers.AbiCoder.defaultAbiCoder().decode(['bool'], verifyResult);
      console.log(`🔍 Verification: Song ${songId} is now marked as removed: ${isNowRemoved}`);
      
      if (!isNowRemoved) {
        console.error(`⚠️ WARNING: Transaction succeeded but song ${songId} is not marked as removed!`);
      }
    } catch (e) {
      console.error('Failed to verify removal status:', e);
    }
    
    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt?.blockNumber,
    });
    
  } catch (error) {
    console.error('Failed to remove played song:', error);
    
    // More detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    };
    
    return NextResponse.json(
      { error: 'Failed to remove song', details: errorDetails },
      { status: 500 }
    );
  }
}