import React, { useEffect, useRef, useState } from "react";
import { 
  Navbar, Nav, Button, Alert, Spinner, Container, Row, Col, Modal, ProgressBar
} from "react-bootstrap";
import { withStyles, makeStyles } from "@material-ui/core/styles";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import lighthouse from '@lighthouse-web3/sdk';
import "bootstrap/dist/css/bootstrap.min.css";
import stethoscope from "./stethoscope.svg";
import "./general.css";
import "./patient.css";
import Web3 from "web3";
import getContractInstance from "../contractInstance";
import { Buffer } from 'buffer';
var CryptoJS = require("crypto-js");

window.Buffer = Buffer;

function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState("details");
  const [files, setFiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [currentAccount, setCurrentAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [doctorInfo, setDoctorInfo] = useState({
    name: "", specialization: "", phone: "", hospital: ""
  });
  const [uploadProgress, setUploadProgress] = useState({});
  const [batchCids, setBatchCids] = useState([]);
  const [patientAddress, setPatientAddress] = useState("");
  const [showCidModal, setShowCidModal] = useState(false);
  const [accessHistory, setAccessHistory] = useState([]);
  const [accessStatus, setAccessStatus] = useState('unknown');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  // Refs for form inputs
  const dnameRef = useRef();
  const reasonRef = useRef();
  const dateRef = useRef();

  // Material-UI styles
  const useStyles = makeStyles({
    table: { minWidth: 700 },
    root: { width: "100%" },
    container: { maxHeight: 440 },
  });
  const classes = useStyles();

  const StyledTableCell = withStyles((theme) => ({
    head: { 
      backgroundColor: theme.palette.info.main, 
      color: theme.palette.common.white,
      fontWeight: 'bold'
    },
    body: { fontSize: 14 },
  }))(TableCell);

  const StyledTableRow = withStyles((theme) => ({
    root: {
      "&:nth-of-type(odd)": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:hover": {
        backgroundColor: theme.palette.action.selected,
      },
    },
  }))(TableRow);

  // Encoding functions
  const encode = (data) => Web3.utils.utf8ToHex(data);
  const decode = (data) => Web3.utils.hexToUtf8(data);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Data fetching effect
  useEffect(() => {
    const fetchWalletAndData = async () => {
      if (!mountedRef.current) return;
      
      setLoading(true);
      setError("");
      try {
        const instance = await getContractInstance();
        if (!instance) {
          setError("Could not connect to blockchain. Please check your wallet connection.");
          return;
        }

        const { contract, accounts } = instance;
        if (!accounts || accounts.length === 0) {
          setError("No wallet connected. Redirecting to home.");
          navigate("/");
          return;
        }

        const account = accounts[0];
        if (mountedRef.current) {
          setCurrentAccount(account);
        }

        const doctor = await contract.methods.getDoctorDetails(account).call();
        
        if (mountedRef.current) {
          setDoctorInfo({
            name: doctor[0],
            specialization: doctor[1],
            phone: doctor[2],
            hospital: doctor[3],
          });

          localStorage.setItem("name", doctor[0]);
          localStorage.setItem("specialization", doctor[1]);
          localStorage.setItem("phone", doctor[2]);
          localStorage.setItem("hospital", doctor[3]);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError("Error loading doctor data: " + err.message);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchWalletAndData();
  }, [navigate]);

  // Fetch access history when account changes
  useEffect(() => {
    const fetchAccessHistory = async () => {
      if (!currentAccount) return;
      
      try {
        const instance = await getContractInstance();
        const { contract } = instance;
        
        const events = await contract.getPastEvents('RecordAdded', {
          filter: { doctor: currentAccount },
          fromBlock: 0,
          toBlock: 'latest'
        });
        
        const enrichedEvents = await Promise.all(
          events.map(async (event) => {
            try {
              const patientDetails = await contract.methods
                .getPatientDetails(event.returnValues.patient)
                .call();
              return {
                ...event,
                patientName: patientDetails[0] || 'Unknown Patient'
              };
            } catch {
              return {
                ...event,
                patientName: 'Unknown Patient'
              };
            }
          })
        );
        
        setAccessHistory(enrichedEvents);
      } catch (error) {
        console.error("Error fetching access history:", error);
      }
    };
    
    fetchAccessHistory();
  }, [currentAccount]);



  const getPatientRecords = async () => {
    if (!patientAddress) {
      setError("Please enter a patient address");
      return;
    }

    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError("");
      
      const instance = await getContractInstance();
      if (!instance) {
        setError("Could not connect to blockchain");
        return;
      }

      const { contract, web3 } = instance;
      
      // Validate address
      if (!web3.utils.isAddress(patientAddress)) {
        setError("Invalid patient address");
        return;
      }

      const hasAccess = await contract.methods
        .hasAccess(patientAddress, currentAccount)
        .call({ from: currentAccount });

      if (!hasAccess) {
        setError("You don't have access to this patient's records");
        setRecords([]);
        return;
      }

      const recordCount = await contract.methods
        .getRecordsCount(patientAddress)
        .call({ from: currentAccount });

      const recordsList = [];
      for (let i = 0; i < recordCount; i++) {
        const record = await contract.methods
          .getPatientRecord(patientAddress, i)
          .call({ from: currentAccount });
        recordsList.push({
          dname: record[0],
          reason: record[1],
          visitedDate: record[2],
          ipfs: record[3]
        });
      }
      
      if (mountedRef.current) {
        setRecords(recordsList);
        setSuccess(`Found ${recordsList.length} records for patient`);
      }
    } catch (error) {
      if (mountedRef.current) {
        setError("Error fetching records: " + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    
    // Validate each file
    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        setError(`File ${file.name} is not a PDF, JPG, or PNG`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 10MB)`);
        return;
      }
    }

    setFiles(selectedFiles);
    setError("");
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!files.length) {
      setError('Please select at least one file');
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    setBatchCids([]);
    setUploadProgress({});

    try {
      const uploadPromises = files.map(file => 
        uploadFileWithProgress(file)
      );

      await Promise.all(uploadPromises);
      setSuccess(`${files.length} files uploaded successfully!`);
      setFiles([]);
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadFileWithProgress = async (file) => {
    return new Promise(async (resolve, reject) => {
      try {
        const progressCallback = (progress) => {
          const percent = Math.round((progress.uploaded / progress.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percent
          }));
        };

        // Try Lighthouse first
        try {
          const output = await lighthouse.upload(
            file,
            process.env.REACT_APP_LIGHTHOUSE_API_KEY,
            false,
            null,
            progressCallback
          );

          if (output?.data?.Hash) {
            setBatchCids(prev => [...prev, {
              name: file.name,
              cid: output.data.Hash
            }]);
            return resolve();
          }
        } catch (lighthouseErr) {
          console.log(`Lighthouse failed for ${file.name}, trying fallback`);
        }

        // Fallback to direct API
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('https://node.lighthouse.storage/api/v0/add', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${process.env.REACT_APP_LIGHTHOUSE_API_KEY}`,
            'Accept': 'application/json'
          },
          body: formData,
        });
        const data = await res.json();
        
        if (data?.Hash) {
          setBatchCids(prev => [...prev, {
            name: file.name,
            cid: data.Hash
          }]);
          return resolve();
        }
        throw new Error(`Failed to upload ${file.name}`);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleRecordUpload = async (e) => {
  e.preventDefault();
  if (!batchCids.length) {
    setError('Please upload files to IPFS first');
    return;
  }

  // Get values from refs
  const dname = dnameRef.current.value;
  const reason = reasonRef.current.value;
  const date = dateRef.current.value;

  if (!patientAddress || !dname || !reason || !date) {
    setError('Please fill all fields');
    return;
  }

  try {
    setLoading(true);
    setError("");
    const instance = await getContractInstance();
    if (!instance) {
      setError("Could not connect to blockchain");
      return;
    }

    const { contract, web3 } = instance;
    
    // Check if patient address is valid
    if (!web3.utils.isAddress(patientAddress)) {
      throw new Error("Invalid patient address");
    }

    // Process each CID
    for (const item of batchCids) {
      const ipfsUrl = `${process.env.REACT_APP_LIGHTHOUSE_GATEWAY}${item.cid}`;
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(ipfsUrl), "dmr").toString();
      const encoded = encode(encrypted);

      try {
        // First check if doctor has access
        const hasAccess = await contract.methods
          .hasAccess(patientAddress, currentAccount)
          .call({ from: currentAccount });

        if (!hasAccess) {
          throw new Error("You don't have permission to add records for this patient");
        }

        // Estimate gas with retry logic
        let gasEstimate;
        try {
          gasEstimate = await contract.methods
            .addMedicalRecord(patientAddress, dname, reason, date, encoded)
            .estimateGas({ from: currentAccount });
        } catch (estimateError) {
          console.warn("Gas estimation failed, using fallback", estimateError);
          gasEstimate = 500000; // Fallback gas limit
        }

        // Add 30% buffer to handle network fluctuations
        const gasLimit = Math.floor(gasEstimate * 1.3);

        const receipt = await contract.methods
          .addMedicalRecord(patientAddress, dname, reason, date, encoded)
          .send({ 
            from: currentAccount,
            gas: gasLimit
          });

        if (!receipt.status) {
          throw new Error("Transaction reverted by the EVM");
        }
      } catch (txError) {
        console.error("Transaction error:", txError);
        if (txError.message.includes("reverted")) {
          throw new Error("Transaction failed: The operation was rejected by the contract. Possible reasons: 1) You don't have permission, 2) Invalid patient address, 3) Contract constraints not met");
        }
        throw txError;
      }
    }

    setSuccess(`${batchCids.length} records successfully added to blockchain!`);
    
    // Reset form
    dnameRef.current.value = '';
    reasonRef.current.value = '';
    dateRef.current.value = '';
    setPatientAddress(''); // Reset patient address
    setBatchCids([]);
  } catch (error) {
    let errorMessage = "Error uploading records to blockchain: ";
    
    if (error.message.includes("reverted")) {
      errorMessage += "The operation was rejected by the contract. Possible reasons:\n";
      errorMessage += "1. You don't have permission to add records for this patient\n";
      errorMessage += "2. The patient address is invalid or not registered\n";
      errorMessage += "3. The contract constraints were not met";
    } else if (error.message.includes("gas")) {
      errorMessage += "Gas estimation failed. Please try again later.";
    } else {
      errorMessage += error.message;
    }
    
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const decrypt = (hash) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(decode(hash).toString(), "dmr").toString(CryptoJS.enc.Utf8);
      return decrypted.slice(1, -1);
    } catch {
      return `${process.env.REACT_APP_LIGHTHOUSE_GATEWAY}${hash}`;
    }
  };

  const handleCopyCid = () => {
    setSuccess("CID copied to clipboard!");
  };

  const handleCloseCidModal = () => {
    setShowCidModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentAccount");
    navigate("/");
  };

  const removeUploadedFile = (index) => {
    setBatchCids(prev => prev.filter((_, i) => i !== index));
    setSuccess(`File removed successfully`);
  };

  const Details = () => (
    <div className="Details">
      <h5  style={{
        fontWeight: 600, /* Semi-bold (not 700 which is full bold) */
        color: '#555', /* Dark gray - more subtle than black */
        fontStyle: 'italic', /* Optional subtle emphasis */
        marginBottom: '1.5rem'
      }}>Doctor Dashboard - Manage Patient Records</h5>
      <div className="card">
        <h3>Your Details</h3>
        <hr />
        <div style={{ 
        textAlign: 'left',
        marginLeft: '20px',
        lineHeight: '2.2'
      }}><b style={{ color: '#212c9f' }}>Account Address:</b> <span>{currentAccount}</span></div>
        <div className="details" style={{ 
        textAlign: 'left',
        marginLeft: '20px',
        lineHeight: '2.2'
      }}>
          <b style={{ color: '#212c9f' }}>Name:</b> <span>{doctorInfo.name || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Phone:</b> <span>{doctorInfo.phone || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Specialization:</b> <span>{doctorInfo.specialization || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Hospital:</b> <span>{doctorInfo.hospital || 'Not available'}</span>
        </div>
      </div>
    </div>
  );

const Upload = () => {
  const checkAccessStatus = async () => {
    if (!patientAddress) {
      setError('Please enter a patient address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const instance = await getContractInstance();
      const { contract, web3 } = instance;
      
      if (!web3.utils.isAddress(patientAddress)) {
        setError('Invalid Ethereum address format');
        return;
      }

      const hasAccess = await contract.methods
        .hasAccess(patientAddress, currentAccount)
        .call({ from: currentAccount });

      if (hasAccess) {
        setAccessStatus('granted');
        setSuccess('Access verified! You can now upload records');
      } else {
        setAccessStatus('denied');
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setError(`Access check failed: ${error.message}`);
      setAccessStatus('unknown');
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!patientAddress) {
      setError('Please enter a patient address');
      return;
    }

    try {
      setRequestingAccess(true);
      setError('');
      
      const instance = await getContractInstance();
      const { contract } = instance;
      
      await contract.methods
        .requestAccess(patientAddress)
        .send({ from: currentAccount });

      setAccessStatus('pending');
      setSuccess('Access request sent to patient. Please wait for approval.');
    } catch (error) {
      setError(`Request failed: ${error.message}`);
    } finally {
      setRequestingAccess(false);
    }
  };
  return (
     <div className="ReportUpload">
      <h5 style={{ 
  textAlign: 'center', 
  margin: '1rem 0',
  width: '100%'
}}>
  Upload patient records to Lighthouse Storage
</h5>
      <div className="card small-card">
        {/* Access Control Section */}
        <div className="access-control mb-4">
          <label style={{ color: '#212c9f', fontWeight: 500 }}>
  Patient Address
</label>
          <div className="d-flex gap-2 mb-2">
            <input 
              type="text" 
              value={patientAddress}
              onChange={(e) => {
                setPatientAddress(e.target.value);
                setAccessStatus('unknown');
              }}
              placeholder="Enter patient wallet address (0x...)"
              className="form-control"
              disabled={loading || requestingAccess}
            />
            <Button
              variant="primary"
              onClick={checkAccessStatus}
              disabled={!patientAddress || loading || requestingAccess}
              style={{
                backgroundColor: '#212c9f', // Your brand purple
                borderColor: '#1a237e',    // Darker purple border
                color: 'white',
                ':hover': {
                  backgroundColor: '#1a237e', // Darker on hover
                  borderColor: '#121a6b'
                },
                ':disabled': {
                  backgroundColor: '#b3b9e6', // Light purple when disabled
                  opacity: 0.7
                }
              }}
            >
              {loading ? (
                <Spinner 
                  as="span" 
                  animation="border" 
                  size="sm" 
                  style={{ color: 'white' }} // White spinner
                />
              ) : 'Check Access'}
            </Button>
          </div>

          {/* Status Messages */}
          {!error && accessStatus === 'unknown' && (
            <Alert variant="info" className="mb-3">
              Enter patient address and check access status
            </Alert>
          )}
          
          {accessStatus === 'granted' && (
            <Alert variant="success" className="mb-3">
              <i className="bi bi-check-circle me-2"></i>
              Access granted - You can now upload records
            </Alert>
          )}
          
          {accessStatus === 'denied' && (
            <div className="mb-3">
              <Alert variant="danger" className="mb-2">
                <i className="bi bi-exclamation-triangle me-2"></i>
                You don't have permission to access these records
              </Alert>
              <Button
                variant="warning"
                onClick={requestAccess}
                disabled={requestingAccess}
              >
                {requestingAccess ? (
                  <Spinner as="span" animation="border" size="sm" />
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>
                    Request Access
                  </>
                )}
              </Button>
            </div>
          )}

          {accessStatus === 'pending' && (
            <Alert variant="info" className="mb-3">
              <i className="bi bi-hourglass me-2"></i>
              Access request pending patient approval
            </Alert>
          )}
        </div>

        {/* Only show upload form if access is granted */}
        {accessStatus === 'granted' && (
          <>
            <div className="upload">
              <label>Upload to IPFS via Lighthouse</label>
              <form onSubmit={handleFileUpload}>
                <input 
                  type="file" 
                  onChange={handleFileChange} 
                  className="form-control mb-2"
                  disabled={loading}
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                
                {files.length > 0 && (
                  <div className="mb-3">
                    <h6>Selected Files:</h6>
                    <ul className="list-group">
                      {files.map((file, index) => (
                        <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                          {file.name}
                          <span className="badge rounded-pill"
                          style={{ 
                          backgroundColor: '#212c9f',  // Purple
                          color: 'white',
                        }}>
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mb-3">
                    <h6>Upload Progress:</h6>
                    {files.map((file, index) => (
                      <div key={index} className="mb-2">
                        <div className="d-flex justify-content-between">
                          <span>{file.name}</span>
                          <span>{uploadProgress[file.name] || 0}%</span>
                        </div>
                        <ProgressBar 
                          now={uploadProgress[file.name] || 0} 
                          label={`${uploadProgress[file.name] || 0}%`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  type="submit" 
                  variant="primary" 
                  className="mb-3"
                  disabled={!files.length || loading}
                  style={{
                  background: '#212c9f',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  padding: '10px 25px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(74, 107, 255)',
                    transform: 'translateY(-2px)'
                  }
                }}
                >
                  {loading ? (
                    <><Spinner as="span" animation="border" size="sm" /> Uploading...</>
                  ) : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
                </Button>
              </form>
            </div>

            {/* Record Metadata Form */}
            {batchCids.length > 0 && (
              <form onSubmit={handleRecordUpload}>
                <label>Upload to Blockchain</label>
                <input 
                  type="text" 
                  placeholder="Doctor Name" 
                  ref={dnameRef}
                  className="form-control mb-2"
                  disabled={loading}
                  required
                />
                <input 
                  type="text" 
                  placeholder="Reason for visit" 
                  ref={reasonRef}
                  className="form-control mb-2"
                  disabled={loading}
                  required
                />
                <input 
                  type="date" 
                  ref={dateRef}
                  className="form-control mb-3"
                  disabled={loading}
                  required
                />
                <Button 
                  type="submit"
                  variant="primary"
                  disabled={!batchCids.length || loading}
                >
                  {loading ? 'Processing...' : `Submit ${batchCids.length} Record${batchCids.length !== 1 ? 's' : ''}`}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
      
      {/* Show batch CIDs */}
      {batchCids.length > 0 && (
        <div className="mt-3">
          <h5>Uploaded Files:</h5>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>File Name</th>
                <th>CID</th>
                <th>Link</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batchCids.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td className="text-truncate" style={{ maxWidth: '200px' }} title={item.cid}>
                    {item.cid}
                  </td>
                  <td>
                    <a 
                      href={`${process.env.REACT_APP_LIGHTHOUSE_GATEWAY}${item.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-info"
                    >
                      View
                    </a>
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeUploadedFile(index)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      {success && <Alert variant="success" className="mt-3">{success}</Alert>}
    </div>
  );
};

  const Report = () => {
    const [historyLoading, setHistoryLoading] = useState(false);

    return (
      <div className="Report">
        <h2>Patient Medical Records</h2>
        
        {/* Patient Records Section */}
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="card-title" style={{ color: '#212c9f' }}>View Patient Records</h4>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Enter patient address (0x...)"
                value={patientAddress}
                onChange={(e) => setPatientAddress(e.target.value)}
                className="form-control"
              />
              <Button 
                style={{
                  backgroundColor: '#212c9f', // Your brand purple
                  borderColor: '#1a237e',     // Slightly darker purple for border
                  color: 'white',
                  fontWeight: 500,
                  ':hover': {
                    backgroundColor: '#1a237e' // Darker on hover
                  }
                }}
                className="mt-2"
                onClick={getPatientRecords}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" /> Loading...
                  </>
                ) : "Get Records"}
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center">
                <Spinner animation="border" />
              </div>
            ) : records.length === 0 ? (
              <div className="alert alert-info">
                {patientAddress 
                  ? "No records found for this patient" 
                  : "Enter a patient address to view records"}
              </div>
            ) : (
              <TableContainer component={Paper}>
                <Table className={classes.table}>
                  <TableHead>
                     <TableRow>
                        <StyledTableCell style={{ backgroundColor: '#212c9f' }}>#</StyledTableCell>
                        <StyledTableCell style={{ backgroundColor: '#212c9f' }}>Doctor Name</StyledTableCell>
                        <StyledTableCell style={{ backgroundColor: '#212c9f' }}>Reason</StyledTableCell>
                        <StyledTableCell style={{ backgroundColor: '#212c9f' }}>Date</StyledTableCell>
                        <StyledTableCell style={{ backgroundColor: '#212c9f' }}>Record</StyledTableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((record, index) => (
                      <StyledTableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{record.dname}</TableCell>
                        <TableCell>{record.reason}</TableCell>
                        <TableCell>{record.visitedDate}</TableCell>
                        <TableCell>
                          <Button 
                            variant="info"
                            size="sm"
                            href={decrypt(record.ipfs)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                                backgroundColor: '#212c9f', // Your brand purple
                                borderColor: '#1a237e',     // Darker purple border
                                color: 'white',
                                ':hover': {
                                  backgroundColor: '#1a237e', // Darker on hover
                                  borderColor: '#121a6b'
                                }
                              }}
                          >
                            View Record
                          </Button>
                        </TableCell>
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>
        </div>

        {/* Access History Section */}
        {/* <div className="card">
          <div className="card-body">
            <h4 className="card-title" style={{ color: '#212c9f' }}>Your Access History</h4>
            {historyLoading ? (
              <div className="text-center">
                <Spinner animation="border" />
              </div>
            ) : accessHistory.length === 0 ? (
              <div className="alert alert-info">
                No access history found
              </div>
            ) : (
              <TableContainer component={Paper}>
                <Table className={classes.table}>
                  <TableHead>
                    <TableRow>
                      <StyledTableCell style={{ backgroundColor: '#212c9f', color: 'white' }}>Date</StyledTableCell>
                      <StyledTableCell style={{ backgroundColor: '#212c9f', color: 'white' }}>Patient</StyledTableCell>
                      <StyledTableCell style={{ backgroundColor: '#212c9f', color: 'white' }}>Patient Name</StyledTableCell>
                      <StyledTableCell style={{ backgroundColor: '#212c9f', color: 'white' }}>Record</StyledTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accessHistory.map((event, index) => (
                      <StyledTableRow key={index}>
                        <TableCell>
                          {new Date().toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {`${event.returnValues.patient.substring(0, 6)}...${event.returnValues.patient.substring(38)}`}
                        </TableCell>
                        <TableCell>
                          {event.patientName}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="info"
                            size="sm"
                            href={decrypt(record.ipfs)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                                backgroundColor: '#212c9f', // Your brand purple
                                borderColor: '#1a237e',     // Darker purple border
                                color: 'white',
                                ':hover': {
                                  backgroundColor: '#1a237e', // Darker on hover
                                  borderColor: '#121a6b'
                                }
                              }}
                          >
                            View Record
                          </Button>
                        </TableCell>
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>
        </div> */}
      </div>
    );
  };

  return (
    <div className="doctor_main">
      <Navbar bg="light" expand="lg">
        <Navbar.Brand style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "16px" }}>
                <img src={stethoscope} width="40" height="40" alt="logo" />
                <span style={{ fontWeight: "bold", color: "#212c9f", fontSize: "1.25rem" }}>
                  DMed
                </span>
          </Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end pe-4"> {/* Bootstrap padding-end class */}
  <Navbar.Text className="me-3" style={{ color: '#555', fontSize: '0.95rem' }}>
  <span style={{ color: '#212c9f', fontWeight: 500 }}>Signed in as:</span>{' '}
  <span style={{ color: '#333', fontWeight: 600 }}>{doctorInfo.name || 'Doctor'}</span>
</Navbar.Text>
  <Button variant="outline-danger" onClick={handleLogout}>
    Logout
  </Button>
</Navbar.Collapse>
      </Navbar>

      <Container fluid className="mt-4">
        <Row>
          <Col md={3}>
            <Nav 
              variant="pills" 
              className="flex-column"
              activeKey={activeTab}
              onSelect={(selectedKey) => setActiveTab(selectedKey)}
            >
              <Nav.Item>
                <Nav.Link eventKey="details">Details</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="records">View Records</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="upload">Upload Record</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
          <Col md={9}>
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            
            {activeTab === "details" && <Details />}
            {activeTab === "records" && <Report />}
            {activeTab === "upload" && <Upload />}
          </Col>
        </Row>
      </Container>

      <CidModal 
        cids={batchCids} 
        onClose={handleCloseCidModal}
        onCopy={handleCopyCid}
        show={showCidModal}
      />
    </div>
  );
}

export default DoctorDashboard;

const CidModal = ({ cids, onClose, onCopy, show }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = (cid, index) => {
    navigator.clipboard.writeText(cid);
    setCopiedIndex(index);
    onCopy();
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Modal show={show} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Upload Successful!</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Your files have been uploaded to IPFS with the following CIDs:</p>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>File Name</th>
              <th>CID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cids.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td className="text-truncate" style={{ maxWidth: '200px' }} title={item.cid}>
                  {item.cid}
                </td>
                <td>
                  <Button 
                    variant={copiedIndex === index ? "success" : "primary"}
                    onClick={() => handleCopy(item.cid, index)}
                    size="sm"
                    className="me-2"
                  >
                    {copiedIndex === index ? "✓ Copied" : "Copy"}
                  </Button>
                  <a 
                    href={`${process.env.REACT_APP_LIGHTHOUSE_GATEWAY}${item.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-info btn-sm"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};