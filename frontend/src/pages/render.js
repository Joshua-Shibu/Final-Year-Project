import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import getContract from "../contractInstance";

function Render() {
  const [accountAddress, setAccountAddress] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccountAddress(accounts[0]);
        navigate("/dashboard", { state: { account: accounts[0] } });
      } else {
        setError("Please install Metamask to continue.");
      }
    } catch (err) {
      setError("Error connecting to wallet.");
      console.error(err);
    }
  };

  return (
    <div className="container">
      <h2>Welcome to Decentralized Medical Record System</h2>
      <button onClick={connectWallet}>Connect Wallet</button>
      {accountAddress && <p>Connected Wallet: {accountAddress}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Render;
