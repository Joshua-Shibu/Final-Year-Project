import Web3 from 'web3';
import { CONTRACT_ABI, CONTRACT_ADDRESS, NFT_STORAGE_KEY } from './config/contract';
import { NFTStorage } from 'nft.storage';

// Initialize NFT.Storage client
const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_KEY });

const getContractInstance = async () => {
  if (!window.ethereum) {
    console.error("MetaMask not installed!");
    return null;
  }

  try {
    const web3 = new Web3(window.ethereum);
    
    // Handle multiple connection requests
    if (!window.ethereum.selectedAddress) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    }

    const accounts = await web3.eth.getAccounts();
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    console.log("Connected account:", accounts[0]);
    return { 
      web3, 
      contract, 
      accounts,
      nftStorage: nftStorageClient // Add NFT.Storage client to the return object
    };
    
  } catch (error) {
    console.error("Connection error:", error);
    return null;
  }
};

// Helper function to upload files to NFT.Storage
export const uploadToIPFS = async (file) => {
  try {
    const blob = new Blob([file]);
    const cid = await nftStorageClient.storeBlob(blob);
    return cid;
  } catch (error) {
    console.error("Error uploading to NFT.Storage:", error);
    throw error;
  }
};

// Helper function to get file URL from CID
export const getIPFSURL = (cid) => {
  return `https://${cid}.ipfs.nftstorage.link`;
};

export default getContractInstance; 