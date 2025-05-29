import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserProvider } from "ethers";
import contractInstance from "../contractInstance";
import { 
  Button,
  Typography,
  Box,
  Card,
  CircularProgress,
  Link,
  TextField
} from "@material-ui/core";
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import "./general.css";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: '#f5f7fa',
  },
  card: {
    width: '100%',
    maxWidth: '500px',
    borderRadius: '16px',
    padding: '2.5rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    [theme.breakpoints.down('sm')]: {
      padding: '1.5rem',
    }
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    color: '#1a237e',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#666',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  walletButton: {
    marginBottom: '1.5rem',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #1a237e',
    color: '#1a237e',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: 'rgba(0, 128, 255, 0.08)',
    }
  },
  loginButton: {
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 600,
    textTransform: 'none',
    backgroundColor: '#3F51B5',
    color: '#fff',
    marginTop: '1rem',
    '&:hover': {
      backgroundColor: '#212c9f',
    },
  },
  medicalIcon: {
    width: '100px',
    margin: '1.5rem auto',
    display: 'block',
  }
}));

function Login() {
  const classes = useStyles();
  const [walletAddress, setWalletAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    return () => setIsMounted(false);
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsLoading(true);
        const provider = new BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        if (isMounted) setWalletAddress(address);
        await signer.signMessage("Authenticate Login");
      } catch (error) {
        if (isMounted) setMessage("Wallet connection failed.");
        console.error("Error connecting wallet:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    } else {
      setMessage("Please install MetaMask.");
    }
  };

  const handleLogin = async () => {
    if (!walletAddress) {
      setMessage("Please connect your wallet first.");
      return;
    }
  
    try {
      setIsLoading(true);
      setMessage("");
      const instance = await contractInstance();
      if (!instance) throw new Error("Could not connect to contract");

      const { contract } = instance;
      const roleNumber = await contract.methods.userRoles(walletAddress).call();

      if (roleNumber === "1") {
        const patientDetails = await contract.methods.getPatientDetails(walletAddress).call();
        localStorage.setItem("ispatient", "true");
        localStorage.setItem("name", patientDetails[0]);
        localStorage.setItem("dob", patientDetails[1]);
        localStorage.setItem("gender", patientDetails[2]);
        localStorage.setItem("bloodgroup", patientDetails[3]);
        localStorage.setItem("phone", patientDetails[4]);
        localStorage.setItem("currentAccount", walletAddress);
        navigate("/patients_dashboard");
      } 
      else if (roleNumber === "2") {
        const doctorDetails = await contract.methods.getDoctorDetails(walletAddress).call();
        localStorage.setItem("isdoctor", "true");
        localStorage.setItem("docname", doctorDetails[0]);
        localStorage.setItem("faculty", doctorDetails[1]);
        localStorage.setItem("hname", doctorDetails[2]);
        localStorage.setItem("contact", doctorDetails[3]);
        localStorage.setItem("license", doctorDetails[4]);
        localStorage.setItem("currentAccount", walletAddress);
        navigate("/doctor_dashboard");
      } else {
        throw new Error("User not registered. Please complete registration first.");
      }
    } catch (error) {
      console.error("Login error:", error);
      if (isMounted) {
        setMessage(error.message || "Error during login. Please try again.");
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={classes.root}>
      <Card className={classes.card}>
        <div className={classes.header}>
          <Typography variant="h4" className={classes.title}>
            DMed
          </Typography>
          <Typography variant="subtitle1" className={classes.subtitle}>
            Secure access to your health records
          </Typography>
          <img src="/stethoscope.svg" alt="Medical Icon" className={classes.medicalIcon} />
        </div>

        <Button
          variant="outlined"
          fullWidth
          className={classes.walletButton}
          onClick={connectWallet}
          disabled={isLoading}
          startIcon={isLoading && <CircularProgress size={20} />}
        >
          {walletAddress ? `Connected: ${walletAddress.substring(0, 6)}...` : "Connect Wallet"}
        </Button>

        <form className={classes.form}>
          <TextField
            label="Wallet Address"
            variant="outlined"
            fullWidth
            value={walletAddress || ""}
            disabled
          />

          <Button
            variant="contained"
            fullWidth
            className={classes.loginButton}
            onClick={handleLogin}
            disabled={isLoading || !walletAddress}
            startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
          >
            {isLoading ? "Authenticating..." : "Login"}
          </Button>
        </form>

        {message && (
          <Alert severity={message.includes("failed") ? "error" : "info"} style={{ marginTop: '1.5rem' }}>
            {message}
          </Alert>
        )}

        <Box style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666' }}>
          Not registered?{' '}
          <Link
            component="button"
            onClick={() => navigate("/")}
            style={{ color: '#1a237e', textDecoration: 'none' }}
          >
            Create an account
          </Link>
        </Box>
      </Card>
    </div>
  );
}

export default Login;