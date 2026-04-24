import React, { useState, useEffect, useRef } from 'react';
import './GatepassDetails.css';
import jsPDF from 'jspdf';

// Google Sheets configuration
const GOOGLE_SHEETS_CONFIG = {
  apiKey: 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills',
};

const GatepassDetails = ({ onBack }) => {
  const [gatepassData, setGatepassData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [codes, setCodes] = useState({});

  useEffect(() => {
    fetchGatepassData();
  }, []);

  useEffect(() => {
    filterData();
  }, [searchTerm, startDate, endDate, gatepassData]);

  const fetchGatepassData = async () => {
    setLoading(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${sheetName}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const columnIndices = {
          billNumber: headers.findIndex(h => h === 'Bill Number'),
          partyName: headers.findIndex(h => h === 'Party Name'),
          billDate: headers.findIndex(h => h === 'Bill Date'),
          totalBoxes: headers.findIndex(h => h === 'Total Boxes'),
          totalBags: headers.findIndex(h => h === 'Total Bags'),
          totalPolybags: headers.findIndex(h => h === 'Total Polybags'),
          gatepassCreated: headers.findIndex(h => h === 'GATEPASS CREATED'),
          gatepassTime: headers.findIndex(h => h === 'GATEPASS CREATION TIME'),
          driverName: headers.findIndex(h => h === 'DRIVER NAME'),
          driverContact: headers.findIndex(h => h === 'DRIVER CONTACT'),
          driverVehicle: headers.findIndex(h => h === 'DRIVER VEHICLE NUMBER'),
          porter: headers.findIndex(h => h === 'PORTER'),
          byHand: headers.findIndex(h => h === 'BY HAND'),
          byHandPerson: headers.findIndex(h => h === 'BY HAND PERSON NAME'),
        };
        
        const formattedData = rows.map((row, index) => {
          if (!row || row.length === 0 || !row[columnIndices.billNumber]) {
            return null;
          }
          
          let formattedDate = '';
          const rawBillDate = row[columnIndices.billDate] || '';
          
          if (rawBillDate) {
            if (rawBillDate.match(/^\d{4}-\d{2}-\d{2}/)) {
              formattedDate = rawBillDate;
            } else {
              const dateObj = new Date(rawBillDate);
              if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toISOString().split('T')[0];
              } else {
                formattedDate = rawBillDate;
              }
            }
          }
          
          const totalBoxes = parseInt(row[columnIndices.totalBoxes]) || 0;
          const totalBags = parseInt(row[columnIndices.totalBags]) || 0;
          const totalPolybags = parseInt(row[columnIndices.totalPolybags]) || 0;
          
          let bagDetails = [];
          if (totalBoxes > 0) bagDetails.push(`${totalBoxes} Petti`);
          if (totalBags > 0) bagDetails.push(`${totalBags} Bora`);
          if (totalPolybags > 0) bagDetails.push(`${totalPolybags} Polybags`);
          const bagDetailsText = bagDetails.join(' + ') || '0';
          
          return {
            id: `${row[columnIndices.billNumber] || index}_${index}`,
            date: formattedDate,
            originalBillDate: rawBillDate,
            billNumber: row[columnIndices.billNumber] || '',
            partyName: row[columnIndices.partyName] || '',
            bagDetails: bagDetailsText,
            driverName: row[columnIndices.driverName] || '',
            vehicleNumber: row[columnIndices.driverVehicle] || '',
            driverContact: row[columnIndices.driverContact] || '',
            porter: row[columnIndices.porter] || '',
            byHand: row[columnIndices.byHand] || '',
            byHandPerson: row[columnIndices.byHandPerson] || '',
            gatepassTime: row[columnIndices.gatepassTime] || '',
            gatepassCreated: row[columnIndices.gatepassCreated] || '',
            totalBoxes: totalBoxes,
            totalBags: totalBags,
            totalPolybags: totalPolybags,
            rawData: row
          };
        }).filter(row => row !== null);
        
        setGatepassData(formattedData);
        setFilteredData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching gatepass data:', error);
      alert('Failed to fetch gatepass data from Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...gatepassData];
    
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (startDate) {
      filtered = filtered.filter(item => item.date >= startDate);
    }
    
    if (endDate) {
      filtered = filtered.filter(item => item.date <= endDate);
    }
    
    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const viewDetails = (row) => {
    setSelectedRow(row);
    setShowModal(true);
  };

  const handleCodeChange = (id, value) => {
    setCodes(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '-';
    if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  // PDF Generation using jsPDF - Black and White only
const downloadGatepassPDF = (isSingle = false, singleItem = null) => {
  try {
    console.log("Starting PDF generation...");
    
    // Check if jsPDF is available
    if (typeof jsPDF === 'undefined') {
      console.error("jsPDF library not loaded!");
      alert("PDF library not loaded. Please refresh the page.");
      return false;
    }
    
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to safely format date
    const safeFormatDisplayDate = (dateValue) => {
      if (!dateValue) return '';
      try {
        // If it's already a string, try to parse it
        if (typeof dateValue === 'string') {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
          }
          return dateValue; // Return as is if not a valid date
        }
        // If it's a Date object
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
          return dateValue.toLocaleDateString('en-GB');
        }
        // If it's a timestamp number
        if (typeof dateValue === 'number') {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-GB');
          }
        }
        return '';
      } catch (error) {
        console.error("Date formatting error:", error);
        return String(dateValue);
      }
    };

    // 1. Title
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text("GATE PASS SUMMARY", pageWidth / 2, 20, { align: "center" });

    // 2. Table Structure
    const headers = ["Date", "Particulars", "Bags details", "Driver", "Tempo no."];
    const colWidths = [22, 80, 25, 30, 35];
    
    let yPos = 30;

    // Get items to show
    const itemsToShow = isSingle ? (singleItem ? [singleItem] : []) : (filteredData || []);
    
    if (itemsToShow.length === 0) {
      doc.setFontSize(12);
      doc.text("No data available to generate PDF", pageWidth / 2, yPos + 20, { align: "center" });
      doc.save("Empty_Report.pdf");
      return true;
    }

    // 3. Draw Table Header
    doc.setFontSize(10);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPos, contentWidth, 10);
    
    let currentX = margin;
    headers.forEach((header, i) => {
      const textWidth = doc.getTextWidth(header);
      doc.text(header, currentX + (colWidths[i] / 2) - (textWidth / 2), yPos + 7);
      currentX += colWidths[i];
      if (i < headers.length - 1) {
        doc.line(currentX, yPos, currentX, yPos + 10);
      }
    });

    yPos += 10;

    // 4. Draw Rows
    doc.setFont("times", "bold");
    doc.setFontSize(9);

    // Variables for totals
    let totalPetti = 0;
    let totalBora = 0;
    let totalPolybags = 0;

    itemsToShow.forEach((item, index) => {
      const rowHeight = 10; 
      
      // Safely format the date
      const formattedDate = safeFormatDisplayDate(item.date);
      
      const values = [
        formattedDate,
        item.partyName || '',
        item.bagDetails || '',
        item.driverName || '',
        item.vehicleNumber || ''
      ];

      // Parse bag details to extract quantities
      if (item.bagDetails && typeof item.bagDetails === 'string') {
        const bagText = item.bagDetails;
        
        // Extract petti - handles various formats
        const pettiMatch = bagText.match(/Petti[:\s]*(\d+)|(\d+)[\s]*Petti/i);
        if (pettiMatch) {
          totalPetti += parseInt(pettiMatch[1] || pettiMatch[2]) || 0;
        }
        
        // Extract bora
        const boraMatch = bagText.match(/Bora[:\s]*(\d+)|(\d+)[\s]*Bora/i);
        if (boraMatch) {
          totalBora += parseInt(boraMatch[1] || boraMatch[2]) || 0;
        }
        
        // Extract polybags
        const polybagsMatch = bagText.match(/Polybags?[:\s]*(\d+)|(\d+)[\s]*Polybags?/i);
        if (polybagsMatch) {
          totalPolybags += parseInt(polybagsMatch[1] || polybagsMatch[2]) || 0;
        }
      }

      // Check if we need a new page (reserve space for summary)
      if (yPos + rowHeight > pageHeight - 45) {
        doc.addPage();
        yPos = 10;
        // Redraw header on new page
        doc.setFontSize(10);
        doc.rect(margin, yPos, contentWidth, 10);
        currentX = margin;
        headers.forEach((header, i) => {
          const textWidth = doc.getTextWidth(header);
          doc.text(header, currentX + (colWidths[i] / 2) - (textWidth / 2), yPos + 7);
          currentX += colWidths[i];
          if (i < headers.length - 1) {
            doc.line(currentX, yPos, currentX, yPos + 10);
          }
        });
        yPos += 10;
      }

      // Draw row
      doc.rect(margin, yPos, contentWidth, rowHeight);
      let rowX = margin;
      values.forEach((val, i) => {
        let text = String(val || '');
        
        // Truncate Particulars if too long
        if (i === 1 && text.length > 50) {
          text = text.substring(0, 47) + '...';
        }
        
        // Handle text that's too wide
        const textWidth = doc.getTextWidth(text);
        if (textWidth > colWidths[i] - 4) {
          const charsToKeep = Math.floor((colWidths[i] - 4) / (textWidth / text.length));
          text = text.substring(0, charsToKeep - 3) + '...';
        }
        
        doc.text(text, rowX + 2, yPos + 6);
        rowX += colWidths[i];
        if (i < values.length - 1) {
          doc.line(rowX, yPos, rowX, yPos + rowHeight);
        }
      });
      yPos += rowHeight;
    });

    // 5. Draw Total Summary Section
    if (totalPetti > 0 || totalBora > 0 || totalPolybags > 0) {
      yPos += 5;
      const summaryHeight = 35;
      const summaryY = yPos;
      
      // Check if summary fits on current page
      if (summaryY + summaryHeight > pageHeight - margin) {
        doc.addPage();
        yPos = 20;
      }
      
      // Draw summary box
      doc.setDrawColor(0);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, summaryHeight, 'F');
      doc.rect(margin, yPos, contentWidth, summaryHeight);
      
      // Summary Title
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text("TOTAL SUMMARY", pageWidth / 2, yPos + 8, { align: "center" });
      
      // Summary content
      doc.setFontSize(11);
      doc.setFont("times", "normal");
      
      const summaryStartX = margin + 10;
      let summaryTextY = yPos + 18;
      
      // Display totals
      doc.text(`Total Petti: ${totalPetti}`, summaryStartX, summaryTextY);
      doc.text(`Total Bora: ${totalBora}`, summaryStartX + 60, summaryTextY);
      doc.text(`Total Polybags: ${totalPolybags}`, summaryStartX + 120, summaryTextY);
      
      // Grand total
      summaryTextY += 8;
      const grandTotal = totalPetti + totalBora + totalPolybags;
      doc.setFont("times", "bold");
      doc.text(`Grand Total (All Bags): ${grandTotal}`, summaryStartX, summaryTextY);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `Gatepass_Summary_${timestamp}.pdf`;
    
    // Save the PDF
    doc.save(fileName);
    console.log("PDF generated successfully!");
    return true;

  } catch (error) {
    console.error("PDF Error:", error);
    alert(`Failed to generate PDF: ${error.message}`);
    return false;
  }
};

  const downloadAllDataPDF = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }
    downloadGatepassPDF(false, null);
  };

  const generateSinglePDF = (item) => {
    downloadGatepassPDF(true, item);
  };

  return (
    <div className="gatepass-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="title-section">
            <h1>Gatepass Management</h1>
            <p>Manage and track all gatepass entries</p>
          </div>
          <div className="stats-badge">
            <span className="stats-count">{gatepassData.length}</span>
            <span className="stats-text">Total Bills</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filters-container">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search by Bill No, Party, Driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-field"
            />
          </div>
          
          <div className="date-range">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-field"
              placeholder="From"
            />
            <span className="date-sep">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-field"
              placeholder="To"
            />
          </div>

          {(searchTerm || startDate || endDate) && (
            <button className="clear-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
          
          <button className="refresh-btn" onClick={fetchGatepassData}>
            ↻
          </button>
          
          <button className="download-pdf-btn" onClick={downloadAllDataPDF}>
            📥 Download PDF
          </button>
        </div>
      </div>

      {/* Table - NO CODE COLUMN in UI */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>Loading gatepass data...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill No.</th>
                <th>Party Name</th>
                <th>Packing Details</th>
                <th>Driver</th>
                <th>Vehicle No.</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-row">
                    <div className="empty-state">
                      <span>📋</span>
                      <p>No records found</p>
                      <small>Try adjusting your search filters</small>
                    </div>
                   </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDisplayDate(item.date)}</td>
                    <td className="bill-no">{item.billNumber}</td>
                    <td>{item.partyName}</td>
                    <td className="packing">{item.bagDetails}</td>
                    <td>{item.driverName || '-'}</td>
                    <td>{item.vehicleNumber || '-'}</td>
                    <td>{item.driverContact || '-'}</td>
                    <td>
                      <div className="action-group">
                        <button 
                          className="action-icon view"
                          onClick={() => viewDetails(item)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button 
                          className="action-icon pdf"
                          onClick={() => generateSinglePDF(item)}
                          title="Generate PDF"
                        >
                          📄
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for Details */}
      {showModal && selectedRow && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Bill Details</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="info-group">
                <label>Bill Number</label>
                <span>{selectedRow.billNumber}</span>
              </div>
              <div className="info-group">
                <label>Bill Date</label>
                <span>{formatDisplayDate(selectedRow.date)}</span>
              </div>
              <div className="info-group">
                <label>Party Name</label>
                <span>{selectedRow.partyName}</span>
              </div>
              <div className="info-group">
                <label>Packing Details</label>
                <span>{selectedRow.bagDetails}</span>
              </div>
              <div className="info-group">
                <label>Driver Name</label>
                <span>{selectedRow.driverName || 'Not assigned'}</span>
              </div>
              <div className="info-group">
                <label>Vehicle Number</label>
                <span>{selectedRow.vehicleNumber || 'Not assigned'}</span>
              </div>
              <div className="info-group">
                <label>Driver Contact</label>
                <span>{selectedRow.driverContact || 'Not assigned'}</span>
              </div>
              <div className="info-group">
                <label>Porter Required</label>
                <span>{selectedRow.porter === 'YES' ? 'Yes' : 'No'}</span>
              </div>
              <div className="info-group">
                <label>By Hand Quantity</label>
                <span>{selectedRow.byHand || '0'}</span>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatepassDetails;