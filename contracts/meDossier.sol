// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MeDossier {
    enum Role { None, Patient, Doctor }
    
    struct Patient {
        string name;
        string dob;
        string gender;
        string bloodGroup;
        string phone;
    }

    struct Doctor {
        string name;
        string specialization;
        string hospital;
        string phone;
        string licenseNumber;
    }

    struct MedicalRecord {
        string doctorName;
        string reason;
        string date;
        string ipfsHash;
    }

    // Core mappings
    mapping(address => Patient) private patients;
    mapping(address => Doctor) private doctors;
    mapping(address => Role) public userRoles;
    mapping(address => MedicalRecord[]) private patientRecords;
    
    // Access control mappings
    mapping(address => mapping(address => bool)) public accessPermissions;
    mapping(address => address[]) private accessRequests;
    mapping(address => mapping(address => bool)) public pendingRequests;
    
    // Doctor registry
    address[] private allDoctors;

    // Events
    event PatientRegistered(address indexed user);
    event DoctorRegistered(address indexed user);
    event RecordAdded(address indexed patient, uint256 recordId);
    event AccessGranted(address indexed patient, address indexed doctor);
    event AccessRevoked(address indexed patient, address indexed doctor);
    event AccessRequested(address indexed patient, address indexed doctor);

    // Modifiers
    modifier onlyPatient() {
        require(userRoles[msg.sender] == Role.Patient, "Only patients can call this");
        _;
    }

    modifier onlyDoctor() {
        require(userRoles[msg.sender] == Role.Doctor, "Only doctors can call this");
        _;
    }

    modifier validPatient(address _patient) {
        require(userRoles[_patient] == Role.Patient, "Invalid patient address");
        _;
    }

    // Patient Registration
    function registerPatient(
        string calldata _name,
        string calldata _dob,
        string calldata _gender,
        string calldata _bloodGroup,
        string calldata _phone
    ) external {
        require(userRoles[msg.sender] == Role.None, "Already registered");
        
        patients[msg.sender] = Patient(_name, _dob, _gender, _bloodGroup, _phone);
        userRoles[msg.sender] = Role.Patient;
        emit PatientRegistered(msg.sender);
    }

    // Doctor Registration
    function registerDoctor(
        string calldata _name,
        string calldata _specialization,
        string calldata _hospital,
        string calldata _phone,
        string calldata _licenseNumber
    ) external {
        require(userRoles[msg.sender] == Role.None, "Already registered");
        
        doctors[msg.sender] = Doctor(_name, _specialization, _hospital, _phone, _licenseNumber);
        userRoles[msg.sender] = Role.Doctor;
        allDoctors.push(msg.sender);
        emit DoctorRegistered(msg.sender);
    }

    // Access Management
    function requestAccess(address _patient) external onlyDoctor validPatient(_patient) {
        require(!pendingRequests[_patient][msg.sender], "Request already pending");
        
        accessRequests[_patient].push(msg.sender);
        pendingRequests[_patient][msg.sender] = true;
        emit AccessRequested(_patient, msg.sender);
    }

    function grantAccess(address _doctor) external onlyPatient {
        require(pendingRequests[msg.sender][_doctor], "No pending request");
        
        accessPermissions[msg.sender][_doctor] = true;
        pendingRequests[msg.sender][_doctor] = false;
        _removeRequest(msg.sender, _doctor);
        emit AccessGranted(msg.sender, _doctor);
    }

    function revokeAccess(address _doctor) external onlyPatient {
        accessPermissions[msg.sender][_doctor] = false;
        emit AccessRevoked(msg.sender, _doctor);
    }

    function rejectRequest(address _doctor) external onlyPatient {
        require(pendingRequests[msg.sender][_doctor], "No pending request");
        pendingRequests[msg.sender][_doctor] = false;
        _removeRequest(msg.sender, _doctor);
    }

    // Medical Records
    function addMedicalRecord(
        address _patient,
        string calldata _doctorName,
        string calldata _reason,
        string calldata _date,
        string calldata _ipfsHash
    ) external onlyDoctor validPatient(_patient) {
        require(accessPermissions[_patient][msg.sender], "Access not granted");
        
        uint256 recordId = patientRecords[_patient].length;
        patientRecords[_patient].push(MedicalRecord(_doctorName, _reason, _date, _ipfsHash));
        emit RecordAdded(_patient, recordId);
    }

    // View Functions
    function getPatientDetails(address _user) external view returns (
        string memory name,
        string memory dob,
        string memory gender,
        string memory bloodGroup,
        string memory phone
    ) {
        require(userRoles[_user] == Role.Patient, "Not a patient");
        Patient memory p = patients[_user];
        return (p.name, p.dob, p.gender, p.bloodGroup, p.phone);
    }

    function getDoctorDetails(address _user) external view returns (
        string memory name,
        string memory specialization,
        string memory hospital,
        string memory phone,
        string memory licenseNumber
    ) {
        require(userRoles[_user] == Role.Doctor, "Not a doctor");
        Doctor memory d = doctors[_user];
        return (d.name, d.specialization, d.hospital, d.phone, d.licenseNumber);
    }

    function getAccessRequests() external view onlyPatient returns (address[] memory) {
        return accessRequests[msg.sender];
    }

    function getApprovedDoctors(address _patient) external view validPatient(_patient) returns (address[] memory) {
        address[] memory approved = new address[](allDoctors.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allDoctors.length; i++) {
            if (accessPermissions[_patient][allDoctors[i]]) {
                approved[count] = allDoctors[i];
                count++;
            }
        }
        
        // Resize array
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = approved[i];
        }
        
        return result;
    }

    function getRecordsCount(address _patient) external view validPatient(_patient) returns (uint256) {
        return patientRecords[_patient].length;
    }

    function getPatientRecord(address _patient, uint256 _index) external view returns (
        string memory doctorName,
        string memory reason,
        string memory date,
        string memory ipfsHash
    ) {
        require(accessPermissions[_patient][msg.sender] || msg.sender == _patient, "No access");
        MedicalRecord memory record = patientRecords[_patient][_index];
        return (record.doctorName, record.reason, record.date, record.ipfsHash);
    }

    function hasAccess(address _patient, address _doctor) external view returns (bool) {
        return accessPermissions[_patient][_doctor];
    }

    function getAllDoctors() external view returns (address[] memory) {
        return allDoctors;
    }

    // Private Helper Functions
    function _removeRequest(address _patient, address _doctor) private {
        address[] storage requests = accessRequests[_patient];
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i] == _doctor) {
                requests[i] = requests[requests.length - 1];
                requests.pop();
                break;
            }
        }
    }
}