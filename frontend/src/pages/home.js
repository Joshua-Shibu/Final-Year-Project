import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import getContractInstance from "../contractInstance";
import { makeStyles } from '@material-ui/core/styles';
import {
  Card,
  TextField,
  Button,
  CircularProgress,
  Box,
  Typography,
  Divider
} from '@material-ui/core';

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
    maxWidth: '900px',
    borderRadius: '16px',
    padding: '2rem',
    display: 'flex',
    gap: '2rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      padding: '1.5rem',
    }
  },
  leftSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    background: '#f0f2ff',
    padding: '2rem',
    borderRadius: '12px',
    '& h3': {
      color: '#1a237e',
      fontSize: '1.8rem',
      fontWeight: 600,
      marginBottom: '1rem',
      lineHeight: 1.4,
    },
    [theme.breakpoints.down('sm')]: {
      padding: '1.5rem',
    }
  },
  rightSection: {
    flex: 1,
    padding: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  submitButton: {
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 600,
    textTransform: 'none',
    backgroundColor: '#303F9F',
    color: '#fff',
    marginTop: '1rem',
    '&:hover': {
      backgroundColor: '#303F9F',
    },
  },
  walletButton: {
    marginBottom: '2rem',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #303F9F',
    color: '#303F9F',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: 'rgba(0, 128, 255, 0.08)',
    }
  },
  roleToggle: {
    marginBottom: '1.5rem',
    display: 'flex',
    gap: '1rem',
    '& button': {
      borderRadius: '8px',
      textTransform: 'none',
      fontWeight: 500
    }
  }
}));

function Home() {
  const classes = useStyles();
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setWalletAddress(accounts[0]);
      } catch (error) {
        setMessage("Wallet connection failed.");
      }
    } else {
      setMessage("Please install Metamask.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletAddress) {
      setMessage("Please connect your wallet first.");
      return;
    }
    setLoading(true);

    try {
      const instance = await getContractInstance();
      if (!instance) {
        setMessage("Blockchain connection failed.");
        return;
      }

      const { contract, accounts } = instance;

      if (role === "patient") {
        if (!name || !age || !gender || !bloodGroup || !phone) {
          setMessage("Please fill all patient details.");
          return;
        }
        await contract.methods
          .registerPatient(name, age, gender, bloodGroup, phone)
          .send({ from: accounts[0] });
      } else if (role === "doctor") {
        if (!name || !licenseNumber || !hospitalName || !specialization || !phone) {
          setMessage("Please fill all doctor details.");
          return;
        }
        await contract.methods
          .registerDoctor(name, specialization, hospitalName, phone, licenseNumber)
          .send({ from: accounts[0] });
      }

      localStorage.setItem("currentAccount", accounts[0]);
      localStorage.setItem(
        accounts[0],
        JSON.stringify({
          role,
          name,
          age,
          gender,
          bloodGroup,
          phone,
          licenseNumber,
          hospitalName,
          specialization,
        })
      );

      setMessage("Registration Successful!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setMessage("Registration failed. Maybe already registered?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={classes.root}>
      <Card className={classes.card}>
        <Box className={classes.leftSection}>
          <Typography variant="h3" component="h3">
            We at DMed are always fully focused on helping your patients
          </Typography>
          <Typography variant="h5" component="h5" style={{ color: '#1a237e', marginBottom: '2rem' }}>
            Create Account
          </Typography>
          <img src="/stethoscope.svg" alt="Medical Icon" style={{ width: '120px', marginTop: '2rem' }} />
        </Box>

        <Box className={classes.rightSection}>
          <Button
            variant="outlined"
            fullWidth
            className={classes.walletButton}
            onClick={connectWallet}
          >
            {walletAddress ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
          </Button>

          <div className={classes.roleToggle}>
            <Button
              fullWidth
              variant={role === 'patient' ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setRole('patient')}
            >
              Patient
            </Button>
            <Button
              fullWidth
              variant={role === 'doctor' ? 'contained' : 'outlined'}
              color="primary"
              onClick={() => setRole('doctor')}
            >
              Doctor
            </Button>
          </div>

          <form className={classes.form} onSubmit={handleSubmit}>
            <TextField
              label="Full Name"
              variant="outlined"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            {role === 'patient' && (
              <>
                <TextField
                  label="Age"
                  type="number"
                  variant="outlined"
                  fullWidth
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
                <TextField
                  select
                  variant="outlined"
                  fullWidth
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </TextField>
                <TextField
                  label="Blood Group"
                  variant="outlined"
                  fullWidth
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  required
                />
              </>
            )}

            {role === 'doctor' && (
              <>
                <TextField
                  label="License Number"
                  variant="outlined"
                  fullWidth
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
                <TextField
                  label="Hospital Name"
                  variant="outlined"
                  fullWidth
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  required
                />
                <TextField
                  label="Specialization"
                  variant="outlined"
                  fullWidth
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  required
                />
              </>
            )}

            <TextField
              label="Phone Number"
              variant="outlined"
              fullWidth
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              className={classes.submitButton}
              disabled={!walletAddress || loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          {message && (
            <Typography color={message.includes("Successful") ? "primary" : "error"} 
              style={{ marginTop: '1rem', textAlign: 'center' }}>
              {message}
            </Typography>
          )}

          <Box style={{ textAlign: 'center', marginTop: '1rem', color: '#666' }}>
            Already have an Account?{' '}
            <Button
              color="primary"
              onClick={() => navigate('/login')}
              style={{ textTransform: 'none' }}
            >
              Log in
            </Button>
          </Box>
        </Box>
      </Card>
    </div>
  );
}

export default Home;