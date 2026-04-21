// GatepassGenerator.js
import React, { useState, useEffect } from 'react';
import './GatepassGenerator.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// HARDCODED GOOGLE SHEETS CREDENTIALS
const GOOGLE_SHEETS_CONFIG = {
  apiKey: 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills',
  driverSheetName: 'DRIVER INFO'
};

const GatepassGenerator = ({ parties, gatepasses, onSubmit, onBack }) => {
  const [gatepassData, setGatepassData] = useState({
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    totalBoxes: 0,
    totalBags: 0,
    totalPolybags: 0,
    purpose: 'delivery',
    remarks: '',
    selectedBills: [],
    consolidatedRemarks: ''
  });

  const [bills, setBills] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillDetails, setSelectedBillDetails] = useState([]);
  const [generatedGatepass, setGeneratedGatepass] = useState(null);
  const [activeTab, setActiveTab] = useState('bills');
  
  // NEW FILTER STATES
  const [filterParty, setFilterParty] = useState('');
  const [filterMinBoxes, setFilterMinBoxes] = useState('');
  const [filterMaxBoxes, setFilterMaxBoxes] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [uniquePartiesList, setUniquePartiesList] = useState([]);

  // Function to extract first name and second name initials from party name
  const getPartyInitials = (partyName) => {
    if (!partyName) return '-';
    
    // Remove text in parentheses
    let cleanedName = partyName.replace(/\([^)]*\)/g, '').trim();
    
    // Split by spaces and filter out empty strings
    const words = cleanedName.split(' ').filter(word => word.length > 0);
    
    if (words.length === 0) return '-';
    if (words.length === 1) {
      // If only one word, take first 2 letters
      return words[0].substring(0, 2).toUpperCase();
    }
    
    // Take first letter of first word and first letter of second word
    const firstInitial = words[0].charAt(0).toUpperCase();
    const secondInitial = words[1].charAt(0).toUpperCase();
    
    return `${firstInitial}${secondInitial}`;
  };

  // Function to format packing details as a single string
  const getPackingDetails = (bill) => {
    const boxes = bill['Total Boxes'] || 0;
    const bags = bill['Total Bags'] || 0;
    const polybags = bill['Total Polybags'] || 0;
    
    const parts = [];
    if (boxes > 0) parts.push(`B:${boxes}`);
    if (bags > 0) parts.push(`G:${bags}`);
    if (polybags > 0) parts.push(`P:${polybags}`);
    
    return parts.length > 0 ? parts.join(' | ') : 'B:0 | G:0 | P:0';
  };

  // Function to check if a bill is selected
  const isBillSelected = (billNumber) => {
    return gatepassData.selectedBills.some(selected => selected['Bill Number'] === billNumber);
  };

  const fetchBillsFromSheet = async () => {
    setLoadingBills(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${sheetName}!A:T`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const parsedBills = rows.map(row => {
          const billData = {};
          headers.forEach((header, index) => {
            billData[header] = row[index] || '';
          });
          
          // Add initials to bill data
          billData['Party Initials'] = getPartyInitials(billData['Party Name']);
          
          if (billData['Bill Data (JSON)']) {
            try {
              const parsedJson = JSON.parse(billData['Bill Data (JSON)']);
              billData.parsedBillData = parsedJson;
            } catch (e) {
              console.error('Error parsing bill JSON:', e);
            }
          }
          
          return billData;
        });
        
        const availableBills = parsedBills.filter(bill => {
          const gatepassStatus = 
            bill['GATEPASS CREATED'] || 
            bill['Gatepass Created'] || 
            bill['gatepass created'] ||
            bill['GATEPASS_CREATED'] ||
            bill['Gatepass_Created'] ||
            '';
          
          const normalizedStatus = gatepassStatus.toString().trim().toUpperCase();
          return normalizedStatus !== 'YES';
        });
        
        const sortedBills = sortBills(availableBills, sortOrder);
        setBills(sortedBills);
        
        const uniqueParties = [...new Set(availableBills.map(bill => bill['Party Name']).filter(name => name))];
        setUniquePartiesList(uniqueParties);
        
        console.log('Available bills fetched:', availableBills.length);
        
        if (availableBills.length === 0) {
          alert('All bills have already been assigned to gatepasses. No available bills found.');
        }
      } else {
        setBills([]);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      alert(`Failed to fetch bills: ${error.message}`);
    } finally {
      setLoadingBills(false);
    }
  };

  const sortBills = (billsArray, order) => {
    return [...billsArray].sort((a, b) => {
      const billNumA = a['Bill Number'] || '';
      const billNumB = b['Bill Number'] || '';
      
      if (order === 'desc') {
        return billNumB.localeCompare(billNumA);
      } else {
        return billNumA.localeCompare(billNumB);
      }
    });
  };

  const applyFilters = (billsToFilter) => {
    let filtered = [...billsToFilter];
    
    if (filterParty) {
      filtered = filtered.filter(bill => bill['Party Name'] === filterParty);
    }
    
    if (filterMinBoxes) {
      const minBoxes = parseFloat(filterMinBoxes);
      if (!isNaN(minBoxes)) {
        filtered = filtered.filter(bill => (parseFloat(bill['Total Boxes']) || 0) >= minBoxes);
      }
    }
    
    if (filterMaxBoxes) {
      const maxBoxes = parseFloat(filterMaxBoxes);
      if (!isNaN(maxBoxes)) {
        filtered = filtered.filter(bill => (parseFloat(bill['Total Boxes']) || 0) <= maxBoxes);
      }
    }
    
    if (searchTerm) {
      filtered = filtered.filter(bill => 
        bill['Bill Number']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill['Party Name']?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return sortBills(filtered, sortOrder);
  };

  const clearFilters = () => {
    setFilterParty('');
    setFilterMinBoxes('');
    setFilterMaxBoxes('');
    setSearchTerm('');
    setSortOrder('desc');
  };

  const fetchDriversFromSheet = async () => {
    setLoadingDrivers(true);
    try {
      const { apiKey, sheetId, driverSheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${driverSheetName}!A:C`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const rows = data.values.slice(1);
        const parsedDrivers = rows.map(row => ({
          driverName: row[0] || '',
          vehicleNumber: row[1] || '',
          mobileNumber: row[2] || ''
        })).filter(driver => driver.driverName);
        
        setDrivers(parsedDrivers);
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    fetchBillsFromSheet();
    fetchDriversFromSheet();
  }, []);

  useEffect(() => {
    if (bills.length > 0) {
      const filteredAndSorted = applyFilters(bills);
      setBills(filteredAndSorted);
    }
  }, [filterParty, filterMinBoxes, filterMaxBoxes, searchTerm, sortOrder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGatepassData(prev => ({ ...prev, [name]: value }));
  };

  const handleDriverSelect = (driverName) => {
    const selectedDriver = drivers.find(driver => driver.driverName === driverName);
    
    if (selectedDriver) {
      setGatepassData(prev => ({
        ...prev,
        driverName: selectedDriver.driverName,
        vehicleNumber: selectedDriver.vehicleNumber,
        driverContact: selectedDriver.mobileNumber
      }));
    } else {
      setGatepassData(prev => ({
        ...prev,
        driverName: driverName,
        vehicleNumber: '',
        driverContact: ''
      }));
    }
  };

  const updateBillsWithGatepassInfo = async (selectedBills, gatepassNumber) => {
    try {
      const billNumbers = selectedBills.map(bill => bill['Bill Number']);
      const scriptURL = 'https://script.google.com/macros/s/AKfycby-ECcbpzebHoH8FrepiNOUXUhKc3KjBDtazAcBvjjqOOBXxW1OfWz2QyRFA6_44zI/exec';
      
      const updateData = {
        action: 'updateGatepass',
        billNumbers: billNumbers,
        gatepassNumber: gatepassNumber
      };
      
      const encodedData = encodeURIComponent(JSON.stringify(updateData));
      const postData = `data=${encodedData}&type=gatepass_update`;
      
      await fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData
      });
      
      return true;
    } catch (error) {
      console.error('Error updating bills with gatepass info:', error);
      return false;
    }
  };

  const calculateTotalsFromBills = (selectedBills) => {
    const totals = {
      totalBoxes: 0,
      totalBags: 0,
      totalPolybags: 0
    };

    selectedBills.forEach(bill => {
      const boxes = parseFloat(bill['Total Boxes']) || 0;
      const bags = parseFloat(bill['Total Bags']) || 0;
      const polybags = parseFloat(bill['Total Polybags']) || 0;
      
      totals.totalBoxes += boxes;
      totals.totalBags += bags;
      totals.totalPolybags += polybags;
    });

    return totals;
  };

  const handleBillSelect = (bill) => {
    const isAlreadySelected = gatepassData.selectedBills.some(
      selected => selected['Bill Number'] === bill['Bill Number']
    );
    
    if (!isAlreadySelected) {
      const updatedSelectedBills = [...gatepassData.selectedBills, bill];
      
      const calculatedTotals = calculateTotalsFromBills(updatedSelectedBills);
      
      setGatepassData(prev => ({
        ...prev,
        selectedBills: updatedSelectedBills,
        totalBoxes: calculatedTotals.totalBoxes,
        totalBags: calculatedTotals.totalBags,
        totalPolybags: calculatedTotals.totalPolybags
      }));
      setSelectedBillDetails(updatedSelectedBills);
    } else {
      // If already selected, show a subtle notification
      alert(`Bill ${bill['Bill Number']} is already selected`);
    }
  };

  const handleRemoveBill = (billToRemove) => {
    const updatedSelectedBills = gatepassData.selectedBills.filter(
      bill => bill['Bill Number'] !== billToRemove['Bill Number']
    );
    
    const calculatedTotals = calculateTotalsFromBills(updatedSelectedBills);
    
    setGatepassData(prev => ({
      ...prev,
      selectedBills: updatedSelectedBills,
      totalBoxes: calculatedTotals.totalBoxes,
      totalBags: calculatedTotals.totalBags,
      totalPolybags: calculatedTotals.totalPolybags
    }));
    setSelectedBillDetails(updatedSelectedBills);
  };

  const handleClearAllBills = () => {
    setGatepassData(prev => ({
      ...prev,
      selectedBills: [],
      totalBoxes: 0,
      totalBags: 0,
      totalPolybags: 0
    }));
    setSelectedBillDetails([]);
  };

  const getUniqueParties = () => {
    const parties = gatepassData.selectedBills.map(bill => bill['Party Name']);
    return [...new Set(parties)];
  };

  const getUniquePartyInitials = () => {
    const initials = gatepassData.selectedBills.map(bill => 
      getPartyInitials(bill['Party Name'])
    );
    return [...new Set(initials)];
  };

  const generatePDF = (gatepassInfo) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = 15;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("DISPATCH GATE PASS", pageWidth / 2, y, { align: "center" });

    y += 5;
    
    doc.setLineWidth(0.3);
    doc.line(10, y, pageWidth - 10, y);
    
    y += 8;

    doc.setFontSize(10);
    doc.setFont("times", "bold");

    const currentDateTime = new Date();
    const formattedDateTime = `${currentDateTime.toLocaleDateString()} ${currentDateTime.toLocaleTimeString()}`;
    
    doc.text(`Gatepass No: ${gatepassInfo.gatepassNumber || "-"}`, 15, y);
    doc.text(`Date & Time: ${formattedDateTime}`, pageWidth - 75, y);

    y += 6;
    
    doc.setFontSize(9);
    doc.setFont("times", "normal");
    doc.text("Boxes | Bags | Polybags", 15, y);
    
    y += 6;

    doc.rect(10, y, 90, 40);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("VEHICLE AND TRANSPORT DETAILS", 55, y + 6, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Vehicle No:", 15, y + 14);
    doc.setFont("times", "bold");
    doc.text(`${gatepassInfo.vehicleNumber || "-"}`, 60, y + 14);
    
    doc.setFont("times", "normal");
    doc.text("Driver Name:", 15, y + 20);
    doc.setFont("times", "bold");
    doc.text(`${gatepassInfo.driverName || "-"}`, 60, y + 20);
    
    doc.setFont("times", "normal");
    doc.text("Driver Contact:", 15, y + 26);
    doc.setFont("times", "bold");
    doc.text(`${gatepassInfo.driverContact || "-"}`, 60, y + 26);
    
    doc.setFont("times", "normal");
    doc.text("Purpose:", 15, y + 32);
    doc.setFont("times", "bold");
    doc.text(`${gatepassInfo.purpose || "-"}`, 60, y + 32);

    doc.rect(110, y, 90, 40);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("DISPATCH DETAILS", 155, y + 6, { align: "center" });

    const totalBoxes = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (parseFloat(bill["Total Boxes"]) || 0), 0);
    const totalBags = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (parseFloat(bill["Total Bags"]) || 0), 0);
    const totalPolybags = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (parseFloat(bill["Total Polybags"]) || 0), 0);
    
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Total Boxes:", 120, y + 16);
    doc.setFont("times", "bold");
    doc.text(`${totalBoxes}`, 175, y + 16);
    
    doc.setFont("times", "normal");
    doc.text("Total Bags:", 120, y + 22);
    doc.setFont("times", "bold");
    doc.text(`${totalBags}`, 175, y + 22);
    
    doc.setFont("times", "normal");
    doc.text("Total Polybags:", 120, y + 28);
    doc.setFont("times", "bold");
    doc.text(`${totalPolybags}`, 175, y + 28);

    y += 50;

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("BILL SUMMARY", 10, y);

    y += 8;

    const tableStartX = 10;
    const tableWidth = 190;
    
    const colCenters = {
      serial: 18,
      billNo: 50,
      billDate: 85,
      partyInitials: 115,
      packing: 175
    };

    doc.setFillColor(200, 200, 200);
    doc.rect(tableStartX, y, tableWidth, 10, 'F');
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.text("#", colCenters.serial, y + 7, { align: "center" });
    doc.text("Bill No.", colCenters.billNo, y + 7, { align: "center" });
    doc.text("Bill Date", colCenters.billDate, y + 7, { align: "center" });
    doc.text("Party", colCenters.partyInitials, y + 7, { align: "center" });
    doc.text("Boxes | Bags | Polybags", colCenters.packing, y + 7, { align: "center" });

    y += 10;

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const rowHeight = 9;
    
    gatepassInfo.selectedBills.forEach((bill, index) => {
      if (y + rowHeight > pageHeight - 50) {
        doc.addPage();
        y = 20;
        
        doc.setFillColor(200, 200, 200);
        doc.rect(tableStartX, y, tableWidth, 10, 'F');
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.text("#", colCenters.serial, y + 7, { align: "center" });
        doc.text("Bill No.", colCenters.billNo, y + 7, { align: "center" });
        doc.text("Bill Date", colCenters.billDate, y + 7, { align: "center" });
        doc.text("Party", colCenters.partyInitials, y + 7, { align: "center" });
        doc.text("Boxes | Bags | Polybags", colCenters.packing, y + 7, { align: "center" });
        y += 10;
        doc.setFont("times", "normal");
        doc.setFontSize(9);
      }
      
      doc.rect(tableStartX, y, tableWidth, rowHeight);
      
      const partyInitials = bill['Party Initials'] || getPartyInitials(bill['Party Name']);
      
      const billDate = bill["Bill Date"] || "-";
      const formattedBillDate = billDate.split('T')[0];
      
      const boxes = parseFloat(bill["Total Boxes"]) || 0;
      const bags = parseFloat(bill["Total Bags"]) || 0;
      const polybags = parseFloat(bill["Total Polybags"]) || 0;
      
      let packingText = "";
      const packingParts = [];
      if (boxes > 0) packingParts.push(`${boxes} Boxes`);
      if (bags > 0) packingParts.push(`${bags} Bags`);
      if (polybags > 0) packingParts.push(`${polybags} Polybags`);
      packingText = packingParts.join(" | ");
      
      if (packingText.length > 35) {
        packingText = packingText.substring(0, 32) + "...";
      }
      
      doc.text(String(index + 1), colCenters.serial, y + 6, { align: "center" });
      doc.text(bill["Bill Number"] || "-", colCenters.billNo, y + 6, { align: "center" });
      doc.text(formattedBillDate, colCenters.billDate, y + 6, { align: "center" });
      doc.text(partyInitials, colCenters.partyInitials, y + 6, { align: "center" });
      doc.text(packingText || "0", colCenters.packing, y + 6, { align: "center" });
      
      y += rowHeight;
    });

    const tableEndY = y;
    const tableStartY = y - (gatepassInfo.selectedBills.length * rowHeight);
    
    doc.line(26, tableStartY, 26, tableEndY);
    doc.line(68, tableStartY, 68, tableEndY);
    doc.line(98, tableStartY, 98, tableEndY);
    doc.line(128, tableStartY, 128, tableEndY);
    doc.line(tableStartX, tableStartY, tableStartX, tableEndY);
    doc.line(tableStartX + tableWidth, tableStartY, tableStartX + tableWidth, tableEndY);

    y += 6;

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    
    doc.text(`Total Bills: ${gatepassInfo.selectedBills.length}`, 10, y);
    y += 7;
    
    const uniquePartyInitials = getUniquePartyInitials();
    const uniquePartyCount = uniquePartyInitials.length;
    
    doc.text(`Total Unique Parties: ${uniquePartyCount}`, 10, y);
    y += 7;
    
    if (uniquePartyCount > 0) {
      doc.setFont("times", "normal");
      y += 7;
    }

    if (gatepassInfo.consolidatedRemarks) {
      y += 4;
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.text("Remarks:", 10, y);
      y += 5;
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const remarksLines = doc.splitTextToSize(gatepassInfo.consolidatedRemarks, 180);
      doc.text(remarksLines, 10, y);
      y += remarksLines.length * 5;
    }

    if (y > 245) {
      y = 245;
    } else {
      y = 255;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    
    doc.line(20, y, 70, y);
    doc.text("Authorized Signature", 45, y + 5, { align: "center" });

    doc.line(80, y, 130, y);
    doc.text("Driver Signature", 105, y + 5, { align: "center" });

    doc.line(140, y, 190, y);
    doc.text("Security Signature", 165, y + 5, { align: "center" });

    doc.save(`Gatepass_${Date.now()}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (gatepassData.selectedBills.length === 0) {
      alert('Please select at least one bill for the gatepass');
      return;
    }
    
    if (!gatepassData.vehicleNumber || !gatepassData.driverName || !gatepassData.driverContact) {
      alert('Please fill in all vehicle and driver details');
      return;
    }
    
    const uniqueParties = getUniqueParties();
    const uniquePartyInitials = getUniquePartyInitials();
    const gatepassNumber = `MGP-${Date.now()}`;
    
    const gatepassWithBills = {
      ...gatepassData,
      gatepassNumber: gatepassNumber,
      status: 'active',
      createdAt: new Date().toISOString(),
      uniqueParties: uniqueParties,
      uniquePartyInitials: uniquePartyInitials,
      selectedBills: gatepassData.selectedBills,
      totalBills: gatepassData.selectedBills.length
    };
    
    setGeneratedGatepass(gatepassWithBills);
    generatePDF(gatepassWithBills);
    
    await updateBillsWithGatepassInfo(gatepassData.selectedBills, gatepassNumber);
    
    if (onSubmit) {
      onSubmit(gatepassWithBills);
    }
    
    setTimeout(() => {
      setGeneratedGatepass(null);
      setGatepassData({
        vehicleNumber: '',
        driverName: '',
        driverContact: '',
        totalBoxes: 0,
        totalBags: 0,
        totalPolybags: 0,
        purpose: 'delivery',
        remarks: '',
        selectedBills: [],
        consolidatedRemarks: ''
      });
      setSelectedBillDetails([]);
      fetchBillsFromSheet();
    }, 2000);
  };

  const filteredBills = applyFilters(bills);

  return (
    <div className="gatepass-generator">
      {/* Header */}
      <header className="generator-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div className="header-info">
            <h1>Dispatch Gatepass</h1>
            <p>Create consolidated gatepass for multiple bills</p>
          </div>
        </div>
        <div className="header-right">
          <div className="stats-card">
            <span className="stats-number">{gatepasses.length}</span>
            <span className="stats-label">Total Gatepasses</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="generator-main">
        {/* Left Sidebar - Bill Selection with Filters */}
        <div className="bills-sidebar">
          <div className="sidebar-header">
            <h3>
              <span className="icon">📋</span>
              Available Bills
            </h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by bill number or party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button onClick={fetchBillsFromSheet} disabled={loadingBills}>
                🔄
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <div className="filters-header">
              <h4>Filters</h4>
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear All
              </button>
            </div>
            
            <div className="filter-group">
              <label>Party Name</label>
              <select 
                value={filterParty} 
                onChange={(e) => setFilterParty(e.target.value)}
                className="filter-select"
              >
                <option value="">All Parties</option>
                {uniquePartiesList.map((party, index) => (
                  <option key={index} value={party}>
                    {party}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Boxes Range</label>
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={filterMinBoxes}
                  onChange={(e) => setFilterMinBoxes(e.target.value)}
                  className="filter-input"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filterMaxBoxes}
                  onChange={(e) => setFilterMaxBoxes(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Sort Order</label>
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                className="filter-select"
              >
                <option value="desc">Descending (Newest First)</option>
                <option value="asc">Ascending (Oldest First)</option>
              </select>
            </div>

            {(filterParty || filterMinBoxes || filterMaxBoxes || searchTerm) && (
              <div className="active-filters">
                <span className="active-filters-label">Active Filters:</span>
                <div className="filter-tags">
                  {filterParty && <span className="filter-tag">Party: {filterParty}</span>}
                  {filterMinBoxes && <span className="filter-tag">Min Boxes: {filterMinBoxes}</span>}
                  {filterMaxBoxes && <span className="filter-tag">Max Boxes: {filterMaxBoxes}</span>}
                  {searchTerm && <span className="filter-tag">Search: {searchTerm}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="bills-container">
            {loadingBills ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading bills...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="empty-state">
                <p>{searchTerm || filterParty || filterMinBoxes || filterMaxBoxes ? 'No matching bills found with current filters' : 'No bills available'}</p>
                {(searchTerm || filterParty || filterMinBoxes || filterMaxBoxes) && (
                  <button className="clear-filters-btn" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="bills-count-info">
                  Showing {filteredBills.length} of {bills.length} bills
                  {sortOrder === 'desc' && <span className="sort-indicator">↓ Sorted by Bill Number (Newest First)</span>}
                  {sortOrder === 'asc' && <span className="sort-indicator">↑ Sorted by Bill Number (Oldest First)</span>}
                </div>
                {filteredBills.map((bill, index) => (
                  <div 
                    key={index} 
                    className={`bill-card ${isBillSelected(bill['Bill Number']) ? 'selected' : ''}`}
                    onClick={() => handleBillSelect(bill)}
                  >
                    <div className="bill-card-content">
                      <div className="bill-number">
                        {bill['Bill Number']}
                        {isBillSelected(bill['Bill Number']) && (
                          <span className="selected-badge">✓ Selected</span>
                        )}
                      </div>
                      <div className="bill-date">📅 {bill['Bill Date']}</div>
                      <div className="bill-party">
                        {bill['Party Name']} 
                        <span className="party-initials">({getPartyInitials(bill['Party Name'])})</span>
                      </div>
                      <div className="bill-packing-details">
                        📦 B:{bill['Total Boxes'] || 0} | 🛍️ G:{bill['Total Bags'] || 0} | 🎒 P:{bill['Total Polybags'] || 0}
                      </div>
                    </div>
                    <button className={`add-button ${isBillSelected(bill['Bill Number']) ? 'disabled' : ''}`}>
                      {isBillSelected(bill['Bill Number']) ? '✓' : '+'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right Content - Form Area */}
        <div className="form-content">
          {/* Selected Bills Summary */}
          <div className="selected-summary">
            <div className="summary-header">
              <h3>
                <span className="icon">✅</span>
                Selected Bills ({gatepassData.selectedBills.length})
              </h3>
              {gatepassData.selectedBills.length > 0 && (
                <button className="clear-button" onClick={handleClearAllBills}>
                  Clear All
                </button>
              )}
            </div>

            {gatepassData.selectedBills.length === 0 ? (
              <div className="empty-selection">
                <div className="empty-icon">📄</div>
                <p>No bills selected</p>
                <small>Click on bills from the left panel to add them</small>
              </div>
            ) : (
              <div className="selected-bills-grid">
                {gatepassData.selectedBills.map((bill, index) => (
                  <div key={index} className="selected-bill-card">
                    <div className="selected-bill-info">
                      <span className="bill-badge">{bill['Bill Number']}</span>
                      <span className="bill-date">📅 {bill['Bill Date']}</span>
                      <span className="party-name">
                        {bill['Party Name']} 
                        <small>({getPartyInitials(bill['Party Name'])})</small>
                      </span>
                      <div className="packing-details">
                        📦 B:{bill['Total Boxes'] || 0} | 🛍️ G:{bill['Total Bags'] || 0} | 🎒 P:{bill['Total Polybags'] || 0}
                      </div>
                    </div>
                    <button 
                      className="remove-button"
                      onClick={() => handleRemoveBill(bill)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gatepass Form */}
          {gatepassData.selectedBills.length > 0 && (
            <form onSubmit={handleSubmit} className="gatepass-form">
              {/* Tabs */}
              <div className="form-tabs">
                <button 
                  type="button"
                  className={`tab ${activeTab === 'vehicle' ? 'active' : ''}`}
                  onClick={() => setActiveTab('vehicle')}
                >
                  🚛 Vehicle Details
                </button>
                <button 
                  type="button"
                  className={`tab ${activeTab === 'remarks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('remarks')}
                >
                  📝 Remarks
                </button>
              </div>

              {/* Vehicle Details Tab */}
              {activeTab === 'vehicle' && (
                <div className="tab-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Name *</label>
                      <select
                        name="driverName"
                        value={gatepassData.driverName}
                        onChange={(e) => handleDriverSelect(e.target.value)}
                        required
                      >
                        <option value="">Select Driver</option>
                        {drivers.map((driver, index) => (
                          <option key={index} value={driver.driverName}>
                            {driver.driverName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Vehicle Number *</label>
                      <input
                        type="text"
                        name="vehicleNumber"
                        value={gatepassData.vehicleNumber}
                        onChange={handleChange}
                        placeholder="Auto-filled from driver selection"
                        required
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Contact *</label>
                      <input
                        type="tel"
                        name="driverContact"
                        value={gatepassData.driverContact}
                        onChange={handleChange}
                        placeholder="Auto-filled from driver selection"
                        required
                        readOnly
                      />
                    </div>
                    <div className="form-group">
                      <label>Purpose *</label>
                      <select name="purpose" value={gatepassData.purpose} onChange={handleChange} required>
                        <option value="delivery">Delivery</option>
                        <option value="pickup">Pickup</option>
                        <option value="transfer">Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks Tab */}
              {activeTab === 'remarks' && (
                <div className="tab-content">
                  <div className="form-group full-width">
                    <label>Consolidated Remarks</label>
                    <textarea
                      name="consolidatedRemarks"
                      value={gatepassData.consolidatedRemarks}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Any special instructions or notes for this consolidated dispatch..."
                    />
                  </div>
                </div>
              )}

              {/* Dispatch Summary */}
              <div className="dispatch-summary">
                <h4>Dispatch Summary (Auto-calculated from Bills)</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Boxes:</span>
                    <span className="summary-value">{gatepassData.totalBoxes}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Bags:</span>
                    <span className="summary-value">{gatepassData.totalBags}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Polybags:</span>
                    <span className="summary-value">{gatepassData.totalPolybags}</span>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div className="summary-section">
                <h4>Gatepass Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Bills:</span>
                    <span className="summary-value">{gatepassData.selectedBills.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Unique Parties:</span>
                    <span className="summary-value">{getUniqueParties().length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Party Initials:</span>
                    <span className="summary-value">{getUniquePartyInitials().join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={onBack}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  📄 Generate Gatepass
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {generatedGatepass && (
        <div className="toast-success">
          <span className="toast-icon">✅</span>
          <span>Gatepass generated with {generatedGatepass.selectedBills.length} bills!</span>
        </div>
      )}
    </div>
  );
};

export default GatepassGenerator;