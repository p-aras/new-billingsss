// PartyBill.js - Blue & White Theme with Traditional Layout
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import "./PartyBill.css";

// Import jsPDF directly (not dynamically)
import jsPDF from 'jspdf';

// Google Apps Script URL - REPLACE WITH YOUR DEPLOYED WEB APP URL
const APPS_CRIPT_URL = "https://script.google.com/macros/s/AKfycbyvQA0bGHiRoEQoNNsC01rZsr8ug8Eefo7KdDr5WKvDyD2qtWK2yYoDj4p3dUfcUrmi/exec";

// Bills Sheet ID - Replace with your Bills sheet ID
const BILLS_SHEET_ID = "1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk";
const BILLS_SHEET_NAME = "Bills";

// Main Google Sheet configuration for reading product data
const SHEET_ID = "1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8";
const SHEET_NAME = "LotBarcodeData";

// OLD LOT Sheet configuration
const OLD_LOT_SHEET_NAME = "OLD LOTS";

const PartyBill = ({ parties, bills, selectedParty, onSubmit, onBack, currentUser }) => {
  // Initialize billForm with selectedParty if provided
  const [billForm, setBillForm] = useState({
    partyName: selectedParty?.name || "",
    billDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    items: [],
    notes: ""
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Debug modal state
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tempBillData, setTempBillData] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editItemData, setEditItemData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Lot search suggestions
  const [lotSearchTerm, setLotSearchTerm] = useState("");
  const [lotSuggestions, setLotSuggestions] = useState([]);
  const [showLotSuggestions, setShowLotSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  
  // Lot Details Modal state
  const [isLotDetailsModalOpen, setIsLotDetailsModalOpen] = useState(false);
  const [lotDetailsData, setLotDetailsData] = useState([]);
  const [loadingLotDetails, setLoadingLotDetails] = useState(false);
  const [selectedLotForDetails, setSelectedLotForDetails] = useState(null);
  
  // Use selectedParty from props if available, otherwise use state
  const [selectedPartyState, setSelectedPartyState] = useState(selectedParty || null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState([]);
  const [oldLotData, setOldLotData] = useState([]);
  const [dataLoadError, setDataLoadError] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [savingToSheet, setSavingToSheet] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [lotSummary, setLotSummary] = useState([]);
  const [loadingLotSummary, setLoadingLotSummary] = useState(false);
  const [selectedLotForSummary, setSelectedLotForSummary] = useState(null);
  
  // On-screen keyboard state
  const [showNumericKeyboard, setShowNumericKeyboard] = useState(false);
  const [manualLotInput, setManualLotInput] = useState("");
  const [searchingManualLot, setSearchingManualLot] = useState(false);
  
  const barcodeInputRef = useRef(null);
  const modalBarcodeInputRef = useRef(null);
  const debugContainerRef = useRef(null);
  const manualLotInputRef = useRef(null);
  
  // Product details for current scan
  const [currentProduct, setCurrentProduct] = useState({
    barcode: "",
    lotNumber: "",
    sets: "",
    setsPerPcs: "",
    loosePcs: 0,
    looseOperation: "add",
    brand: "",
    item: "",
    quantity: 1,
    totalPieces: "",
    colors: [],
    sizes: [],
    sizeQuantities: {},
    colorDetails: {}
  });

  const [scannerDebug, setScannerDebug] = useState([]);

  // Get current user info
  const preparedBy = currentUser?.fullName || currentUser?.username || "System";
  const userRole = currentUser?.role === "admin" ? "Admin" : currentUser?.role === "user" ? "Staff" : "User";
  const userEmail = currentUser?.email || "";

  // ==================== LOT SUGGESTIONS FUNCTIONS ====================
  
  const searchLotsWithSuggestions = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      return;
    }
    
    const allProducts = [...sheetData, ...oldLotData];
    const searchLower = searchTerm.toLowerCase().trim();
    
    const matches = allProducts.filter(product => {
      const lotNumber = product['Lot Number']?.toString().toLowerCase() || "";
      const itemName = product['Garment Type'] || product['Item Name'] || "";
      const brand = product['Party Name'] || product['Brand'] || "";
      
      return lotNumber.includes(searchLower) || 
             itemName.toLowerCase().includes(searchLower) ||
             brand.toLowerCase().includes(searchLower);
    });
    
    const uniqueMatches = [];
    const seen = new Set();
    
    matches.forEach(product => {
      const lotNumber = product['Lot Number']?.toString() || "";
      const description = product['Garment Type'] || product['Item Name'] || "";
      const brand = product['Party Name'] || product['Brand'] || "";
      const key = `${lotNumber}-${description}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push({
          lotNumber: lotNumber,
          barcode: product['Barcode ID'] || `LOT-${lotNumber}`,
          description: description,
          brand: brand,
          piecesPerSet: product['Pieces Per Set'] || product['PiecesPerSet'] || 0,
          totalPieces: product['Total Pieces'] || 0,
          colors: product['Colors'] || [],
          sizes: product['Sizes'] || [],
          source: product['Source'] || 'Main',
          isOldLot: product['Source'] === 'OLD LOT'
        });
      }
    });
    
    const suggestions = uniqueMatches.slice(0, 10);
    setLotSuggestions(suggestions);
    setShowLotSuggestions(suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
    
    addDebugMessage(`Found ${suggestions.length} suggestions for "${searchTerm}"`, 'info');
  };

  const selectLotFromSuggestion = (suggestion) => {
    addDebugMessage(`Selected lot: ${suggestion.lotNumber} - ${suggestion.description}`, 'success');
    
    const productData = {
      barcode: suggestion.barcode,
      lotNumber: suggestion.lotNumber,
      sets: "",
      setsPerPcs: suggestion.piecesPerSet,
      loosePcs: 0,
      looseOperation: "add",
      brand: suggestion.brand,
      item: suggestion.description,
      quantity: 0,
      totalPieces: suggestion.totalPieces,
      colors: suggestion.colors || [],
      sizes: suggestion.sizes || [],
      sizeQuantities: {},
      colorDetails: {}
    };
    
    setCurrentProduct(productData);
    setSelectedLotForSummary(suggestion.lotNumber);
    setManualLotInput(suggestion.lotNumber);
    setLotSearchTerm(suggestion.lotNumber);
    setShowLotSuggestions(false);
    
    playBeepSound();
    showToast(`Selected: ${suggestion.description}`, 'success');
    
    setTimeout(() => {
      const setsInput = document.querySelector('.blue-sets-input');
      if (setsInput) setsInput.focus();
    }, 100);
  };

  const handleLotInputKeyDown = (e) => {
    if (!showLotSuggestions || lotSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleManualLotSearch();
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < lotSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && lotSuggestions[selectedSuggestionIndex]) {
        selectLotFromSuggestion(lotSuggestions[selectedSuggestionIndex]);
      } else {
        handleManualLotSearch();
      }
    } else if (e.key === 'Escape') {
      setShowLotSuggestions(false);
    }
  };

  // ==================== PACKING NUMBER FUNCTIONS ====================
  
  const getNextPackingNumber = async () => {
    try {
      addDebugMessage("Fetching last packing number from Google Sheets...");
      
      const billsData = await fetchBillsFromSheet();
      let lastNumber = 0;
      
      if (billsData && billsData.length > 0) {
        const numbers = [];
        
        for (const bill of billsData) {
          let billNumber = '';
          
          if (bill['Bill Number']) {
            billNumber = bill['Bill Number'];
          }
          else if (bill['Bill Data (JSON)']) {
            try {
              const billData = typeof bill['Bill Data (JSON)'] === 'string' 
                ? JSON.parse(bill['Bill Data (JSON)']) 
                : bill['Bill Data (JSON)'];
              billNumber = billData.billNumber || billData.packingNumber || '';
            } catch (e) {}
          }
          
          if (billNumber && typeof billNumber === 'string' && billNumber.startsWith('PL-')) {
            const numberPart = billNumber.replace('PL-', '');
            
            if (/^\d{3}$/.test(numberPart)) {
              const num = parseInt(numberPart, 10);
              if (!isNaN(num)) {
                numbers.push(num);
                addDebugMessage(`Found sequential bill: ${billNumber} (number: ${num})`, 'info');
              }
            }
          }
        }
        
        if (numbers.length > 0) {
          lastNumber = Math.max(...numbers);
          addDebugMessage(`Found ${numbers.length} sequential bills. Last number: ${lastNumber}`, 'success');
        }
      }
      
      const nextNumber = lastNumber + 1;
      const formattedNumber = String(nextNumber).padStart(3, '0');
      const packingNumber = `PL-${formattedNumber}`;
      
      addDebugMessage(`Generated new packing number: ${packingNumber}`, 'success');
      return packingNumber;
      
    } catch (error) {
      console.error("Error getting next packing number:", error);
      addDebugMessage(`Error: ${error.message}`, 'error');
      const fallbackNumber = `PL-001`;
      showToast(`Could not fetch from sheet, using ${fallbackNumber}`, "warning");
      return fallbackNumber;
    }
  };
  
  // ==================== GOOGLE SHEETS STORAGE FUNCTIONS ====================
  
  const saveBillToGoogleSheet = async (billData) => {
    try {
      setSavingToSheet(true);
      setProcessingStage('sheet');
      addDebugMessage("Saving packing list to Google Sheets...");
      
      const billDataWithPreparer = {
        ...billData,
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        preparedAt: new Date().toISOString()
      };
      
      const encodedData = encodeURIComponent(JSON.stringify(billDataWithPreparer));
      const urlEncodedData = `data=${encodedData}`;
      
      const response = await fetch(APPS_CRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlEncodedData
      });
      
      const result = await response.json();
      
      if (result.success) {
        addDebugMessage(`✅ Packing list ${billData.packingNumber} saved`, 'success');
        showToast(`Packing list saved to Google Sheets`, "success");
        await fetchLotSummary();
        return true;
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error("Error saving to Google Sheets:", error);
      addDebugMessage(`❌ Failed to save: ${error.message}`, 'error');
      showToast("Failed to save to Google Sheets, but PDF is downloaded", "warning");
      return false;
    } finally {
      setSavingToSheet(false);
      if (processingStage === 'sheet') setProcessingStage(null);
    }
  };

  // ==================== LOT DETAILS FUNCTIONS ====================
  
  const fetchLotDetails = async (lotNumber) => {
    setLoadingLotDetails(true);
    setSelectedLotForDetails(lotNumber);
    addDebugMessage(`Fetching details for lot: ${lotNumber}`);
    
    try {
      const billsData = await fetchBillsFromSheet();
      
      if (!billsData || billsData.length === 0) {
        addDebugMessage("No bills data found", 'warning');
        setLotDetailsData([]);
        return;
      }
      
      const lotDispatches = [];
      
      billsData.forEach(bill => {
        if (bill['Bill Data (JSON)']) {
          try {
            const billData = typeof bill['Bill Data (JSON)'] === 'string' 
              ? JSON.parse(bill['Bill Data (JSON)']) 
              : bill['Bill Data (JSON)'];
            
            const matchingItems = billData.items?.filter(item => 
              item.lotNumber === lotNumber
            ) || [];
            
            if (matchingItems.length > 0) {
              matchingItems.forEach(item => {
                lotDispatches.push({
                  packingNumber: billData.packingNumber,
                  partyName: billData.partyName,
                  dispatchDate: billData.billDate || billData.createdDate?.split('T')[0] || 'N/A',
                  quantity: item.quantity,
                  sets: item.sets || 0,
                  setsPerPcs: item.setsPerPcs || 0,
                  loosePcs: item.loosePcs || 0,
                  description: item.description,
                  brand: item.brand || '',
                  preparedBy: billData.preparedBy || 'Unknown'
                });
              });
            }
          } catch (error) {
            console.error("Error parsing bill data:", error);
          }
        }
      });
      
      lotDispatches.sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate));
      
      setLotDetailsData(lotDispatches);
      addDebugMessage(`Found ${lotDispatches.length} dispatches for lot ${lotNumber}`, 'success');
      
    } catch (error) {
      console.error("Error fetching lot details:", error);
      addDebugMessage(`Failed to load lot details: ${error.message}`, 'error');
      setLotDetailsData([]);
    } finally {
      setLoadingLotDetails(false);
    }
  };
  
  const fetchBillsFromSheet = async () => {
    try {
      const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${BILLS_SHEET_ID}/values/${BILLS_SHEET_NAME}?key=${API_KEY}`;
      
      addDebugMessage(`Fetching bills from: ${apiUrl}`, 'info');
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      addDebugMessage(`Sheet response received, rows: ${result.values?.length || 0}`, 'info');
      
      if (result.values && result.values.length > 1) {
        const headers = result.values[0];
        addDebugMessage(`Headers: ${headers.join(', ')}`, 'info');
        
        const rows = result.values.slice(1);
        
        const bills = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        
        addDebugMessage(`Parsed ${bills.length} bills from sheet`, 'success');
        return bills;
      }
      
      addDebugMessage(`No data found in sheet`, 'warning');
      return [];
    } catch (error) {
      console.error("Error fetching bills:", error);
      addDebugMessage(`Failed to fetch bills: ${error.message}`, 'error');
      return [];
    }
  };

  // ==================== LOT SUMMARY FUNCTIONS ====================
  
  const fetchLotSummaryWithData = async (allProductData) => {
    setLoadingLotSummary(true);
    addDebugMessage("Fetching lot summary from Bills sheet...");
    
    try {
      const billsData = await fetchBillsFromSheet();
      
      if (!billsData || billsData.length === 0) {
        addDebugMessage("No bills data found", 'warning');
        setLotSummary([]);
        return;
      }
      
      const dispatchedMap = new Map();
      
      billsData.forEach(bill => {
        if (bill['Bill Data (JSON)']) {
          try {
            const billData = typeof bill['Bill Data (JSON)'] === 'string' 
              ? JSON.parse(bill['Bill Data (JSON)']) 
              : bill['Bill Data (JSON)'];
            
            if (billData.items) {
              billData.items.forEach(item => {
                const lotNumber = item.lotNumber;
                if (lotNumber) {
                  const dispatchedQty = item.quantity || 0;
                  dispatchedMap.set(lotNumber, (dispatchedMap.get(lotNumber) || 0) + dispatchedQty);
                }
              });
            }
          } catch (error) {
            console.error("Error parsing bill data:", error);
          }
        }
      });
      
      addDebugMessage(`Dispatched totals: ${JSON.stringify(Object.fromEntries(dispatchedMap))}`, 'info');
      
      const summary = [];
      const processedLots = new Set();
      
      // Process OLD LOTS
      addDebugMessage(`Processing ${oldLotData.length} OLD LOTS...`, 'info');
      oldLotData.forEach(oldLot => {
        const lotNumber = oldLot['Lot Number'];
        if (lotNumber && !processedLots.has(lotNumber)) {
          processedLots.add(lotNumber);
          const dispatchedQty = dispatchedMap.get(lotNumber) || 0;
          
          summary.push({
            lotNumber: lotNumber,
            totalPieces: 0,
            dispatchedQty: dispatchedQty,
            pendingPieces: Infinity,
            availablePieces: Infinity,
            status: 'OLD STOCK',
            isOldLot: true
          });
          
          addDebugMessage(`OLD LOT ${lotNumber}: Unlimited stock, Dispatched: ${dispatchedQty}`, 'success');
        }
      });
      
      // Process regular lots
      addDebugMessage(`Processing ${sheetData.length} regular lots...`, 'info');
      sheetData.forEach(product => {
        const lotNumber = product['Lot Number'];
        if (lotNumber && !processedLots.has(lotNumber)) {
          processedLots.add(lotNumber);
          
          let totalPieces = product['Total Pieces'];
          if (!totalPieces || totalPieces === 0) {
            const piecesPerSet = parseInt(product['Pieces Per Set']) || 0;
            const numberOfSets = parseInt(product['Number of Sets']) || parseInt(product['Total Sets']) || 0;
            totalPieces = piecesPerSet * numberOfSets;
          }
          totalPieces = Number(totalPieces) || 0;
          
          const dispatchedQty = dispatchedMap.get(lotNumber) || 0;
          const availablePieces = Math.max(0, totalPieces - dispatchedQty);
          
          let status = 'PENDING';
          if (totalPieces > 0) {
            if (availablePieces <= 0) status = 'COMPLETED';
            else if (dispatchedQty > 0) status = 'PARTIAL';
          }
          
          summary.push({
            lotNumber: lotNumber,
            totalPieces: totalPieces,
            dispatchedQty: dispatchedQty,
            pendingPieces: totalPieces - dispatchedQty,
            availablePieces: availablePieces,
            status: status,
            isOldLot: false
          });
          
          addDebugMessage(`Regular lot ${lotNumber}: Total=${totalPieces}, Dispatched=${dispatchedQty}, Available=${availablePieces}`, 'info');
        }
      });
      
      for (const [lotNumber, dispatchedQty] of dispatchedMap) {
        if (!processedLots.has(lotNumber)) {
          summary.push({
            lotNumber: lotNumber,
            totalPieces: 0,
            dispatchedQty: dispatchedQty,
            pendingPieces: 0,
            availablePieces: 0,
            status: 'COMPLETED',
            isOldLot: false
          });
        }
      }
      
      const statusOrder = { 'OLD STOCK': 0, 'PENDING': 1, 'PARTIAL': 2, 'COMPLETED': 3 };
      summary.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      
      setLotSummary(summary);
      addDebugMessage(`Loaded summary for ${summary.length} lots (${summary.filter(l => l.isOldLot).length} old lots)`, 'success');
      
    } catch (error) {
      console.error("Error fetching lot summary:", error);
      addDebugMessage(`Failed to load lot summary: ${error.message}`, 'error');
    } finally {
      setLoadingLotSummary(false);
    }
  };

  const fetchLotSummary = async () => {
    const allData = [...sheetData, ...oldLotData];
    await fetchLotSummaryWithData(allData);
  };
  
  const checkLotAvailability = (lotNumber, requestedQty) => {
    const lot = lotSummary.find(l => l.lotNumber === lotNumber);
    if (!lot) {
      return { available: true, message: "New lot - no previous dispatches" };
    }
    
    if (lot.isOldLot) {
      return { available: true, message: "Old stock - no restrictions" };
    }
    
    if (requestedQty > lot.availablePieces) {
      return { 
        available: false, 
        message: `Only ${lot.availablePieces} pieces available. Requested: ${requestedQty}`,
        availablePieces: lot.availablePieces
      };
    }
    
    return { available: true, message: "Available for dispatch" };
  };
  
  const getLotInfo = (lotNumber) => {
    if (!lotNumber) return null;
    return lotSummary.find(l => l.lotNumber === lotNumber);
  };

  // ==================== BARCODE SCANNER FUNCTIONS ====================

  const normalizeBarcode = (barcode) => {
    if (!barcode) return barcode;
    
    const barcodeStr = barcode.toString().trim();
    let normalized = barcodeStr;
    
    if (barcodeStr.toLowerCase().startsWith('ot-')) {
      normalized = 'LOT-' + barcodeStr.substring(3);
    }
    else if (barcodeStr.toLowerCase().startsWith('lot') && !barcodeStr.toLowerCase().startsWith('lot-')) {
      normalized = 'LOT-' + barcodeStr.substring(3);
    }
    else if (/^\d{5}-\d+$/.test(barcodeStr)) {
      normalized = 'LOT-' + barcodeStr;
    }
    else if (barcodeStr.toLowerCase().startsWith('ot') && !barcodeStr.toLowerCase().startsWith('ot-')) {
      normalized = 'LOT-' + barcodeStr.substring(2);
    }
    
    return normalized;
  };

  const addDebugMessage = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setScannerDebug(prev => [...prev, { timestamp, message, type }].slice(-20));
    console.log(`[Scanner Debug ${timestamp}]:`, message);
  };

  const getMockData = () => {
    return [
      {
        'Barcode ID': 'LOT-61105-1775474477729',
        'Lot Number': '61105',
        'Party Name': 'Fashion Hub',
        'Garment Type': 'Premium T-Shirt',
        'Colors': ['Red', 'Blue', 'Black'],
        'Sizes': ['S', 'M', 'L', 'XL'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Fashion Hub',
        'Item Name': 'Premium T-Shirt',
        'Pieces Per Set': 5,
        'Number of Sets': 100,
        'Total Pieces': 500
      },
      {
        'Barcode ID': 'LOT-78901-1234567890123',
        'Lot Number': '78901',
        'Party Name': 'Style Mart',
        'Garment Type': 'Slim Fit Jeans',
        'Colors': ['Blue', 'Black'],
        'Sizes': ['30', '32', '34', '36'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Style Mart',
        'Item Name': 'Slim Fit Jeans',
        'Pieces Per Set': 1,
        'Number of Sets': 300,
        'Total Pieces': 300
      },
      {
        'Barcode ID': 'LOT-56789-9876543210987',
        'Lot Number': '56789',
        'Party Name': 'Elegant Wear',
        'Garment Type': 'Formal Shirt',
        'Colors': ['White', 'Blue', 'Pink'],
        'Sizes': ['S', 'M', 'L', 'XL', 'XXL'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Elegant Wear',
        'Item Name': 'Formal Shirt',
        'Pieces Per Set': 3,
        'Number of Sets': 150,
        'Total Pieces': 450
      }
    ];
  };

  const fetchOldLotData = async () => {
    addDebugMessage("Fetching OLD LOT data from Google Sheets...");
    
    try {
      let oldLotDataArray = [];
      
      const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${OLD_LOT_SHEET_NAME}?key=${API_KEY}`;
      
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const result = await response.json();
          if (result.values && result.values.length > 1) {
            oldLotDataArray = parseOldLotSheetData(result.values);
            addDebugMessage(`Loaded ${oldLotDataArray.length} products from OLD LOT sheet`, 'success');
          } else {
            addDebugMessage(`OLD LOT sheet is empty`, 'warning');
          }
        } else {
          addDebugMessage(`Failed to fetch OLD LOT sheet: ${response.status}`, 'warning');
        }
      } catch (apiError) {
        addDebugMessage(`Error fetching OLD LOT sheet: ${apiError.message}`, 'warning');
      }
      
      setOldLotData(oldLotDataArray);
      return oldLotDataArray;
      
    } catch (error) {
      console.error("Error fetching OLD LOT data:", error);
      addDebugMessage(`Failed to load OLD LOT data: ${error.message}`, 'error');
      return [];
    }
  };

  const parseOldLotSheetData = (values) => {
    if (!values || values.length < 2) return [];
    
    const headers = values[0];
    addDebugMessage(`OLD LOT sheet headers: ${headers.join(', ')}`, 'info');
    
    const rows = values.slice(1);
    const parsedProducts = [];
    
    const lotNumberColIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('lot') || h.toLowerCase().includes('number'))
    );
    const fullDescriptionColIndex = headers.findIndex(h => 
      h && (h.toLowerCase().includes('description') || h.toLowerCase().includes('item') || h.toLowerCase().includes('product'))
    );
    
    addDebugMessage(`Lot Number column index: ${lotNumberColIndex}, Description column index: ${fullDescriptionColIndex}`, 'info');
    
    rows.forEach((row, idx) => {
      let combinedData = row[0] || '';
      let lotNumber = '';
      
      if (lotNumberColIndex !== -1 && row[lotNumberColIndex]) {
        lotNumber = row[lotNumberColIndex].toString().trim();
        combinedData = row[fullDescriptionColIndex !== -1 ? fullDescriptionColIndex : 0] || '';
      } else {
        const match = combinedData.match(/^(\d+)/);
        if (match) {
          lotNumber = match[1];
        }
      }
      
      if (!lotNumber) return;
      
      let itemName = '';
      let brand = '';
      let piecesPerSet = 0;
      
      if (combinedData) {
        let description = combinedData.replace(/^\d+\s*/, '').trim();
        
        const pcsMatch = description.match(/(\d+)\s*[Ss]?$/);
        if (pcsMatch) {
          piecesPerSet = parseInt(pcsMatch[1], 10);
          description = description.replace(/\s*\d+\s*[Ss]?$/, '').trim();
        }
        
        const words = description.split(/\s+/);
        const brandIndicators = ['EDGE', 'GENTS', 'CLASSIC', 'PREMIUM', 'BASIC', 'PRO'];
        let brandIndex = -1;
        
        for (let i = 0; i < words.length; i++) {
          if (brandIndicators.includes(words[i].toUpperCase())) {
            brandIndex = i;
            break;
          }
        }
        
        if (brandIndex !== -1) {
          brand = words[brandIndex];
          words.splice(brandIndex, 1);
          itemName = words.join(' ').trim();
        } else {
          itemName = description;
          brand = '';
        }
        
        itemName = itemName.replace(/\s+/g, ' ').trim();
      }
      
      if (!itemName) {
        itemName = combinedData || `Lot ${lotNumber}`;
      }
      
      parsedProducts.push({
        'Lot Number': lotNumber,
        'Barcode ID': `LOT-${lotNumber}`,
        'Brand': brand,
        'Item Name': itemName,
        'Garment Type': itemName,
        'Pieces Per Set': piecesPerSet,
        'Number of Sets': 1,
        'Total Pieces': 0,
        'Party Name': brand || 'OLD STOCK',
        'Colors': [],
        'Sizes': [],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Source': 'OLD LOT'
      });
      
      addDebugMessage(`Parsed OLD LOT: ${lotNumber} -> Item: ${itemName}, Brand: ${brand}, Pc/Set: ${piecesPerSet}`, 'success');
    });
    
    return parsedProducts;
  };

  const fetchGoogleSheetData = async () => {
    setLoading(true);
    setDataLoadError(false);
    addDebugMessage("Fetching product database...");
    
    try {
      let data = null;
      
      const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
      
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const result = await response.json();
          if (result.values && result.values.length > 1) {
            data = parseSheetData(result.values);
            addDebugMessage(`Loaded ${data.length} products from API`);
          }
        }
      } catch (apiError) {
        addDebugMessage(`API failed: ${apiError.message}`, 'error');
      }
      
      if (!data) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
        const csvResponse = await fetch(csvUrl);
        
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          data = parseCSV(csvText);
          addDebugMessage(`Loaded ${data.length} products from CSV`);
        }
      }
      
      if (!data || data.length === 0) {
        addDebugMessage("Using mock data", 'warning');
        data = getMockData();
        showToast("Using demo data. Could not connect to Google Sheets.", "warning");
      }
      
      setSheetData(data);
      
      const oldLotProducts = await fetchOldLotData();
      
      const allData = [...data, ...oldLotProducts];
      showToast(`Loaded ${data.length} products + ${oldLotProducts.length} old lots = ${allData.length} total`, "success");
      
      await fetchLotSummaryWithData(allData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      const mockData = getMockData();
      setSheetData(mockData);
      setDataLoadError(true);
      showToast("Using demo data", "warning");
      
      const oldLotProducts = await fetchOldLotData();
      const allData = [...mockData, ...oldLotProducts];
      await fetchLotSummaryWithData(allData);
    } finally {
      setLoading(false);
    }
  };

  const parseSheetData = (values) => {
    if (!values || values.length < 2) return [];
    
    const headers = values[0];
    console.log("Sheet headers:", headers);
    addDebugMessage(`Sheet headers: ${headers.join(', ')}`, 'info');
    
    const rows = values.slice(1);
    
    return rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        let value = row[index] || '';
        if (value && (value.startsWith('[') || value.startsWith('{'))) {
          try { value = JSON.parse(value); } catch(e) {}
        }
        obj[header] = value;
      });
      return obj;
    }).filter(row => row['Lot Number'] && row['Lot Number'] !== '');
  };

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        
        const row = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          if (value && (value.startsWith('[') || value.startsWith('{'))) {
            try { value = JSON.parse(value); } catch(e) {}
          }
          row[header] = value;
        });
        return row;
      })
      .filter(row => row['Lot Number'] && row['Lot Number'] !== '');
  };

  const searchProductByBarcode = (barcode) => {
    addDebugMessage(`Searching for: "${barcode}"`);
    
    const normalizedBarcode = normalizeBarcode(barcode);
    const allProducts = [...sheetData, ...oldLotData];
    
    if (allProducts.length === 0) {
      addDebugMessage("Database empty!", 'error');
      return null;
    }
    
    const product = allProducts.find(item => {
      const itemBarcode = item['Barcode ID']?.toString();
      const itemLot = item['Lot Number']?.toString();
      const searchTerm = barcode.toString();
      const normalizedSearch = normalizedBarcode.toString();
      
      return itemBarcode === searchTerm || 
             itemLot === searchTerm ||
             itemBarcode === normalizedSearch ||
             itemLot === normalizedSearch;
    });
    
    if (product) {
      addDebugMessage(`Found: ${product['Garment Type'] || product['Item Name']} (Source: ${product['Source'] || 'Main Sheet'})`, 'success');
    } else {
      addDebugMessage(`Not found: "${barcode}"`, 'error');
    }
    
    return product;
  };

  const calculateTotalQuantity = (sets, setsPerPcs, loosePcs, looseOperation = "add") => {
    const setsNum = parseInt(sets) || 0;
    const piecesPerSetNum = parseInt(setsPerPcs) || 0;
    const loosePcsNum = parseInt(loosePcs) || 0;
    const baseQuantity = setsNum * piecesPerSetNum;
    
    if (looseOperation === "subtract") {
      return Math.max(0, baseQuantity - loosePcsNum);
    } else {
      return baseQuantity + loosePcsNum;
    }
  };

  const searchByLotNumber = (lotNumber) => {
    addDebugMessage(`Searching for lot number: "${lotNumber}"`);
    
    const allProducts = [...sheetData, ...oldLotData];
    
    if (allProducts.length === 0) {
      addDebugMessage("Database empty!", 'error');
      return null;
    }
    
    const product = allProducts.find(item => {
      const itemLot = item['Lot Number']?.toString();
      return itemLot === lotNumber.toString();
    });
    
    if (product) {
      addDebugMessage(`Found product for lot ${lotNumber}: ${product['Garment Type'] || product['Item Name']} (Source: ${product['Source'] || 'Main Sheet'})`, 'success');
    } else {
      addDebugMessage(`No product found for lot number: "${lotNumber}"`, 'error');
    }
    
    return product;
  };

  const handleManualLotSearch = async () => {
    if (!manualLotInput.trim()) {
      showToast("Please enter a lot number", "error");
      return;
    }
    
    setSearchingManualLot(true);
    
    const foundProduct = searchByLotNumber(manualLotInput.trim());
    
    if (foundProduct) {
      let colors = foundProduct['Colors'];
      let sizes = foundProduct['Sizes'];
      
      if (typeof colors === 'string') {
        try { colors = JSON.parse(colors); } catch(e) { colors = []; }
      }
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes); } catch(e) { sizes = []; }
      }
      
      const dbPiecesPerSet = foundProduct['Pieces Per Set'] || foundProduct['PiecesPerSet'] || "";
      const lotNumber = foundProduct['Lot Number'] || "";
      
      const productData = {
        barcode: foundProduct['Barcode ID'] || `LOT-${lotNumber}`,
        lotNumber: lotNumber,
        sets: "",
        setsPerPcs: dbPiecesPerSet,
        loosePcs: 0,
        looseOperation: "add",
        brand: foundProduct['Party Name'] || foundProduct['Brand'] || "",
        item: foundProduct['Garment Type'] || foundProduct['Item Name'] || "",
        quantity: 0,
        totalPieces: foundProduct['Total Pieces'] || 0,
        colors: colors || [],
        sizes: sizes || [],
        sizeQuantities: {},
        colorDetails: {}
      };
      
      setCurrentProduct(productData);
      setSelectedLotForSummary(lotNumber);
      playBeepSound();
      showToast(`Found: ${productData.item} (${foundProduct['Source'] || 'Main'})`, 'success');
      
      setShowNumericKeyboard(false);
      setManualLotInput("");
      setLotSearchTerm("");
      
      setTimeout(() => {
        const setsInput = document.querySelector('.blue-sets-input');
        if (setsInput) setsInput.focus();
      }, 100);
    } else {
      showToast(`Lot number "${manualLotInput}" not found in database`, "error");
    }
    
    setSearchingManualLot(false);
  };

  const handleBarcodeScan = async (barcode) => {
    addDebugMessage(`Scan: "${barcode}"`);
    
    if (lastScannedBarcode === barcode) return;
    
    setLastScannedBarcode(barcode);
    setLoading(true);
    
    setCurrentProduct(prev => ({ ...prev, barcode: barcode, item: "Searching..." }));
    
    const foundProduct = searchProductByBarcode(barcode);
    
    if (foundProduct) {
      let colors = foundProduct['Colors'];
      let sizes = foundProduct['Sizes'];
      
      if (typeof colors === 'string') {
        try { colors = JSON.parse(colors); } catch(e) { colors = []; }
      }
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes); } catch(e) { sizes = []; }
      }
      
      const dbPiecesPerSet = foundProduct['Pieces Per Set'] || foundProduct['PiecesPerSet'] || "";
      const lotNumber = foundProduct['Lot Number'] || "";
      
      const productData = {
        barcode: foundProduct['Barcode ID'] || barcode,
        lotNumber: lotNumber,
        sets: "",
        setsPerPcs: dbPiecesPerSet,
        loosePcs: 0,
        looseOperation: "add",
        brand: foundProduct['Party Name'] || foundProduct['Brand'] || "",
        item: foundProduct['Garment Type'] || foundProduct['Item Name'] || "",
        quantity: 0,
        totalPieces: foundProduct['Total Pieces'] || 0,
        colors: colors || [],
        sizes: sizes || [],
        sizeQuantities: {},
        colorDetails: {}
      };
      
      setCurrentProduct(productData);
      setSelectedLotForSummary(lotNumber);
      playBeepSound();
      showToast(`Found: ${productData.item} (${foundProduct['Source'] || 'Main'})`, 'success');
      
      setTimeout(() => {
        const setsInput = document.querySelector('.blue-sets-input');
        if (setsInput) setsInput.focus();
      }, 100);
    } else {
      setCurrentProduct({
        barcode: normalizeBarcode(barcode),
        lotNumber: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: 0,
        looseOperation: "add",
        brand: "",
        item: "",
        quantity: 1,
        totalPieces: "",
        colors: [],
        sizes: [],
        sizeQuantities: {},
        colorDetails: {}
      });
      showToast(`New barcode: ${barcode}`, 'info');
    }
    
    setLoading(false);
    setTimeout(() => setLastScannedBarcode(""), 2000);
  };

  const handleKeyboardKeyPress = (key) => {
    if (key === 'CLEAR') {
      setManualLotInput('');
      setLotSearchTerm('');
    } else if (key === '⌫') {
      setManualLotInput(prev => prev.slice(0, -1));
      setLotSearchTerm(prev => prev.slice(0, -1));
    } else {
      setManualLotInput(prev => prev + key);
      setLotSearchTerm(prev => prev + key);
    }
  };

  const handleKeyboardSubmit = () => {
    handleManualLotSearch();
  };

  useEffect(() => {
    let keyBuffer = '';
    let scanTimer = null;
    
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        if (keyBuffer.length > 0) {
          handleBarcodeScan(keyBuffer.trim());
          keyBuffer = '';
          if (scanTimer) clearTimeout(scanTimer);
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        keyBuffer += event.key;
        if (!isScannerActive) {
          setIsScannerActive(true);
          setTimeout(() => setIsScannerActive(false), 500);
        }
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          if (keyBuffer.length > 0 && keyBuffer.length < 5) keyBuffer = '';
          scanTimer = null;
        }, 100);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isScannerActive]);
  
  useEffect(() => {
    if (!isModalOpen) {
      setLotSearchTerm("");
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      setManualLotInput("");
    }
  }, [isModalOpen]);

  useEffect(() => {
    const newQuantity = calculateTotalQuantity(
      currentProduct.sets, 
      currentProduct.setsPerPcs, 
      currentProduct.loosePcs,
      currentProduct.looseOperation
    );
    if (newQuantity !== currentProduct.quantity) {
      setCurrentProduct(prev => ({ ...prev, quantity: newQuantity }));
    }
  }, [currentProduct.sets, currentProduct.setsPerPcs, currentProduct.loosePcs, currentProduct.looseOperation]);

  const handleManualBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput.trim());
      setBarcodeInput("");
    }
  };

  const testScanner = () => {
    showToast("Scanner ready - Scan a barcode", "info");
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const refreshSheetData = () => {
    fetchGoogleSheetData();
  };

  const addProductToBill = () => {
    if (!currentProduct.item) {
      showToast("Please enter item name", "error");
      return;
    }
    if (currentProduct.quantity <= 0) {
      showToast("Please enter valid quantity", "error");
      return;
    }
    
    if (currentProduct.lotNumber) {
      const lotInfo = lotSummary.find(l => l.lotNumber === currentProduct.lotNumber);
      const isOldLot = lotInfo && lotInfo.isOldLot;
      
      if (!isOldLot) {
        const availability = checkLotAvailability(currentProduct.lotNumber, currentProduct.quantity);
        if (!availability.available) {
          showToast(availability.message, "error");
          return;
        }
      }
    }
    
    const newItem = {
      id: Date.now(),
      barcode: currentProduct.barcode,
      lotNumber: currentProduct.lotNumber,
      sets: currentProduct.sets || 0,
      setsPerPcs: currentProduct.setsPerPcs || 0,
      loosePcs: currentProduct.loosePcs || 0,
      looseOperation: currentProduct.looseOperation || "add",
      brand: currentProduct.brand,
      description: currentProduct.item,
      quantity: currentProduct.quantity,
      colors: currentProduct.colors,
      sizes: currentProduct.sizes
    };
    
    setBillForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
    
    setCurrentProduct({
      barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
      looseOperation: "add",
      brand: "", item: "", quantity: 1, totalPieces: "",
      colors: [], sizes: [], sizeQuantities: {}, colorDetails: {}
    });
    
    showToast(`Added: ${currentProduct.item}`, 'success');
    setIsModalOpen(false);
    
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const updateCurrentProduct = (field, value) => {
    setCurrentProduct(prev => ({ ...prev, [field]: value }));
  };

  const removeItem = (index) => {
    const updatedItems = billForm.items.filter((_, i) => i !== index);
    setBillForm({ ...billForm, items: updatedItems });
    showToast('Item removed', 'info');
  };

  const updateItemDetails = (index, field, value) => {
    const updatedItems = [...billForm.items];
    
    if (field === 'looseOperation') {
      updatedItems[index][field] = value;
    } else {
      const numValue = parseInt(value) || 0;
      updatedItems[index][field] = numValue;
    }
    
    const currentSets = field === 'sets' ? (parseInt(value) || 0) : updatedItems[index].sets;
    const currentPcsPerSet = field === 'setsPerPcs' ? (parseInt(value) || 0) : updatedItems[index].setsPerPcs;
    const currentLoosePcs = field === 'loosePcs' ? (parseInt(value) || 0) : updatedItems[index].loosePcs;
    const currentOperation = field === 'looseOperation' ? value : (updatedItems[index].looseOperation || "add");
    
    const newQuantity = calculateTotalQuantity(currentSets, currentPcsPerSet, currentLoosePcs, currentOperation);
    updatedItems[index].quantity = newQuantity;
    
    const item = updatedItems[index];
    if (item.lotNumber) {
      const lotInfo = lotSummary.find(l => l.lotNumber === item.lotNumber);
      const isOldLot = lotInfo && lotInfo.isOldLot;
      
      if (!isOldLot && lotInfo) {
        const existingLotItems = updatedItems.filter(i => i.lotNumber === item.lotNumber && i.id !== item.id);
        const totalRequested = existingLotItems.reduce((sum, i) => sum + i.quantity, 0) + newQuantity;
        
        if (totalRequested > lotInfo.availablePieces) {
          showToast(`Warning: Total requested (${totalRequested}) exceeds available (${lotInfo.availablePieces})`, "warning");
        }
      }
    }
    
    setBillForm({ ...billForm, items: updatedItems });
  };

  const openEditModal = (index) => {
    const item = billForm.items[index];
    setEditingItemIndex(index);
    setEditItemData({ ...item });
    setIsEditModalOpen(true);
  };

  const saveEditedItem = () => {
    if (editItemData && editingItemIndex !== null) {
      if (editItemData.quantity <= 0) {
        showToast("Quantity must be greater than 0", "error");
        return;
      }
      
      if (editItemData.lotNumber) {
        const lotInfo = lotSummary.find(l => l.lotNumber === editItemData.lotNumber);
        const isOldLot = lotInfo && lotInfo.isOldLot;
        
        if (!isOldLot) {
          const availability = checkLotAvailability(editItemData.lotNumber, editItemData.quantity);
          if (!availability.available) {
            showToast(availability.message, "error");
            return;
          }
        }
      }
      
      const updatedItems = [...billForm.items];
      updatedItems[editingItemIndex] = editItemData;
      setBillForm({ ...billForm, items: updatedItems });
      setIsEditModalOpen(false);
      setEditingItemIndex(null);
      setEditItemData(null);
      showToast("Item updated successfully", "success");
    }
  };

  const openConfirmationModal = () => {
    if (billForm.items.length === 0) {
      showToast("Please add at least one item", "error");
      return;
    }
    if (!selectedPartyState) {
      showToast("Please select a party", "error");
      return;
    }
    
    setTempBillData({ ...billForm });
    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsConfirmModalOpen(false);
    
    const packingNumber = await getNextPackingNumber();
    
    const packingDataForStorage = {
      billNumber: packingNumber,
      packingNumber: packingNumber,
      partyName: selectedPartyState?.name || billForm.partyName,
      billDate: billForm.billDate,
      dueDate: billForm.dueDate,
      orderReference: billForm.orderReference || "",
      items: billForm.items.map(item => ({
        id: item.id,
        barcode: item.barcode,
        lotNumber: item.lotNumber,
        brand: item.brand,
        description: item.description,
        sets: item.sets,
        setsPerPcs: item.setsPerPcs,
        loosePcs: item.loosePcs,
        looseOperation: item.looseOperation || "add",
        quantity: item.quantity,
        colors: item.colors,
        sizes: item.sizes
      })),
      notes: billForm.notes,
      createdDate: new Date().toISOString(),
      preparedBy: preparedBy,
      preparedByRole: userRole,
      preparedByEmail: userEmail
    };
    
    const pdfGenerated = await generatePackingList(packingDataForStorage);
    
    if (pdfGenerated) {
      await saveBillToGoogleSheet(packingDataForStorage);
      setShowSuccessAnimation(true);
      setProcessingStage('complete');
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      setTimeout(() => setProcessingStage(null), 2000);
      
      if (onSubmit) onSubmit(packingDataForStorage);
      
      setBillForm({
        partyName: selectedParty?.name || "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        items: [],
        notes: ""
      });
      if (!selectedParty) setSelectedPartyState(null);
      setCurrentProduct({
        barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
        looseOperation: "add",
        brand: "", item: "", quantity: 1, totalPieces: "",
        colors: [], sizes: [], sizeQuantities: {}, colorDetails: {}
      });
      showToast(`Packing list ${packingNumber} generated!`, 'success');
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
      
      await fetchLotSummary();
    }
  };

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.1;
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
      oscillator.stop(audioContext.currentTime + 0.2);
      setTimeout(() => audioContext.close(), 300);
    } catch (error) {}
  };

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `blue-toast ${type}`;
    toast.innerHTML = `<div class="blue-toast-content"><span>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };
  
  const generatePackingList = async (packingData) => {
    if (!packingData || !packingData.items || packingData.items.length === 0) {
      console.error("Invalid packing data");
      setGeneratingPDF(false);
      setProcessingStage(null);
      return false;
    }

    setGeneratingPDF(true);
    setProcessingStage('pdf');
    
    try {
      const documentTypes = [
        { name: "Customer", subheading: "PACKING LIST FOR CUSTOMER" },
        { name: "Account", subheading: "PACKING LIST FOR ACCOUNT OFFICE" },
        { name: "Audit", subheading: "PACKING LIST FOR AUDIT" }
      ];

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 15;
      const rightMargin = 15;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const uniqueLots = new Set(packingData.items.map(item => item.lotNumber)).size;
      const totalItems = packingData.items.length;
      const totalQuantity = packingData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalSets = packingData.items.reduce((sum, item) => sum + (parseInt(item.sets) || 0), 0);

      const MAX_ROWS_PER_PAGE = 14;

      const drawPageBorder = () => {
        doc.setLineWidth(0.5);
        doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
        doc.setLineWidth(0.3);
      };

      const drawHeader = (docType, yPos) => {
        doc.setFont("times", "bold");
        doc.setFontSize(22);
        doc.text("Packing List", pageWidth / 2, yPos, { align: "center" });
        yPos += 8;
        
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.setTextColor(70, 70, 200);
        doc.text(docType.subheading, pageWidth / 2, yPos, { align: "center" });
        doc.setTextColor(0, 0, 0);
        yPos += 12;

        doc.rect(leftMargin, yPos, contentWidth, 40);
        
        const midPoint = leftMargin + (contentWidth * 0.6);
        doc.line(midPoint, yPos, midPoint, yPos + 40);

        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.text(`Date :-  ${packingData.billDate || new Date().toLocaleDateString()}`, leftMargin + 3, yPos + 7);
        doc.text(`Order Reference :-  ${packingData.orderReference || 'N/A'}`, leftMargin + 3, yPos + 15);
        doc.text(`Bill to :-  ${packingData.partyName || 'N/A'}`, leftMargin + 3, yPos + 23);
        doc.text(`Document No :-  ${packingData.packingNumber || 'N/A'}`, leftMargin + 3, yPos + 31);

        doc.setFont("times", "bold");
        doc.setFontSize(10);
        
        doc.text(`Total Lots :-`, midPoint + 3, yPos + 7);
        doc.text(uniqueLots.toString(), midPoint + 35, yPos + 7);
        
        doc.text(`Total Items :-`, midPoint + 3, yPos + 15);
        doc.text(totalItems.toString(), midPoint + 35, yPos + 15);
        
        doc.text(`Total Qty :-`, midPoint + 3, yPos + 23);
        doc.text(totalQuantity.toString(), midPoint + 35, yPos + 23);
        
        doc.text(`Total Sets :-`, midPoint + 3, yPos + 31);
        doc.text(totalSets.toString(), midPoint + 35, yPos + 31);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated by: ${preparedBy} (${userRole})`, leftMargin + 3, yPos + 38);
        doc.setTextColor(0, 0, 0);

        return yPos + 50;
      };

      const drawTableHeader = (yPos, docType) => {
        let tableColumns;
        
        if (docType.name === "Account") {
          tableColumns = [
            { header: "S.No", width: 10 },
            { header: "Lot Number", width: 20 },
            { header: "Brand", width: 25 },
            { header: "Description", width: 45 },
            { header: "Sets", width: 17 },
            { header: "Pc/Set", width: 17 },
            { header: "Loose Pc", width: 17 },
            { header: "Total Qty", width: 20 },
            { header: "✓", width: 8 }
          ];
        } else {
          tableColumns = [
            { header: "S.No", width: 10 },
            { header: "Lot Number", width: 20 },
            { header: "Brand", width: 25 },
            { header: "Description", width: 50 },
            { header: "Sets", width: 17 },
            { header: "Pc/Set", width: 17 },
            { header: "Loose Pc", width: 17 },
            { header: "Total Qty", width: 23 }
          ];
        }

        doc.setFont("times", "bold");
        doc.setFillColor(240, 240, 240);
        doc.rect(leftMargin, yPos, contentWidth, 10, 'F');
        doc.rect(leftMargin, yPos, contentWidth, 10);
        
        let currentX = leftMargin;
        tableColumns.forEach(col => {
          const textWidth = doc.getTextWidth(col.header);
          const textX = currentX + (col.width / 2) - (textWidth / 2);
          doc.text(col.header, textX, yPos + 7);
          currentX += col.width;
          if (currentX < pageWidth - rightMargin) {
            doc.line(currentX, yPos, currentX, yPos + 10);
          }
        });
        
        return yPos + 10;
      };

      const drawCheckbox = (x, y, size = 3) => {
        doc.rect(x, y, size, size);
      };

      const drawTableRow = (item, index, yPos, docType) => {
        let tableColumns;
        
        if (docType.name === "Account") {
          tableColumns = [
            { width: 10 }, { width: 20 }, { width: 25 }, { width: 45 },
            { width: 17 }, { width: 17 }, { width: 17 }, { width: 20 }, { width: 8 }
          ];
        } else {
          tableColumns = [
            { width: 10 }, { width: 20 }, { width: 25 }, { width: 50 },
            { width: 17 }, { width: 17 }, { width: 17 }, { width: 23 }
          ];
        }
        
        const rowHeight = 10;

        doc.rect(leftMargin, yPos, contentWidth, rowHeight);
        
        let colX = leftMargin;
        tableColumns.forEach(col => {
          colX += col.width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + rowHeight);
          }
        });

        let values;
        if (docType.name === "Account") {
          values = [
            (index + 1).toString(),
            item.lotNumber || "",
            item.brand || "",
            (() => {
              let description = item.description || "";
              const maxChars = 27;
              if (description.length > maxChars) {
                description = description.substring(0, maxChars - 3) + "...";
              }
              return description;
            })(),
            (item.sets || 0).toString(),
            (item.setsPerPcs || 0).toString(),
            (item.loosePcs || 0).toString(),
            (item.quantity || 0).toString(),
            ""
          ];
        } else {
          values = [
            (index + 1).toString(),
            item.lotNumber || "",
            item.brand || "",
            (() => {
              let description = item.description || "";
              const maxChars = 35;
              if (description.length > maxChars) {
                description = description.substring(0, maxChars - 3) + "...";
              }
              return description;
            })(),
            (item.sets || 0).toString(),
            (item.setsPerPcs || 0).toString(),
            (item.loosePcs || 0).toString(),
            (item.quantity || 0).toString()
          ];
        }

        let textX = leftMargin;
        values.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (tableColumns[colIndex].width / 2) - (textWidth / 2);
          
          if (colIndex === tableColumns.length - 1 && docType.name === "Account") {
            const checkboxX = textX + (tableColumns[colIndex].width / 2) - 2;
            const checkboxY = yPos + (rowHeight / 2) - 2;
            drawCheckbox(checkboxX, checkboxY, 4);
          } else {
            doc.text(value, textXPos, yPos + 8);
          }
          
          textX += tableColumns[colIndex].width;
        });

        return rowHeight;
      };

      const drawTableFooter = (yPos, isLastPage, docType) => {
        yPos += 5;
        
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);
        
        if (isLastPage && docType.name === "Account") {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text("□ - Checkbox for item verification", leftMargin + 5, yPos + 6);
          doc.setTextColor(0, 0, 0);
        }
        
        return yPos + 15;
      };

      const drawSignatures = (docType, yPos) => {
        const footerY = pageHeight - 20;
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        
        doc.setLineWidth(0.3);
        
        const sectionWidth = (contentWidth - 20) / 4;
        let currentX = leftMargin;
        
        doc.text("Prepared By", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(7);
        doc.text(`${preparedBy} (${userRole})`, currentX + 5, footerY + 8);
        
        currentX += sectionWidth;
        doc.setFontSize(9);
        doc.text("Account Officer", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(7);
        doc.text("(Name & Signature)", currentX + 5, footerY + 8);
        
        currentX += sectionWidth;
        doc.setFontSize(9);
        doc.text("Checked By", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(7);
        doc.text("(Name & Signature)", currentX + 5, footerY + 8);
        
        currentX += sectionWidth;
        doc.setFontSize(9);
        doc.text("Authorized Signatory", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, pageWidth - rightMargin - 5, footerY + 3);
        doc.setFontSize(7);
        doc.text("(Name & Signature)", currentX + 5, footerY + 8);
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("Company Seal/Stamp", pageWidth / 2 - 15, footerY - 8);
        doc.setTextColor(0, 0, 0);
        
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        if (docType.name === "Account") {
          doc.text("For accounting purposes only - Please verify each item", pageWidth / 2, footerY - 15, { align: "center" });
        } else if (docType.name === "Audit") {
          doc.text("Audit reference document", pageWidth / 2, footerY - 15, { align: "center" });
        } else if (docType.name === "Customer") {
          doc.text("Customer copy - Please retain for your records", pageWidth / 2, footerY - 15, { align: "center" });
        }
        doc.setTextColor(0, 0, 0);
      };

      for (let docIndex = 0; docIndex < documentTypes.length; docIndex++) {
        const docType = documentTypes[docIndex];
        let itemsProcessed = 0;
        let sectionPageCount = 0;
        
        while (itemsProcessed < packingData.items.length) {
          const remainingRows = packingData.items.length - itemsProcessed;
          const rowsOnThisPage = Math.min(MAX_ROWS_PER_PAGE, remainingRows);
          const isLastPageOfSection = (itemsProcessed + rowsOnThisPage) === packingData.items.length;
          
          let yPos = 15;
          
          if (sectionPageCount > 0) {
            doc.addPage();
          } else if (docIndex > 0 && sectionPageCount === 0) {
            doc.addPage();
          }
          
          drawPageBorder();
          yPos = drawHeader(docType, yPos);
          yPos = drawTableHeader(yPos, docType);
          
          for (let i = 0; i < rowsOnThisPage; i++) {
            const item = packingData.items[itemsProcessed];
            const rowHeight = drawTableRow(item, itemsProcessed, yPos, docType);
            yPos += rowHeight;
            itemsProcessed++;
          }
          
          yPos = drawTableFooter(yPos, isLastPageOfSection, docType);
          
          if (isLastPageOfSection) {
            drawSignatures(docType, yPos);
          } else {
            yPos += 5;
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text("... continued on next page", pageWidth / 2, yPos, { align: "center" });
            doc.setTextColor(0, 0, 0);
          }
          
          sectionPageCount++;
        }
      }

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
        doc.setTextColor(0, 0, 0);
      }

      const fileName = `PackingList_${packingData.packingNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      setProcessingStage(null);
      return true;

    } catch (error) {
      console.error("PDF Generation Error:", error);
      setProcessingStage('error');
      return false;
    } finally {
      setTimeout(() => {
        setGeneratingPDF(false);
        setProcessingStage(null);
      }, 500);
    }
  };

  useEffect(() => {
    if (debugContainerRef.current) {
      debugContainerRef.current.scrollTop = debugContainerRef.current.scrollHeight;
    }
  }, [scannerDebug]);

  useEffect(() => {
    fetchGoogleSheetData();
  }, [selectedPartyState]);

  const currentLotInfo = getLotInfo(currentProduct.lotNumber);

  // Numeric Keyboard Component
  const NumericKeyboard = ({ onKeyPress, onSubmit, onClose, value }) => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['CLEAR', '0', '⌫']
    ];

    return (
      <div className="blue-numeric-keyboard-overlay" onClick={onClose}>
        <div className="blue-numeric-keyboard" onClick={(e) => e.stopPropagation()}>
          <div className="blue-keyboard-header">
            <span className="blue-keyboard-title">Enter Lot Number</span>
            <button className="blue-keyboard-close" onClick={onClose}>✕</button>
          </div>
          <div className="blue-keyboard-display">
            <input 
              type="text" 
              value={value} 
              readOnly 
              placeholder="Lot Number"
              className="blue-keyboard-input"
              ref={manualLotInputRef}
            />
          </div>
          <div className="blue-keyboard-keys">
            {keys.map((row, rowIndex) => (
              <div key={rowIndex} className="blue-keyboard-row">
                {row.map((key) => (
                  <button
                    key={key}
                    className={`blue-keyboard-key ${key === 'CLEAR' || key === '⌫' ? 'blue-keyboard-special' : ''} ${key === 'CLEAR' ? 'blue-keyboard-clear' : ''}`}
                    onClick={() => onKeyPress(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="blue-keyboard-footer">
            <button className="blue-keyboard-submit" onClick={onSubmit}>
              Search Lot
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Debug Console Modal Component
  const DebugConsoleModal = () => {
    return (
      <div className="blue-modal-overlay" onClick={() => setIsDebugModalOpen(false)}>
        <div className="blue-modal blue-debug-modal" onClick={(e) => e.stopPropagation()}>
          <div className="blue-modal-header">
            <div className="blue-modal-header-left">
              <span className="blue-modal-icon">🔧</span>
              <h3>Debug Console</h3>
              <span className="blue-modal-badge">Scanner Activity</span>
            </div>
            <button className="blue-modal-close" onClick={() => setIsDebugModalOpen(false)}>✕</button>
          </div>
          <div className="blue-modal-body">
            <div className="blue-debug-messages-full" ref={debugContainerRef}>
              {scannerDebug.length === 0 ? (
                <div className="blue-debug-empty-full">
                  <span className="blue-empty-icon">📡</span>
                  <p>No scanner activity yet...</p>
                  <span className="blue-empty-hint">Scan a barcode to see debug messages</span>
                </div>
              ) : (
                scannerDebug.map((debug, idx) => (
                  <div key={idx} className={`blue-debug-msg-full ${debug.type}`}>
                    <span className="blue-debug-time">[{debug.timestamp}]</span>
                    <span className="blue-debug-message">{debug.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="blue-modal-footer">
            <button 
              onClick={() => {
                setScannerDebug([]);
                addDebugMessage("Debug console cleared", 'info');
              }} 
              className="blue-btn blue-btn-secondary"
            >
              Clear Console
            </button>
            <button onClick={() => setIsDebugModalOpen(false)} className="blue-btn blue-btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Edit Item Modal Component
  const EditItemModal = () => {
    if (!editItemData) return null;
    
    return (
      <div className="blue-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
        <div className="blue-modal blue-modal-medium" onClick={(e) => e.stopPropagation()}>
          <div className="blue-modal-header">
            <div className="blue-modal-header-left">
              <span className="blue-modal-icon">✏️</span>
              <h3>Edit Item</h3>
              <span className="blue-modal-badge">Modify Details</span>
            </div>
            <button className="blue-modal-close" onClick={() => setIsEditModalOpen(false)}>✕</button>
          </div>
          <div className="blue-modal-body">
            <div className="blue-edit-form">
              <div className="blue-form-row">
                <div className="blue-form-field">
                  <label>Lot Number</label>
                  <input type="text" value={editItemData.lotNumber || ""} readOnly className="blue-input blue-input-readonly" />
                </div>
                <div className="blue-form-field">
                  <label>Brand</label>
                  <input type="text" value={editItemData.brand || ""} readOnly className="blue-input blue-input-readonly" />
                </div>
              </div>
              <div className="blue-form-field">
                <label>Description</label>
                <input type="text" value={editItemData.description || ""} readOnly className="blue-input blue-input-readonly" />
              </div>
              <div className="blue-form-row">
                <div className="blue-form-field">
                  <label>Sets</label>
                  <input 
                    type="number" 
                    value={editItemData.sets || 0} 
                    onChange={(e) => {
                      const newSets = parseInt(e.target.value) || 0;
                      const newQuantity = calculateTotalQuantity(
                        newSets, 
                        editItemData.setsPerPcs, 
                        editItemData.loosePcs,
                        editItemData.looseOperation || "add"
                      );
                      setEditItemData({ ...editItemData, sets: newSets, quantity: newQuantity });
                    }} 
                    className="blue-input" 
                  />
                </div>
                <div className="blue-form-field">
                  <label>Pieces per Set (Pc/Set)</label>
                  <input 
                    type="number" 
                    value={editItemData.setsPerPcs || 0} 
                    onChange={(e) => {
                      const newPcsPerSet = parseInt(e.target.value) || 0;
                      const newQuantity = calculateTotalQuantity(
                        editItemData.sets, 
                        newPcsPerSet, 
                        editItemData.loosePcs,
                        editItemData.looseOperation || "add"
                      );
                      setEditItemData({ ...editItemData, setsPerPcs: newPcsPerSet, quantity: newQuantity });
                    }} 
                    className="blue-input" 
                  />
                </div>
              </div>
              <div className="blue-form-row">
                <div className="blue-form-field">
                  <label>Operation</label>
                  <select 
                    value={editItemData.looseOperation || "add"} 
                    onChange={(e) => {
                      const newOperation = e.target.value;
                      const newQuantity = calculateTotalQuantity(
                        editItemData.sets, 
                        editItemData.setsPerPcs, 
                        editItemData.loosePcs, 
                        newOperation
                      );
                      setEditItemData({ ...editItemData, looseOperation: newOperation, quantity: newQuantity });
                    }} 
                    className="blue-select"
                  >
                    <option value="add">➕ Addition (Add to total)</option>
                    <option value="subtract">➖ Subtraction (Subtract from total)</option>
                  </select>
                </div>
                <div className="blue-form-field">
                  <label>Loose Pieces</label>
                  <input 
                    type="number" 
                    value={editItemData.loosePcs || 0} 
                    onChange={(e) => {
                      const newLoose = parseInt(e.target.value) || 0;
                      const newQuantity = calculateTotalQuantity(
                        editItemData.sets, 
                        editItemData.setsPerPcs, 
                        newLoose, 
                        editItemData.looseOperation || "add"
                      );
                      setEditItemData({ ...editItemData, loosePcs: newLoose, quantity: newQuantity });
                    }} 
                    className="blue-input" 
                  />
                </div>
              </div>
              <div className="blue-form-field blue-total-field">
                <label>Total Quantity</label>
                <input type="number" value={editItemData.quantity || 0} readOnly className="blue-input blue-total-input" />
              </div>
            </div>
          </div>
          <div className="blue-modal-footer">
            <button onClick={() => setIsEditModalOpen(false)} className="blue-btn blue-btn-secondary">
              Cancel
            </button>
            <button onClick={saveEditedItem} className="blue-btn blue-btn-primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!tempBillData) return null;
    
    const totalQuantity = tempBillData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalItems = tempBillData.items.length;
    const totalSets = tempBillData.items.reduce((sum, item) => sum + (item.sets || 0), 0);
    
    return (
      <div className="blue-modal-overlay" onClick={() => setIsConfirmModalOpen(false)}>
        <div className="blue-modal blue-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="blue-modal-header">
            <div className="blue-modal-header-left">
              <span className="blue-modal-icon">✅</span>
              <h3>Confirm Packing List</h3>
              <span className="blue-modal-badge">Review Before Submission</span>
            </div>
            <button className="blue-modal-close" onClick={() => setIsConfirmModalOpen(false)}>✕</button>
          </div>
          <div className="blue-modal-body">
            <div className="blue-user-info-bar" style={{ 
              backgroundColor: '#e8f0fe', 
              padding: '10px 15px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              border: '1px solid #cbd5e1'
            }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <div>
                <strong>Prepared by:</strong> {preparedBy}
                <span style={{ marginLeft: '10px', color: '#666' }}>({userRole})</span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <strong>Time:</strong> {new Date().toLocaleString()}
              </div>
            </div>

            <div className="blue-confirm-summary">
              <div className="blue-summary-card">
                <div className="blue-summary-label">Party Name</div>
                <div className="blue-summary-value">{selectedPartyState?.name || tempBillData.partyName}</div>
              </div>
              <div className="blue-summary-card">
                <div className="blue-summary-label">Bill Date</div>
                <div className="blue-summary-value">{tempBillData.billDate}</div>
              </div>
              <div className="blue-summary-card">
                <div className="blue-summary-label">Total Items</div>
                <div className="blue-summary-value">{totalItems}</div>
              </div>
              <div className="blue-summary-card">
                <div className="blue-summary-label">Total Quantity</div>
                <div className="blue-summary-value">{totalQuantity}</div>
              </div>
              <div className="blue-summary-card">
                <div className="blue-summary-label">Total Sets</div>
                <div className="blue-summary-value">{totalSets}</div>
              </div>
            </div>

            <div className="blue-confirm-table-wrapper">
              <table className="blue-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Lot No</th>
                    <th>Brand</th>
                    <th>Description</th>
                    <th>Sets</th>
                    <th>Pc/Set</th>
                    <th>Op</th>
                    <th>Loose</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tempBillData.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="blue-sno">{idx + 1}</td>
                      <td className="blue-lot-cell">
                        {item.lotNumber || '-'}
                        {item.lotNumber && (
                          <button 
                            onClick={() => {
                              setIsConfirmModalOpen(false);
                              openLotDetails(item.lotNumber);
                            }} 
                            className="blue-lot-details-btn"
                            title="View lot dispatch history"
                          >
                            📊
                          </button>
                        )}
                      </td>
                      <td className="blue-brand-cell">{item.brand || '-'}</td>
                      <td className="blue-item-name">{item.description}</td>
                      <td className="blue-qty-cell">{item.sets || 0}</td>
                      <td className="blue-qty-cell">{item.setsPerPcs || 0}</td>
                      <td className="blue-qty-cell">{item.looseOperation === 'subtract' ? '➖' : '➕'}</td>
                      <td className="blue-qty-cell">{item.loosePcs || 0}</td>
                      <td className="blue-qty-cell blue-total-qty">{item.quantity || 0}</td>
                      <td className="blue-actions-cell">
                        <button 
                          onClick={() => {
                            setIsConfirmModalOpen(false);
                            openEditModal(idx);
                          }} 
                          className="blue-edit-btn"
                          title="Edit Item"
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="blue-confirm-notes">
              <label>Notes (Optional)</label>
              <textarea 
                value={tempBillData.notes || ""} 
                onChange={(e) => setTempBillData({ ...tempBillData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                className="blue-textarea"
                rows="2"
              />
            </div>
          </div>
          <div className="blue-modal-footer">
            <button onClick={() => setIsConfirmModalOpen(false)} className="blue-btn blue-btn-secondary">
              Cancel
            </button>
            <button onClick={handleFinalSubmit} className="blue-btn blue-btn-primary blue-btn-large">
              Confirm & Generate
            </button>
          </div>
        </div>
      </div>
    );
  };

  const generateLotSummaryPDF = async (lotNumber, lotDetailsData) => {
    setGeneratingPDF(true);
    
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 12;
      const rightMargin = 12;
      const contentWidth = pageWidth - leftMargin - rightMargin;
      
      const lotInfo = lotSummary.find(l => l.lotNumber === lotNumber);
      const totalPiecesInLot = lotInfo?.totalPieces || 0;
      const alreadyDispatched = lotInfo?.dispatchedQty || 0;
      const remainingPieces = lotInfo?.availablePieces || 0;
      
      const totalDispatched = lotDetailsData.reduce((sum, dispatch) => sum + dispatch.quantity, 0);
      const totalBills = new Set(lotDetailsData.map(d => d.packingNumber)).size;
      
      const totalSets = lotDetailsData.reduce((sum, dispatch) => {
        let setsValue = dispatch.sets || 0;
        
        if (typeof setsValue === 'string' && setsValue.includes('+')) {
          const parts = setsValue.split('+').map(Number);
          setsValue = parts.reduce((a, b) => a + b, 0);
        }
        else if (typeof setsValue === 'string') {
          setsValue = parseInt(setsValue, 10) || 0;
        }
        
        return sum + setsValue;
      }, 0);
      
      const totalLoosePcs = lotDetailsData.reduce((sum, dispatch) => sum + (dispatch.loosePcs || 0), 0);
      
      const firstItem = lotDetailsData[0];
      const brandName = firstItem?.brand || 'N/A';
      const itemName = firstItem?.description || 'N/A';
      
      let yPos = 18;
      
      doc.setLineWidth(0.8);
      doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
      doc.setLineWidth(0.3);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
      
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("ESTIMATE MH", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;
      
      doc.setFontSize(12);
      doc.text("STOCK ITEM REGISTER", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;
      
      doc.setFontSize(10);
      const combinedInfo = `${lotNumber}  |  ${itemName}  |  ${brandName}`;
      doc.text(combinedInfo, pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
      
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      doc.setLineWidth(0.3);
      doc.line(leftMargin, yPos + 1, pageWidth - rightMargin, yPos + 1);
      yPos += 8;
      
      doc.setLineWidth(0.3);
      doc.rect(leftMargin, yPos, contentWidth, 25);
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, yPos, contentWidth, 6, 'F');
      
      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.text("STOCK SUMMARY", leftMargin + 5, yPos + 4.5);
      
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      
      const stockSummaryY = yPos + 10;
      const colWidth = contentWidth / 3;
      
      doc.text("Lot Number:", leftMargin + 5, stockSummaryY);
      doc.setFont("times", "bold");
      doc.text(lotNumber, leftMargin + 35, stockSummaryY);
      
      doc.setFont("times", "normal");
      doc.text("Total Pieces in Lot:", leftMargin + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      doc.text(totalPiecesInLot.toLocaleString(), leftMargin + 35, stockSummaryY + 6);
      
      doc.setFont("times", "normal");
      doc.text("Total Dispatched:", leftMargin + colWidth + 5, stockSummaryY);
      doc.setFont("times", "bold");
      doc.text(totalDispatched.toLocaleString(), leftMargin + colWidth + 40, stockSummaryY);
      
      doc.setFont("times", "normal");
      doc.text("Already Dispatched:", leftMargin + colWidth + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      doc.text(alreadyDispatched.toLocaleString(), leftMargin + colWidth + 40, stockSummaryY + 6);
      
      doc.setFont("times", "normal");
      doc.text("Remaining Balance:", leftMargin + (colWidth * 2) + 5, stockSummaryY);
      doc.setFont("times", "bold");
      const remainingColor = remainingPieces <= 0 ? [200, 50, 50] : [0, 100, 0];
      doc.setTextColor(remainingColor[0], remainingColor[1], remainingColor[2]);
      doc.text(remainingPieces.toLocaleString(), leftMargin + (colWidth * 2) + 40, stockSummaryY);
      doc.setTextColor(0, 0, 0);
      
      doc.setFont("times", "normal");
      doc.text("Status:", leftMargin + (colWidth * 2) + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      let statusText = "";
      let statusColor = [0, 0, 0];
      if (remainingPieces <= 0) {
        statusText = "COMPLETED";
        statusColor = [200, 50, 50];
      } else if (totalDispatched > 0) {
        statusText = "PARTIAL";
        statusColor = [255, 140, 0];
      } else {
        statusText = "PENDING";
        statusColor = [0, 100, 0];
      }
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(statusText, leftMargin + (colWidth * 2) + 32, stockSummaryY + 6);
      doc.setTextColor(0, 0, 0);
      
      yPos += 32;
      
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      const minDate = lotDetailsData[0]?.dispatchDate || '';
      const maxDate = lotDetailsData[lotDetailsData.length - 1]?.dispatchDate || '';
      if (minDate && maxDate) {
        doc.text(`Period: ${minDate} to ${maxDate}`, leftMargin, yPos);
      }
      yPos += 8;
      
      const tableColumns = [
        { header: "Date", width: 22, align: "center" },
        { header: "Particulars", width: 50, align: "left" },
        { header: "Vch Type", width: 18, align: "center" },
        { header: "Vch No.", width: 20, align: "center" },
        { header: "Sets", width: 15, align: "right" },
        { header: "Pc/Set", width: 15, align: "right" },
        { header: "Loose Pcs", width: 18, align: "right" },
        { header: "Total Qty", width: 20, align: "right" }
      ];
      
      const totalTableWidth = tableColumns.reduce((sum, col) => sum + col.width, 0);
      const startX = leftMargin + ((contentWidth - totalTableWidth) / 2);
      
      doc.setFillColor(200, 200, 200);
      doc.rect(startX, yPos, totalTableWidth, 8, 'F');
      doc.rect(startX, yPos, totalTableWidth, 8);
      
      let headerX = startX;
      tableColumns.forEach(col => {
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        let textX;
        if (col.align === "center") {
          textX = headerX + (col.width / 2);
          doc.text(col.header, textX, yPos + 5.5, { align: "center" });
        } else if (col.align === "right") {
          textX = headerX + col.width - 2;
          doc.text(col.header, textX, yPos + 5.5, { align: "right" });
        } else {
          textX = headerX + 2;
          doc.text(col.header, textX, yPos + 5.5, { align: "left" });
        }
        
        headerX += col.width;
        
        if (headerX < startX + totalTableWidth) {
          doc.setLineWidth(0.2);
          doc.line(headerX, yPos, headerX, yPos + 8);
        }
      });
      
      yPos += 8;
      
      let rowCount = 0;
      const rowHeight = 7;
      let runningTotalSets = 0;
      let runningTotalQty = 0;
      let runningTotalLoosePcs = 0;
      
      const calculateSetsValue = (sets) => {
        if (!sets) return 0;
        if (typeof sets === 'number') return sets;
        if (typeof sets === 'string') {
          if (sets.includes('+')) {
            const parts = sets.split('+').map(part => parseInt(part, 10) || 0);
            return parts.reduce((a, b) => a + b, 0);
          }
          return parseInt(sets, 10) || 0;
        }
        return 0;
      };
      
      for (const dispatch of lotDetailsData) {
        const setsValue = calculateSetsValue(dispatch.sets);
        const loosePcsValue = dispatch.loosePcs || 0;
        const totalQtyValue = dispatch.quantity || 0;
        
        if (yPos > pageHeight - 55) {
          doc.setLineWidth(0.3);
          doc.rect(startX, yPos, totalTableWidth, rowHeight);
          
          doc.setFont("times", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(0, 0, 0);
          
          let totalX = startX;
          const totalValues = [
            "",
            "TOTAL",
            "",
            "",
            runningTotalSets.toString(),
            "",
            runningTotalLoosePcs.toString(),
            runningTotalQty.toString()
          ];
          
          totalValues.forEach((value, colIndex) => {
            const col = tableColumns[colIndex];
            let textXPos;
            
            if (colIndex === 1) {
              textXPos = totalX + 2;
              doc.text(value, textXPos, yPos + 5, { align: "left" });
            } else if (col.align === "center") {
              textXPos = totalX + (col.width / 2);
              doc.text(value, textXPos, yPos + 5, { align: "center" });
            } else if (col.align === "right") {
              textXPos = totalX + col.width - 2;
              doc.text(value, textXPos, yPos + 5, { align: "right" });
            } else {
              textXPos = totalX + 2;
              doc.text(value, textXPos, yPos + 5, { align: "left" });
            }
            
            totalX += col.width;
          });
          
          doc.addPage();
          yPos = 15;
          
          runningTotalSets = 0;
          runningTotalQty = 0;
          runningTotalLoosePcs = 0;
          
          doc.setLineWidth(0.8);
          doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
          doc.setLineWidth(0.3);
          doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
          
          doc.setFillColor(200, 200, 200);
          doc.rect(startX, yPos, totalTableWidth, 8, 'F');
          doc.rect(startX, yPos, totalTableWidth, 8);
          
          headerX = startX;
          tableColumns.forEach(col => {
            doc.setFont("times", "bold");
            doc.setFontSize(9);
            
            let textX;
            if (col.align === "center") {
              textX = headerX + (col.width / 2);
              doc.text(col.header, textX, yPos + 5.5, { align: "center" });
            } else if (col.align === "right") {
              textX = headerX + col.width - 2;
              doc.text(col.header, textX, yPos + 5.5, { align: "right" });
            } else {
              textX = headerX + 2;
              doc.text(col.header, textX, yPos + 5.5, { align: "left" });
            }
            
            headerX += col.width;
            
            if (headerX < startX + totalTableWidth) {
              doc.line(headerX, yPos, headerX, yPos + 8);
            }
          });
          yPos += 8;
        }
        
        doc.setLineWidth(0.2);
        doc.rect(startX, yPos, totalTableWidth, rowHeight);
        
        const partyInfo = dispatch.partyName || '';
        const packingInfo = dispatch.packingNumber ? ` (${dispatch.packingNumber})` : '';
        const description = dispatch.description || '';
        
        let particulars = partyInfo;
        if (description && description !== partyInfo) {
          particulars = `${partyInfo} - ${description}`;
        }
        if (packingInfo) {
          particulars += packingInfo;
        }
        
        if (particulars.length > 45) {
          particulars = particulars.substring(0, 42) + "...";
        }
        
        let displaySetsValue = dispatch.sets || 0;
        if (typeof displaySetsValue === 'number') {
          displaySetsValue = displaySetsValue.toString();
        }
        
        const rowData = [
          dispatch.dispatchDate || '',
          particulars,
          'Sales',
          dispatch.packingNumber || '',
          displaySetsValue,
          dispatch.setsPerPcs || 0,
          loosePcsValue.toString(),
          totalQtyValue.toString()
        ];
        
        runningTotalSets += setsValue;
        runningTotalLoosePcs += loosePcsValue;
        runningTotalQty += totalQtyValue;
        
        let textX = startX;
        doc.setFont("times", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        
        rowData.forEach((value, colIndex) => {
          const col = tableColumns[colIndex];
          
          let displayValue = value;
          if (colIndex === 1 && displayValue.length > 45) {
            displayValue = displayValue.substring(0, 42) + "...";
          }
          
          let textXPos;
          if (col.align === "center") {
            textXPos = textX + (col.width / 2);
            doc.text(displayValue, textXPos, yPos + 5, { align: "center" });
          } else if (col.align === "right") {
            textXPos = textX + col.width - 2;
            doc.text(displayValue, textXPos, yPos + 5, { align: "right" });
          } else {
            textXPos = textX + 2;
            doc.text(displayValue, textXPos, yPos + 5, { align: "left" });
          }
          
          textX += col.width;
        });
        
        yPos += rowHeight;
        rowCount++;
      }
      
      doc.setLineWidth(0.3);
      doc.rect(startX, yPos, totalTableWidth, rowHeight);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(startX, yPos, totalTableWidth, rowHeight, 'F');
      
      doc.setFont("times", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      
      let totalX = startX;
      const totalValues = [
        "",
        "TOTAL",
        "",
        "",
        runningTotalSets.toString(),
        "",
        runningTotalLoosePcs.toString(),
        runningTotalQty.toString()
      ];
      
      totalValues.forEach((value, colIndex) => {
        const col = tableColumns[colIndex];
        let textXPos;
        
        if (colIndex === 1) {
          textXPos = totalX + 2;
          doc.text(value, textXPos, yPos + 5, { align: "left" });
        } else if (col.align === "center") {
          textXPos = totalX + (col.width / 2);
          doc.text(value, textXPos, yPos + 5, { align: "center" });
        } else if (col.align === "right") {
          textXPos = totalX + col.width - 2;
          doc.text(value, textXPos, yPos + 5, { align: "right" });
        } else {
          textXPos = totalX + 2;
          doc.text(value, textXPos, yPos + 5, { align: "left" });
        }
        
        totalX += col.width;
      });
      
      yPos += rowHeight;
      
      yPos += 1;
      doc.setLineWidth(0.5);
      doc.line(startX, yPos, startX + totalTableWidth, yPos);
      doc.setLineWidth(0.3);
      doc.line(startX, yPos + 1, startX + totalTableWidth, yPos + 1);
      yPos += 8;
      
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated by: ${preparedBy} (${userRole}) on ${new Date().toLocaleString()}`, leftMargin, pageHeight - 10);
      doc.setTextColor(0, 0, 0);
      
      const fileName = `StockItemRegister_${lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      showToast(`Stock Item Register PDF generated successfully`, "success");
      
    } catch (error) {
      console.error("PDF Generation Error:", error);
      showToast("Failed to generate PDF", "error");
    } finally {
      setGeneratingPDF(false);
    }
  };
  
  const LotDetailsModal = () => {
    if (!selectedLotForDetails) return null;

    const totalDispatched = lotDetailsData.reduce((sum, dispatch) => sum + dispatch.quantity, 0);
    const totalBills = new Set(lotDetailsData.map(d => d.packingNumber)).size;
    
    return (
      <div className="blue-modal-overlay" onClick={() => setIsLotDetailsModalOpen(false)}>
        <div className="blue-modal blue-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="blue-modal-header">
            <div className="blue-modal-header-left">
              <span className="blue-modal-icon">📊</span>
              <h3>Lot Details: {selectedLotForDetails}</h3>
              <span className="blue-modal-badge">Dispatch History</span>
            </div>
            <div className="blue-modal-header-actions">
              <button 
                onClick={() => generateLotSummaryPDF(selectedLotForDetails, lotDetailsData)}
                className="blue-btn blue-btn-pdf"
                disabled={loadingLotDetails || lotDetailsData.length === 0}
                title="Download PDF Report"
              >
                📄 Download PDF
              </button>
              <button className="blue-modal-close" onClick={() => setIsLotDetailsModalOpen(false)}>✕</button>
            </div>
          </div>
          <div className="blue-modal-body">
            {loadingLotDetails ? (
              <div className="blue-loading-state">
                <div className="blue-spinner-small"></div>
                <p>Loading dispatch history...</p>
              </div>
            ) : lotDetailsData.length === 0 ? (
              <div className="blue-empty-state">
                <div className="blue-empty-icon">📭</div>
                <p>No dispatch records found for this lot</p>
                <span className="blue-empty-hint">This lot has not been dispatched yet</span>
              </div>
            ) : (
              <>
                <div className="blue-lot-details-summary">
                  <div className="blue-summary-card">
                    <div className="blue-summary-label">Total Dispatched</div>
                    <div className="blue-summary-value">{totalDispatched.toLocaleString()}</div>
                  </div>
                  <div className="blue-summary-card">
                    <div className="blue-summary-label">Total Bills</div>
                    <div className="blue-summary-value">{totalBills}</div>
                  </div>
                  <div className="blue-summary-card">
                    <div className="blue-summary-label">Total Transactions</div>
                    <div className="blue-summary-value">{lotDetailsData.length}</div>
                  </div>
                </div>

                <div className="blue-dispatch-table-wrapper">
                  <table className="blue-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Lot Number</th>
                        <th>Packing Number</th>
                        <th>Party Name</th>
                        <th>Item</th>
                        <th>Brand</th>
                        <th>Sets</th>
                        <th>Pc/Set</th>
                        <th>Loose Pcs</th>
                        <th>Quantity</th>
                        <th>Dispatch Date</th>
                        <th>Prepared By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotDetailsData.map((dispatch, idx) => (
                        <tr key={idx}>
                          <td className="blue-sno">{idx + 1}</td>
                          <td className="blue-lot-cell">{selectedLotForDetails}</td>
                          <td className="blue-dispatch-number">{dispatch.packingNumber}</td>
                          <td className="blue-party-name-cell">{dispatch.partyName}</td>
                          <td className="blue-item-cell">{dispatch.description}</td>
                          <td className="blue-brand-cell">{dispatch.brand || '-'}</td>
                          <td className="blue-qty-cell">{dispatch.sets}</td>
                          <td className="blue-qty-cell">{dispatch.setsPerPcs || 0}</td>
                          <td className="blue-qty-cell">{dispatch.loosePcs}</td>
                          <td className="blue-qty-cell blue-total-qty">{dispatch.quantity.toLocaleString()}</td>
                          <td className="blue-date-cell">{dispatch.dispatchDate}</td>
                          <td className="blue-prepared-by-cell">{dispatch.preparedBy || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="9" className="blue-footer-label">TOTAL:</td>
                        <td className="blue-footer-value">{totalDispatched.toLocaleString()}</td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="blue-modal-footer">
            <button onClick={() => setIsLotDetailsModalOpen(false)} className="blue-btn blue-btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const openLotDetails = (lotNumber) => {
    if (!lotNumber) {
      showToast("No lot number selected", "warning");
      return;
    }
    fetchLotDetails(lotNumber);
    setIsLotDetailsModalOpen(true);
  };

  return (
    <div className="blue-container">
      <input ref={barcodeInputRef} type="text" style={{ position: 'fixed', top: '-100px', left: '-100px', opacity: 0, pointerEvents: 'none' }} />

      {(generatingPDF || savingToSheet || processingStage) && (
        <div className="blue-overlay">
          <div className="blue-processing-card">
            {processingStage === 'pdf' && (
              <>
                <div className="blue-processing-icon">📄</div>
                <div className="blue-processing-title">Generating PDF...</div>
                <div className="blue-progress-bar"><div className="blue-progress-fill" style={{ width: '60%' }}></div></div>
              </>
            )}
            {processingStage === 'sheet' && (
              <>
                <div className="blue-processing-icon">💾</div>
                <div className="blue-processing-title">Saving to Sheets...</div>
                <div className="blue-progress-bar"><div className="blue-progress-fill" style={{ width: '85%' }}></div></div>
              </>
            )}
            {processingStage === 'complete' && showSuccessAnimation && (
              <>
                <div className="blue-processing-icon blue-success">✓</div>
                <div className="blue-processing-title">Complete!</div>
              </>
            )}
          </div>
        </div>
      )}

      {isDebugModalOpen && <DebugConsoleModal />}
      {isEditModalOpen && <EditItemModal />}
      {isConfirmModalOpen && <ConfirmationModal />}
      {isLotDetailsModalOpen && <LotDetailsModal />}

      <div className="blue-user-bar" style={{
        backgroundColor: '#f0f4ff',
        padding: '8px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        border: '1px solid #cbd5e1'
      }}>
        <span style={{ fontSize: '16px' }}>👤</span>
        <div>
          <strong>Logged in as:</strong> {preparedBy}
          <span style={{ marginLeft: '8px', color: '#666' }}>({userRole})</span>
        </div>
        {userEmail && (
          <span style={{ marginLeft: 'auto', color: '#666' }}>
            📧 {userEmail}
          </span>
        )}
      </div>

      {selectedPartyState && (
        <div className="blue-party-banner">
          <div className="blue-party-content">
            <div className="blue-party-icon">🏢</div>
            <div className="blue-party-info">
              <div className="blue-party-name">PACKING LIST :- {selectedPartyState.name}</div>
              {selectedPartyState.contact && (
                <div className="blue-party-contact">📞 {selectedPartyState.contact}</div>
              )}
              {selectedPartyState.address && (
                <div className="blue-party-address">📍 {selectedPartyState.address}</div>
              )}
            </div>
            <div className="blue-party-badge-group">
              <div className="blue-scanner-status">
                <span className={`blue-scanner-led ${isScannerActive ? 'active' : 'inactive'}`}></span>
                <span className="blue-scanner-text">{isScannerActive ? 'Scanner Active' : 'Scanner Ready'}</span>
              </div>
              <button 
                onClick={() => setIsDebugModalOpen(true)} 
                className="blue-debug-button"
                title="Open Debug Console"
              >
                🔧 Debug
              </button>
              <div className="blue-party-badge">Active</div>
            </div>
          </div>
        </div>
      )}

      <div className="blue-header">
        <div className="blue-logo">
          <div className="blue-logo-icon">📦</div>
          <div>
            <h1 className="blue-title">Packing List Pro</h1>
            <p className="blue-subtitle">Barcode Scanning & Packing Lists</p>
          </div>
        </div>
        <div className="blue-actions">
          <button onClick={testScanner} className="blue-btn blue-btn-outline">🔍 Test Scanner</button>
          <button onClick={refreshSheetData} className="blue-btn blue-btn-outline" disabled={loading}>🔄 {loading ? "Loading..." : "Refresh"}</button>
          <button onClick={onBack} className="blue-btn blue-btn-secondary">← Dashboard</button>
        </div>
      </div>

      <div className="blue-layout traditional">
        
        <div className="blue-add-item-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">➕</span>
              <h2>Add New Item</h2>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="blue-btn blue-btn-primary">
              + Add Item
            </button>
          </div>
        </div>

        <div className="blue-items-section-traditional">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">📋</span>
              <h2>Packing List Items</h2>
            </div>
            <span className="blue-badge">{billForm.items.length} items</span>
          </div>
          
          {billForm.items.length > 0 ? (
            <div className="blue-table-wrapper">
              <table className="blue-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>LOT NO</th>
                    <th>BRAND</th>
                    <th>DESCRIPTION</th>
                    <th>SETS</th>
                    <th>PCS/SET</th>
                    <th>OP</th>
                    <th>LOOSE</th>
                    <th>TOTAL</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {billForm.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="blue-sno">{index + 1}</td>
                      <td className="blue-lot-cell">
                        {item.lotNumber || '-'}
                        {item.lotNumber && (
                          <button 
                            onClick={() => openLotDetails(item.lotNumber)} 
                            className="blue-lot-details-btn"
                            title="View lot dispatch history"
                          >
                            📊
                          </button>
                        )}
                      </td>
                      <td className="blue-brand-cell">{item.brand || '-'}</td>
                      <td className="blue-item-name">{item.description}</td>
                      <td><input type="number" value={item.sets} onChange={(e) => updateItemDetails(index, "sets", e.target.value)} className="blue-input-sm" /></td>
                      <td><input type="number" value={item.setsPerPcs} onChange={(e) => updateItemDetails(index, "setsPerPcs", e.target.value)} className="blue-input-sm" /></td>
                      <td className="blue-qty-cell">{item.looseOperation === 'subtract' ? '➖' : '➕'}</td>
                      <td><input type="number" value={item.loosePcs || 0} onChange={(e) => updateItemDetails(index, "loosePcs", e.target.value)} className="blue-input-sm" /></td>
                      <td className="blue-qty">{item.quantity}</td>
                      <td className="blue-actions-cell">
                        <button onClick={() => openEditModal(index)} className="blue-edit-btn" title="Edit Item">✏️</button>
                        <button onClick={() => removeItem(index)} className="blue-remove" title="Remove Item">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="8" className="blue-footer-label">TOTAL ITEMS:</td>
                    <td className="blue-footer-value">{billForm.items.length} ITEMS</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="8" className="blue-footer-label">TOTAL QUANTITY:</td>
                    <td className="blue-footer-value">{billForm.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} PCS</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="blue-empty">
              <div className="blue-empty-icon">📦</div>
              <p>No items added yet</p>
              <span>Click "Add Item" to start adding products</span>
            </div>
          )}
        </div>

        <div className="blue-notes-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">📝</span>
              <h2>Additional Notes</h2>
            </div>
          </div>
          <textarea 
            value={billForm.notes} 
            onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
            placeholder="Add any additional notes or instructions..."
            className="blue-textarea"
            rows="3"
          />
        </div>

        <div className="blue-bill-info-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">ℹ️</span>
              <h2>Bill Information</h2>
            </div>
          </div>
          <div className="blue-info-grid">
            <div className="blue-info-field">
              <label>Bill Date</label>
              <input 
                type="date" 
                value={billForm.billDate} 
                onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                className="blue-input"
              />
            </div>
            <div className="blue-info-field">
              <label>Due Date (Optional)</label>
              <input 
                type="date" 
                value={billForm.dueDate} 
                onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
                className="blue-input"
              />
            </div>
            <div className="blue-info-field">
              <label>Order Reference (Optional)</label>
              <input 
                type="text" 
                value={billForm.orderReference || ""} 
                onChange={(e) => setBillForm({ ...billForm, orderReference: e.target.value })}
                className="blue-input"
                placeholder="PO # / Order #"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="blue-generate-section">
        <button 
          onClick={openConfirmationModal} 
          className="blue-btn blue-btn-generate" 
          disabled={generatingPDF || savingToSheet || billForm.items.length === 0 || !selectedPartyState}
        >
          {generatingPDF ? "⏳ Generating PDF..." : savingToSheet ? "💾 Saving..." : "📄 Generate Packing List"}
        </button>
      </div>

   {isModalOpen && (
  <div className="blue-modal-overlay" onClick={() => setIsModalOpen(false)}>
    <div className="blue-modal blue-modal-with-sidebar" onClick={(e) => e.stopPropagation()}>
      <div className="blue-modal-header">
        <div className="blue-modal-header-left">
          <span className="blue-modal-icon">➕</span>
          <h3>Add New Item</h3>
          <span className="blue-modal-badge">Barcode Scanner</span>
        </div>
        <button className="blue-modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
      </div>
      
      <div className="blue-modal-body-with-sidebar">
        {/* LEFT SIDEBAR - Lot Suggestions Panel */}
        <div className="blue-modal-sidebar">
          <div className="blue-sidebar-header">
            <span className="blue-sidebar-icon">🔍</span>
            <h4>Lot Search</h4>
          </div>
          
          <div className="blue-sidebar-search">
            <input 
              type="text" 
              value={lotSearchTerm}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setLotSearchTerm(value);
                setManualLotInput(value);
                searchLotsWithSuggestions(value);
              }}
              onKeyDown={handleLotInputKeyDown}
              placeholder="Enter Lot Number..." 
              className="blue-sidebar-input" 
              autoComplete="off"
            />
            <button 
              type="button" 
              onClick={() => setShowNumericKeyboard(true)} 
              className="blue-sidebar-keyboard-btn"
              title="Open Numeric Keyboard"
            >
              📱
            </button>
          </div>
          
          <div className="blue-sidebar-suggestions">
            {loadingLotSummary ? (
              <div className="blue-sidebar-loading">
                <div className="blue-spinner-small"></div>
                <p>Loading suggestions...</p>
              </div>
            ) : lotSuggestions.length > 0 ? (
              lotSuggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.lotNumber}-${idx}`}
                  className={`blue-sidebar-suggestion-item ${selectedSuggestionIndex === idx ? 'selected' : ''}`}
                  onClick={() => selectLotFromSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                >
                  <div className="blue-suggestion-main">
                    <span className="blue-suggestion-lot">📦 LOT: {suggestion.lotNumber}</span>
                    {suggestion.isOldLot && (
                      <span className="blue-old-lot-tag">OLD STOCK</span>
                    )}
                  </div>
                  <div className="blue-suggestion-details">
                    <span className="blue-suggestion-item">{suggestion.description}</span>
                    {suggestion.brand && (
                      <span className="blue-suggestion-brand">🏷️ {suggestion.brand}</span>
                    )}
                    {suggestion.piecesPerSet > 0 && (
                      <span className="blue-suggestion-pcs">📊 {suggestion.piecesPerSet} Pc/Set</span>
                    )}
                  </div>
                </div>
              ))
            ) : lotSearchTerm ? (
              <div className="blue-sidebar-empty">
                <span className="blue-empty-icon">🔍</span>
                <p>No matching lots found</p>
                <span className="blue-empty-hint">Try a different lot number</span>
              </div>
            ) : (
              <div className="blue-sidebar-empty">
                <span className="blue-empty-icon">📦</span>
                <p>Enter a lot number to search</p>
                <span className="blue-empty-hint">Type lot number to see suggestions</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CONTENT - Product Details */}
        <div className="blue-modal-content">
          <div className="blue-modal-section blue-barcode-section">
            <div className="blue-section-header">
              <div className="blue-section-header-left">
                <span className="blue-section-icon">🔖</span>
                <h4>Scan Barcode</h4>
              </div>
              <span className="blue-scanner-hint">Press Enter after scan</span>
            </div>
            <div className="blue-section-content">
              <form onSubmit={handleManualBarcodeSubmit} className="blue-barcode-form">
                <div className="blue-input-group">
                  <span className="blue-input-icon">📷</span>
                  <input 
                    type="text" 
                    value={barcodeInput} 
                    onChange={(e) => setBarcodeInput(e.target.value)} 
                    placeholder="Scan or manually enter barcode..." 
                    className="blue-input blue-input-large" 
                    ref={modalBarcodeInputRef}
                    autoFocus
                  />
                  <button type="submit" className="blue-btn blue-btn-primary">
                    <span>🔍</span> Search
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="blue-modal-section blue-product-details">
            <div className="blue-section-header">
              <div className="blue-section-header-left">
                <span className="blue-section-icon">🏷️</span>
                <h4>Product Details</h4>
              </div>
              <span className="blue-auto-fill-badge">Auto-fill enabled</span>
            </div>
            <div className="blue-section-content">
              <div className="blue-form-grid two-col">
                <div className="blue-form-field">
                  <label>Barcode ID</label>
                  <input 
                    type="text" 
                    value={currentProduct.barcode} 
                    onChange={(e) => updateCurrentProduct("barcode", e.target.value)} 
                    className="blue-input" 
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="blue-form-field">
                  <label>Lot Number</label>
                  <input 
                    type="text" 
                    value={currentProduct.lotNumber} 
                    onChange={(e) => updateCurrentProduct("lotNumber", e.target.value)} 
                    className="blue-input" 
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="blue-form-field">
                  <label>Brand / Party</label>
                  <input 
                    type="text" 
                    value={currentProduct.brand} 
                    onChange={(e) => updateCurrentProduct("brand", e.target.value)} 
                    className="blue-input" 
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="blue-form-field">
                  <label>Item Name *</label>
                  <input 
                    type="text" 
                    value={currentProduct.item} 
                    onChange={(e) => updateCurrentProduct("item", e.target.value)} 
                    className="blue-input" 
                    placeholder="Required"
                  />
                </div>
                <div className="blue-form-field blue-highlight-field">
                  <label>📦 Number of Sets *</label>
                  <input 
                    type="number" 
                    value={currentProduct.sets} 
                    onChange={(e) => updateCurrentProduct("sets", e.target.value)} 
                    className="blue-input blue-sets-input" 
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="blue-form-field">
                  <label>🔢 Pieces per Set (Pc/Set)</label>
                  <input 
                    type="number" 
                    value={currentProduct.setsPerPcs} 
                    readOnly
                    className="blue-input blue-input-readonly" 
                    placeholder="Auto-filled from database"
                    style={{ backgroundColor: '#f0f4ff' }}
                  />
                  <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                    This value is auto-filled from the database
                  </small>
                </div>
                <div className="blue-form-field">
                  <label>➕➖ Operation</label>
                  <select 
                    value={currentProduct.looseOperation} 
                    onChange={(e) => updateCurrentProduct("looseOperation", e.target.value)} 
                    className="blue-select"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="add">➕ Addition (Add to total)</option>
                    <option value="subtract">➖ Subtraction (Subtract from total)</option>
                  </select>
                </div>
                <div className="blue-form-field">
                  <label>📦 Loose Pieces</label>
                  <input 
                    type="number" 
                    value={currentProduct.loosePcs} 
                    onChange={(e) => updateCurrentProduct("loosePcs", e.target.value)} 
                    className="blue-input" 
                    placeholder="0"
                  />
                  <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                    {currentProduct.looseOperation === 'add' 
                      ? 'These pieces will be ADDED to the total quantity' 
                      : 'These pieces will be SUBTRACTED from the total quantity'}
                  </small>
                </div>
                <div className="blue-form-field blue-total-field">
                  <label>📊 Total Quantity</label>
                  <input 
                    type="number" 
                    value={currentProduct.quantity} 
                    readOnly 
                    className="blue-input blue-total-input" 
                  />
                  <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                    Formula: (Sets × Pc/Set) {currentProduct.looseOperation === 'add' ? '+' : '-'} Loose Pieces
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div className="blue-modal-section blue-lot-summary-panel">
            <div className="blue-section-header">
              <div className="blue-section-header-left">
                <span className="blue-section-icon">📊</span>
                <h4>Lot Dispatch Summary</h4>
              </div>
              <button 
                onClick={() => currentProduct.lotNumber && openLotDetails(currentProduct.lotNumber)}
                className="blue-btn blue-btn-outline blue-btn-small"
                disabled={!currentProduct.lotNumber}
              >
                📋 See Lot Details
              </button>
              {loadingLotSummary && <div className="blue-loading-spinner-small"></div>}
            </div>
            <div className="blue-section-content">
              {currentProduct.lotNumber ? (
                (() => {
                  const lotInfo = lotSummary.find(l => l.lotNumber === currentProduct.lotNumber);
                  
                  if (lotInfo && lotInfo.isOldLot) {
                    return (
                      <div className="blue-lot-summary-detail">
                        <div className="blue-lot-badge">
                          <span className="blue-lot-badge-label">LOT</span>
                          <span className="blue-lot-badge-number">{currentProduct.lotNumber}</span>
                          <span className="blue-old-lot-badge">OLD STOCK</span>
                        </div>
                        <div className="blue-lot-metrics-grid">
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Total Pieces</div>
                            <div className="blue-metric-value">∞</div>
                            <div className="blue-metric-hint">Unlimited</div>
                          </div>
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Dispatched So Far</div>
                            <div className="blue-metric-value blue-dispatched-value">{lotInfo.dispatchedQty.toLocaleString()}</div>
                          </div>
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Available</div>
                            <div className="blue-metric-value blue-unlimited">Unlimited</div>
                          </div>
                        </div>
                        <div className="blue-alert blue-alert-info" style={{ marginTop: '12px' }}>
                          ℹ️ This is an old stock lot. No quantity restrictions apply.
                        </div>
                      </div>
                    );
                  } else if (lotInfo && lotInfo.totalPieces > 0) {
                    return (
                      <div className="blue-lot-summary-detail">
                        <div className="blue-lot-badge">
                          <span className="blue-lot-badge-label">LOT</span>
                          <span className="blue-lot-badge-number">{currentProduct.lotNumber}</span>
                        </div>
                        <div className="blue-lot-metrics-grid">
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Total Pieces</div>
                            <div className="blue-metric-value">{lotInfo.totalPieces.toLocaleString()}</div>
                          </div>
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Dispatched</div>
                            <div className="blue-metric-value blue-dispatched-value">{lotInfo.dispatchedQty.toLocaleString()}</div>
                          </div>
                          <div className="blue-metric-card">
                            <div className="blue-metric-label">Available</div>
                            <div className={`blue-metric-value ${lotInfo.availablePieces <= 0 ? 'blue-out-of-stock' : 'blue-in-stock'}`}>
                              {lotInfo.availablePieces.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className={`blue-lot-status ${lotInfo.status === 'COMPLETED' ? 'blue-status-completed' : lotInfo.status === 'PARTIAL' ? 'blue-status-partial' : 'blue-status-pending'}`}>
                          <span className="blue-status-dot"></span>
                          {lotInfo.status}
                        </div>
                        {lotInfo.availablePieces <= 0 && (
                          <div className="blue-alert blue-alert-error">
                            ⚠️ This lot is fully dispatched! No pieces available.
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="blue-lot-empty">
                        <span className="blue-empty-icon">🔍</span>
                        <p>Loading lot information...</p>
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="blue-lot-empty">
                  <span className="blue-empty-icon">🔍</span>
                  <p>No lot selected</p>
                  <span className="blue-empty-hint">Select a lot from the left panel</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="blue-modal-footer">
        <button onClick={() => setIsModalOpen(false)} className="blue-btn blue-btn-secondary">
          Cancel
        </button>
        <button 
          onClick={addProductToBill} 
          className="blue-btn blue-btn-primary blue-btn-large" 
          disabled={!currentProduct.barcode || !currentProduct.item || !currentProduct.sets || currentProduct.quantity <= 0}
        >
          <span>➕</span> Add to Packing List
        </button>
      </div>
    </div>
  </div>
)}

      {showNumericKeyboard && (
        <NumericKeyboard
          onKeyPress={handleKeyboardKeyPress}
          onSubmit={handleKeyboardSubmit}
          onClose={() => setShowNumericKeyboard(false)}
          value={manualLotInput}
        />
      )}

      {loading && !processingStage && (
        <div className="blue-loading">
          <div className="blue-spinner"></div>
          <p>Loading products...</p>
        </div>
      )}
    </div>
  );
};

export default PartyBill;