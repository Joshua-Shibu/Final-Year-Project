import { NFTStorage } from 'nft.storage';

const client = new NFTStorage({ token: process.env.REACT_APP_NFT_STORAGE_API_KEY });

export const testIPFSConnection = async () => {
  try {
    // Simple test to verify connection
    await client.status();
    return true;
  } catch (error) {
    console.error("IPFS connection error:", error);
    return false;
  }
};

export const uploadToIPFS = async (file) => {
  try {
    const blob = new Blob([file]);
    const cid = await client.storeBlob(blob);
    return cid;
  } catch (error) {
    console.error("IPFS upload error:", error);
    throw error;
  }
};