import React, { useEffect, useRef, useState } from "react";
import { 
  Navbar, Nav, Button, Alert, Spinner, Container, Row, Col, Modal, ProgressBar
} from "react-bootstrap";
import { withStyles, makeStyles } from "@material-ui/core/styles";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  withTheme,
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
import PropTypes from 'prop-types';
var CryptoJS = require("crypto-js");

window.Buffer = Buffer;

function PatientsDashboard() {
  const [activeTab, setActiveTab] = useState("details");
  const [records, setRecords] = useState([]);
  const [currentAccount, setCurrentAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [patientInfo, setPatientInfo] = useState({
    name: "", dob: "", gender: "", bloodGroup: "", phone: "",
  });
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [accessList, setAccessList] = useState([]);

  // Material-UI styles
  const useStyles = makeStyles({
    table: { minWidth: 700 },
    root: { width: "100%" },
    container: { maxHeight: 440 },
  });
  const classes = useStyles();

  const StyledTableCell = withStyles((theme) => ({
    head: { 
      backgroundColor: '#1a237e',  // Light blue-gray color from your design
      color: '#e3eeff',            // Dark blue text color
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

  // Data fetching effect (unchanged)
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

        const patient = await contract.methods.getPatientDetails(account).call();
        
        if (mountedRef.current) {
          setPatientInfo({
            name: patient[0],
            dob: patient[1],
            gender: patient[2],
            bloodGroup: patient[3],
            phone: patient[4],
          });

          localStorage.setItem("name", patient[0]);
          localStorage.setItem("dob", patient[1]);
          localStorage.setItem("gender", patient[2]);
          localStorage.setItem("bloodgroup", patient[3]);
          localStorage.setItem("phone", patient[4]);
        }

        await getPatientRecord(contract, account);
      } catch (err) {
        if (mountedRef.current) {
          setError("Error loading patient data: " + err.message);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchWalletAndData();
  }, [navigate]);

  // getPatientRecord (unchanged)
  const getPatientRecord = async (contract, account) => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError("");
      
      const recordCount = await contract.methods
        .getRecordsCount(account)
        .call({ from: account });

      const recordsList = [];
      for (let i = 0; i < recordCount; i++) {
        const record = await contract.methods
          .getPatientRecord(account, i)
          .call({ from: account });
        recordsList.push({
          dname: record[0],
          reason: record[1],
          visitedDate: record[2],
          ipfs: record[3]
        });
      }
      
      if (mountedRef.current) {
        setRecords(recordsList);
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

  const decrypt = (hash) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(decode(hash).toString(), "dmr").toString(CryptoJS.enc.Utf8);
      return decrypted.slice(1, -1);
    } catch {
      return `${process.env.REACT_APP_LIGHTHOUSE_GATEWAY}${hash}`;
    }
  };

  const grantAccess = async (doctorAddress) => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError("");
      const instance = await getContractInstance();
      if (!instance) return;

      const { contract } = instance;
      await contract.methods
        .grantAccess(doctorAddress)
        .send({ from: currentAccount });
      
      if (mountedRef.current) {
        setSuccess("Access granted successfully!");
      }
    } catch (error) {
      if (mountedRef.current) {
        setError("Error granting access: " + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const revokeAccess = async (doctorAddress) => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError("");
      const instance = await getContractInstance();
      if (!instance) return;

      const { contract } = instance;
      await contract.methods
        .revokeAccess(doctorAddress)
        .send({ from: currentAccount });
      
      if (mountedRef.current) {
        setSuccess("Access revoked successfully!");
      }
    } catch (error) {
      if (mountedRef.current) {
        setError("Error revoking access: " + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentAccount");
    navigate("/");
  };

  // Add this function to fetch doctors with access
  const fetchAccessList = async () => {
    const instance = await getContractInstance();
    const { contract } = instance;
    
    // Get all doctor addresses (you'll need to implement this in your contract)
    // Then filter those who have access
    const doctors = await contract.methods.getAllDoctors().call();
    const withAccess = [];
    
    for (const doctor of doctors) {
      const hasAccess = await contract.methods.hasAccess(currentAccount, doctor).call();
      if (hasAccess) {
        const details = await contract.methods.getDoctorDetails(doctor).call();
        withAccess.push({
          address: doctor,
          name: details[0],
          specialization: details[1]
        });
      }
    }
    
    setAccessList(withAccess);
  };

  const Details = () => (
    <div className="Details">
      <h5  style={{
        fontWeight: 600, /* Semi-bold (not 700 which is full bold) */
        color: '#555', /* Dark gray - more subtle than black */
        fontStyle: 'italic', /* Optional subtle emphasis */
        marginBottom: '1.5rem'
      }}>Medical Records are important and securely stored in DMed</h5>
      <div className="card">
        <h2>Your Details</h2>
        <hr />
        <div style={{ 
        textAlign: 'left',
        marginLeft: '20px',
        lineHeight: '2.2'
      }}><b style={{ color: '#212c9f'}}>Account Address:</b> <span>{currentAccount}</span></div>
        <div className="details" style={{ 
        textAlign: 'left',
        marginLeft: '20px',
        lineHeight: '2.2'
      }}>
          <b style={{ color: '#212c9f' }}>Name:</b> <span>{patientInfo.name || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Phone:</b> <span>{patientInfo.phone || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Gender:</b> <span>{patientInfo.gender || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Date of Birth:</b> <span>{patientInfo.dob || 'Not available'}</span><br />
          <b style={{ color: '#212c9f' }}>Blood Group:</b> <span>{patientInfo.bloodGroup || 'Not available'}</span>
        </div>
      </div>
    </div>
  );

  const Report = () => (
    <div className="Report">
      <h2>Your Medical Records</h2>
      {loading ? (
        <Spinner animation="border" />
      ) : records.length === 0 ? (
        <p>No records found</p>
      ) : (
        <TableContainer component={Paper}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <StyledTableCell>#</StyledTableCell>
                <StyledTableCell>Doctor Name</StyledTableCell>
                <StyledTableCell>Record</StyledTableCell>
                <StyledTableCell>Reason</StyledTableCell>
                <StyledTableCell>Date</StyledTableCell>
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
                    <a href={decrypt(record.ipfs)} target="_blank" rel="noopener noreferrer">
                      View Record
                    </a>
                  </TableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );

  const AccessControl = () => {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [approvedDoctors, setApprovedDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fetchAccessData = async () => {
      try {
        setLoading(true);
        const instance = await getContractInstance();
        const { contract } = instance;

        // Fetch pending requests - no parameters, just specify sender
        const requestAddresses = await contract.methods
          .getAccessRequests()
          .call({ from: currentAccount });  // <-- This is the key change
        
        const requestsWithDetails = await Promise.all(
          requestAddresses.map(async (address) => {
            const details = await contract.methods.getDoctorDetails(address).call();
            return {
              address,
              name: details[0],
              specialization: details[1],
              hospital: details[2]
            };
          })
        );

        // Fetch approved doctors - this one does take a parameter
        const approvedAddresses = await contract.methods
          .getApprovedDoctors(currentAccount)
          .call();
        
        const approvedWithDetails = await Promise.all(
          approvedAddresses.map(async (address) => {
            const details = await contract.methods.getDoctorDetails(address).call();
            return {
              address,
              name: details[0],
              specialization: details[1],
              hospital: details[2]
            };
          })
        );

        setPendingRequests(requestsWithDetails);
        setApprovedDoctors(approvedWithDetails);
      } catch (err) {
        setError("Failed to load access data: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleGrantAccess = async (doctorAddress) => {
      try {
        setLoading(true);
        const instance = await getContractInstance();
        const { contract } = instance;

        await contract.methods
          .grantAccess(doctorAddress)
          .send({ from: currentAccount });

        setSuccess("Access granted successfully!");
        await fetchAccessData();
      } catch (err) {
        setError("Failed to grant access: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleRejectRequest = async (doctorAddress) => {
      try {
        setLoading(true);
        const instance = await getContractInstance();
        const { contract } = instance;

        await contract.methods
          .rejectRequest(doctorAddress)
          .send({ from: currentAccount });

        setSuccess("Request rejected successfully!");
        await fetchAccessData();
      } catch (err) {
        setError("Failed to reject request: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleRevokeAccess = async (doctorAddress) => {
      try {
        setLoading(true);
        const instance = await getContractInstance();
        const { contract } = instance;

        await contract.methods
          .revokeAccess(doctorAddress)
          .send({ from: currentAccount });

        setSuccess("Access revoked successfully!");
        await fetchAccessData();
      } catch (err) {
        setError("Failed to revoke access: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchAccessData();
    }, [currentAccount]);

    return (
      <div className="AccessControl">
        <h3>Access Control</h3>
        
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Pending Requests Section */}
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Pending Access Requests</h5>
            {loading ? (
              <Spinner animation="border" />
            ) : pendingRequests.length === 0 ? (
              <p>No pending access requests</p>
            ) : (
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Doctor Name</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Specialization</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Hospital</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Address</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((request, index) => (
                    <tr key={index}>
                      <td>{request.name}</td>
                      <td>{request.specialization}</td>
                      <td>{request.hospital}</td>
                      <td className="text-truncate" style={{ maxWidth: '100px' }}>
                        {request.address}
                      </td>
                      <td>
                        <Button
                          variant="success"
                          size="sm"
                          className="me-2"
                          onClick={() => handleGrantAccess(request.address)}
                          disabled={loading}
                        >
                          Grant
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRejectRequest(request.address)}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>

        {/* Approved Doctors Section */}
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Approved Doctors</h5>
            {loading ? (
              <Spinner animation="border" />
            ) : approvedDoctors.length === 0 ? (
              <p>No doctors have access to your records</p>
            ) : (
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Doctor Name</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Specialization</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Hospital</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Address</th>
                    <th style={{ backgroundColor: '#212c9f', color: 'white' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDoctors.map((doctor, index) => (
                    <tr key={index}>
                      <td>{doctor.name}</td>
                      <td>{doctor.specialization}</td>
                      <td>{doctor.hospital}</td>
                      <td className="text-truncate" style={{ maxWidth: '100px' }}>
                        {doctor.address}
                      </td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRevokeAccess(doctor.address)}
                          disabled={loading}
                        >
                          Revoke Access
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="patient_main">
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
  <span style={{ color: '#333', fontWeight: 600 }}>{patientInfo.name || 'User'}</span>
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
                <Nav.Link eventKey="records">Medical Records</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="access">Access Control</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
          <Col md={9}>
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            
            {activeTab === "details" && <Details />}
            {activeTab === "records" && <Report />}
            {activeTab === "access" && <AccessControl />}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default PatientsDashboard;