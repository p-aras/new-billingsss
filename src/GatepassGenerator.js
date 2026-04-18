// GatepassGenerator.js
import React, { useState, useEffect } from 'react';
import './GatepassGenerator.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// HARDCODED GOOGLE SHEETS CREDENTIALS
const GOOGLE_SHEETS_CONFIG = {
  apiKey: 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills'
};

const GatepassGenerator = ({ parties, gatepasses, onSubmit, onBack }) => {
  const [gatepassData, setGatepassData] = useState({
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    totalBoxes: '',
    totalBags: '',
    totalPolybags: '',
    purpose: 'delivery',
    remarks: '',
    selectedBills: [],
    consolidatedRemarks: ''
  });

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillDetails, setSelectedBillDetails] = useState([]);
  const [generatedGatepass, setGeneratedGatepass] = useState(null);
  const [activeTab, setActiveTab] = useState('bills');

  const fetchBillsFromSheet = async () => {
    setLoading(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${sheetName}!A:G`;
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
        
        setBills(parsedBills);
      } else {
        setBills([]);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      alert(`Failed to fetch bills: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillsFromSheet();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGatepassData(prev => ({ ...prev, [name]: value }));
  };

  const handleBillSelect = (bill) => {
    const isAlreadySelected = gatepassData.selectedBills.some(
      selected => selected['Bill Number'] === bill['Bill Number']
    );
    
    if (!isAlreadySelected) {
      const updatedSelectedBills = [...gatepassData.selectedBills, bill];
      setGatepassData(prev => ({
        ...prev,
        selectedBills: updatedSelectedBills
      }));
      setSelectedBillDetails(updatedSelectedBills);
    }
  };

  const handleRemoveBill = (billToRemove) => {
    const updatedSelectedBills = gatepassData.selectedBills.filter(
      bill => bill['Bill Number'] !== billToRemove['Bill Number']
    );
    setGatepassData(prev => ({
      ...prev,
      selectedBills: updatedSelectedBills
    }));
    setSelectedBillDetails(updatedSelectedBills);
  };

  const handleClearAllBills = () => {
    setGatepassData(prev => ({
      ...prev,
      selectedBills: []
    }));
    setSelectedBillDetails([]);
  };

  const calculateTotalQuantity = () => {
    return gatepassData.selectedBills.reduce((total, bill) => {
      const quantity = parseFloat(bill['Total Quantity']) || 0;
      return total + quantity;
    }, 0);
  };

  const getUniqueParties = () => {
    const parties = gatepassData.selectedBills.map(bill => bill['Party Name']);
    return [...new Set(parties)];
  };

  const generatePDF = (gatepassInfo) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = 15;

    // ================= PAGE BORDER =================
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

    // ================= HEADER =================
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("DISPATCH GATEPASS", pageWidth / 2, y, { align: "center" });

    y += 5;
    
    // Line under header
    doc.setLineWidth(0.3);
    doc.line(10, y, pageWidth - 10, y);
    
    y += 8;

    doc.setFontSize(10);
    doc.setFont("times", "bold");

    const currentDateTime = new Date();
    const formattedDateTime = `${currentDateTime.toLocaleDateString()} ${currentDateTime.toLocaleTimeString()}`;
    
    doc.text(`Gatepass No: ${gatepassInfo.gatepassNumber || "-"}`, 15, y);
    doc.text(`Date & Time: ${formattedDateTime}`, pageWidth - 75, y);

    y += 10;

    // ================= VEHICLE + DISPATCH BOX =================
    // Left Box
    doc.rect(10, y, 90, 40);
    doc.setFont("times", "bold");
    doc.text("VEHICLE AND TRANSPORT DETAILS", 55, y + 6, { align: "center" });

    doc.setFont("times", "bold");
    doc.text(`Vehicle No: ${gatepassInfo.vehicleNumber}`, 55, y + 14, { align: "center" });
    doc.text(`Driver Name: ${gatepassInfo.driverName}`, 55, y + 20, { align: "center" });
    doc.text(`Driver Contact: ${gatepassInfo.driverContact}`, 55, y + 26, { align: "center" });
    doc.text(`Purpose: ${gatepassInfo.purpose}`, 55, y + 32, { align: "center" });

    // Right Box
    doc.rect(110, y, 90, 40);
    doc.setFont("times", "bold");
    doc.text("DISPATCH DETAILS", 155, y + 6, { align: "center" });

    doc.setFont("times", "bold");
    doc.text(`Boxes: ${gatepassInfo.totalBoxes || 0}`, 155, y + 14, { align: "center" });
    doc.text(`Bags: ${gatepassInfo.totalBags || 0}`, 155, y + 20, { align: "center" });
    doc.text(`Polybags: ${gatepassInfo.totalPolybags || 0}`, 155, y + 26, { align: "center" });

    y += 50;

    // ================= BILL SUMMARY =================
    doc.setFont("times", "bold");
    doc.text("BILL SUMMARY", 10, y);

    y += 5;

    const tableStartX = 10;
    const tableWidth = 190;
    
    const colCenters = {
      serial: 17.5,
      billNo: 47.5,
      partyName: 100,
      billDate: 150,
      qty: 182.5
    };

    doc.setFillColor(200, 200, 200);
    doc.rect(tableStartX, y, tableWidth, 10, 'F');
    doc.setFont("times", "bold");
    doc.text("#", colCenters.serial, y + 7, { align: "center" });
    doc.text("Bill Number", colCenters.billNo, y + 7, { align: "center" });
    doc.text("Party Name", colCenters.partyName, y + 7, { align: "center" });
    doc.text("Bill Date", colCenters.billDate, y + 7, { align: "center" });
    doc.text("Qty", colCenters.qty, y + 7, { align: "center" });

    y += 10;

    doc.setFont("times", "bold");
    const rowHeight = 10;
    
    gatepassInfo.selectedBills.forEach((bill, index) => {
      doc.rect(tableStartX, y, tableWidth, rowHeight);
      
      doc.text(String(index + 1), colCenters.serial, y + 7, { align: "center" });
      doc.text(bill["Bill Number"] || "-", colCenters.billNo, y + 7, { align: "center" });
      doc.text(bill["Party Name"] || "-", colCenters.partyName, y + 7, { align: "center" });
      doc.text(bill["Bill Date"] || "-", colCenters.billDate, y + 7, { align: "center" });
      doc.text(String(bill["Total Quantity"] || 0), colCenters.qty, y + 7, { align: "center" });
      
      y += rowHeight;
    });

    const tableEndY = y;
    const tableStartY = y - (gatepassInfo.selectedBills.length * rowHeight);
    
    doc.line(25, tableStartY, 25, tableEndY);
    doc.line(70, tableStartY, 70, tableEndY);
    doc.line(130, tableStartY, 130, tableEndY);
    doc.line(170, tableStartY, 170, tableEndY);
    doc.line(tableStartX, tableStartY, tableStartX, tableEndY);
    doc.line(tableStartX + tableWidth, tableStartY, tableStartX + tableWidth, tableEndY);

    y += 5;

    doc.setFont("times", "bold");
    doc.text(`Total Bills: ${gatepassInfo.selectedBills.length}`, 10, y);
    doc.text(`Total Qty: ${gatepassInfo.totalQuantity} PCS`, 130, y);

    y += 10;

    const uniqueParties = [
      ...new Set(gatepassInfo.selectedBills.map(b => b["Party Name"]))
    ];
    doc.text(`Total Unique Parties: ${uniqueParties.length}`, 10, y);

    y = 250;

    doc.line(20, y, 70, y);
    doc.text("Authorized Signature", 45, y + 5, { align: "center" });

    doc.line(80, y, 130, y);
    doc.text("Driver Signature", 105, y + 5, { align: "center" });

    doc.line(140, y, 190, y);
    doc.text("Security Signature", 165, y + 5, { align: "center" });

    doc.save(`Gatepass_${Date.now()}.pdf`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (gatepassData.selectedBills.length === 0) {
      alert('Please select at least one bill for the gatepass');
      return;
    }
    
    const totalQuantity = calculateTotalQuantity();
    const uniqueParties = getUniqueParties();
    
    const gatepassWithBills = {
      ...gatepassData,
      gatepassNumber: `MGP-${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      totalQuantity: totalQuantity,
      uniqueParties: uniqueParties,
      selectedBills: gatepassData.selectedBills,
      totalBills: gatepassData.selectedBills.length
    };
    
    setGeneratedGatepass(gatepassWithBills);
    generatePDF(gatepassWithBills);
    
    if (onSubmit) {
      onSubmit(gatepassWithBills);
    }
    
    setTimeout(() => {
      setGeneratedGatepass(null);
      setGatepassData({
        vehicleNumber: '',
        driverName: '',
        driverContact: '',
        totalBoxes: '',
        totalBags: '',
        totalPolybags: '',
        purpose: 'delivery',
        remarks: '',
        selectedBills: [],
        consolidatedRemarks: ''
      });
      setSelectedBillDetails([]);
    }, 2000);
  };

  const filteredBills = bills.filter(bill => 
    !gatepassData.selectedBills.some(selected => selected['Bill Number'] === bill['Bill Number']) &&
    (bill['Bill Number']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill['Party Name']?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        {/* Left Sidebar - Bill Selection */}
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
              <button onClick={fetchBillsFromSheet} disabled={loading}>
                🔄
              </button>
            </div>
          </div>

          <div className="bills-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading bills...</p>
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="empty-state">
                <p>{searchTerm ? 'No matching bills' : 'No bills available'}</p>
              </div>
            ) : (
              filteredBills.map((bill, index) => (
                <div 
                  key={index} 
                  className="bill-card"
                  onClick={() => handleBillSelect(bill)}
                >
                  <div className="bill-card-content">
                    <div className="bill-number">{bill['Bill Number']}</div>
                    <div className="bill-party">{bill['Party Name']}</div>
                    <div className="bill-details">
                      <span>📅 {bill['Bill Date']}</span>
                      <span>📦 Qty: {bill['Total Quantity'] || 0}</span>
                    </div>
                  </div>
                  <button className="add-button">+</button>
                </div>
              ))
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
                      <span className="party-name">{bill['Party Name']}</span>
                      <span className="quantity">Qty: {bill['Total Quantity'] || 0}</span>
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
                  className={`tab ${activeTab === 'dispatch' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dispatch')}
                >
                  📦 Dispatch Details
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
                      <label>Vehicle Number *</label>
                      <input
                        type="text"
                        name="vehicleNumber"
                        value={gatepassData.vehicleNumber}
                        onChange={handleChange}
                        placeholder="Enter vehicle number"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Driver Name *</label>
                      <input
                        type="text"
                        name="driverName"
                        value={gatepassData.driverName}
                        onChange={handleChange}
                        placeholder="Enter driver name"
                        required
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
                        placeholder="Enter mobile number"
                        required
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

              {/* Dispatch Details Tab */}
              {activeTab === 'dispatch' && (
                <div className="tab-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Total Boxes</label>
                      <input
                        type="number"
                        name="totalBoxes"
                        value={gatepassData.totalBoxes}
                        onChange={handleChange}
                        placeholder="Number of boxes"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Total Bags</label>
                      <input
                        type="number"
                        name="totalBags"
                        value={gatepassData.totalBags}
                        onChange={handleChange}
                        placeholder="Number of bags"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Total Polybags</label>
                      <input
                        type="number"
                        name="totalPolybags"
                        value={gatepassData.totalPolybags}
                        onChange={handleChange}
                        placeholder="Number of polybags"
                        min="0"
                      />
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

              {/* Summary Section */}
              <div className="summary-section">
                <h4>Gatepass Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Bills:</span>
                    <span className="summary-value">{gatepassData.selectedBills.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Quantity:</span>
                    <span className="summary-value">{calculateTotalQuantity()} PCS</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Unique Parties:</span>
                    <span className="summary-value">{getUniqueParties().length}</span>
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