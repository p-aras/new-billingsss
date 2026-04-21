// DraftPackingList.js
import React, { useState, useEffect, useRef } from "react";
import "./DraftPackingList.css";
import jsPDF from 'jspdf';

// Google Apps Script URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTjq-1ZRF9z5tLgRmsG2KE3yADq1CEHnPlQ6Rf6aYfFWvRbkvbkCnkAE-_WhTfIs2Z/exec";

// Google Sheets configuration
const GOOGLE_SHEETS_API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const SPREADSHEET_ID = "1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk";
const DRAFTS_SHEET_NAME = "DraftBills"; // Read drafts from here
const BILLS_SHEET_NAME = "Bills"; // Save final bills here

// Main product database sheet
const PRODUCT_SHEET_ID = "1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8";
const PRODUCT_SHEET_NAME = "LotBarcodeData";
const OLD_LOT_SHEET_NAME = "OLD LOTS";

function DraftPackingList({ onBack, onConvertToDispatch, parties, currentUser }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draftForm, setDraftForm] = useState({
    orderNo: "",
    partyName: "",
    partyId: "",
    items: [{ 
      name: "", 
      quantity: "", 
      description: "",
      sets: "",           
      setsPerPcs: "",     
      loosePcs: "",       
      brand: "",
      lotNumber: "",
      barcode: ""
    }],
    dispatchDate: "",
    deliveryAddress: "",
    specialInstructions: "",
    priority: "normal",
    notes: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterParty, setFilterParty] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingToSheet, setSavingToSheet] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Product database state
  const [sheetData, setSheetData] = useState([]);
  const [oldLotData, setOldLotData] = useState([]);
  const [loadingProductData, setLoadingProductData] = useState(false);
  
  // Packing materials state
  const [packingMaterials, setPackingMaterials] = useState({
    totalBoxes: 0,
    totalBags: 0,
    totalPolybags: 0
  });
  const [isPackingMaterialsModalOpen, setIsPackingMaterialsModalOpen] = useState(false);
  const [tempDraftForConversion, setTempDraftForConversion] = useState(null);
  
  // Local edited drafts (not saved to Google Sheets)
  const [localEditedDrafts, setLocalEditedDrafts] = useState({});
  
  // Lot search suggestions
  const [lotSearchTerm, setLotSearchTerm] = useState("");
  const [lotSuggestions, setLotSuggestions] = useState([]);
  const [showLotSuggestions, setShowLotSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  
  // Debug messages
  const [scannerDebug, setScannerDebug] = useState([]);
  
  // Get current user info
  const preparedBy = currentUser?.fullName || currentUser?.username || "System";
  const userRole = currentUser?.role === "admin" ? "Admin" : currentUser?.role === "user" ? "Staff" : "User";
  const userEmail = currentUser?.email || "";

  useEffect(() => {
    loadDraftsFromSheet(); // Load drafts from Google Sheets
    fetchProductDatabase();
  }, []);

  const addDebugMessage = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setScannerDebug(prev => [...prev, { timestamp, message, type }].slice(-20));
    console.log(`[Debug ${timestamp}]:`, message);
  };

  // ==================== GOOGLE SHEETS FUNCTIONS ====================
  
  // Load drafts from Google Sheets (READ ONLY)
  const loadDraftsFromSheet = async () => {
    setLoading(true);
    addDebugMessage("Loading drafts from Google Sheets...");
    
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${DRAFTS_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.values && data.values.length > 1) {
        const headers = data.values[0];
        const sheetDrafts = data.values.slice(1).map((row, index) => {
          let jsonData = {};
          const jsonColumnIndex = headers.findIndex(h => h === 'Draft Data (JSON)');
          
          if (jsonColumnIndex !== -1 && row[jsonColumnIndex]) {
            try {
              jsonData = JSON.parse(row[jsonColumnIndex]);
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
          
          const draftIdIndex = headers.findIndex(h => h === 'Draft ID');
          const partyNameIndex = headers.findIndex(h => h === 'Party Name');
          const statusIndex = headers.findIndex(h => h === 'Status');
          const createdDateIndex = headers.findIndex(h => h === 'Created Date');
          const lastModifiedIndex = headers.findIndex(h => h === 'Last Modified');
          const totalQuantityIndex = headers.findIndex(h => h === 'Total Quantity');
          
          return {
            id: row[draftIdIndex] || `DRAFT-${index}`,
            draftNumber: row[draftIdIndex] || `DRAFT-${index}`,
            orderNo: jsonData.orderNo || jsonData.billNumber || row[draftIdIndex] || '',
            partyName: jsonData.partyName || (partyNameIndex !== -1 ? row[partyNameIndex] : ''),
            partyId: jsonData.partyId || '',
            items: jsonData.items || [],
            dispatchDate: jsonData.dispatchDate || jsonData.billDate || '',
            deliveryAddress: jsonData.deliveryAddress || '',
            specialInstructions: jsonData.specialInstructions || '',
            priority: jsonData.priority || 'normal',
            notes: jsonData.notes || '',
            status: statusIndex !== -1 ? row[statusIndex]?.toLowerCase() || 'draft' : 'draft',
            createdDate: jsonData.createdDate || (createdDateIndex !== -1 ? row[createdDateIndex] : new Date().toISOString()),
            lastModified: lastModifiedIndex !== -1 ? row[lastModifiedIndex] : new Date().toISOString(),
            totalItems: jsonData.totalQuantity || (totalQuantityIndex !== -1 ? row[totalQuantityIndex] : 0),
            totalBoxes: jsonData.totalBoxes || 0,
            totalBags: jsonData.totalBags || 0,
            totalPolybags: jsonData.totalPolybags || 0,
            preparedBy: jsonData.preparedBy || '',
            preparedByRole: jsonData.preparedByRole || '',
            preparedByEmail: jsonData.preparedByEmail || ''
          };
        });
        
        setDrafts(sheetDrafts);
        addDebugMessage(`Loaded ${sheetDrafts.length} drafts from Google Sheets`, 'success');
      } else {
        addDebugMessage("No drafts found in Google Sheets", 'warning');
        setDrafts([]);
      }
    } catch (error) {
      console.error("Error fetching drafts:", error);
      addDebugMessage(`Failed to load drafts: ${error.message}`, 'error');
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  // Delete draft from Google Sheets (only when converted to final bill)
  const deleteDraftFromSheet = async (draftId) => {
    try {
      addDebugMessage(`Deleting draft ${draftId} from Google Sheets...`);
      
      const encodedData = encodeURIComponent(JSON.stringify({ draftId: draftId }));
      const urlEncodedData = `data=${encodedData}&type=deleteDraft`;
      
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlEncodedData
      });
      
      const result = await response.json();
      
      if (result.success) {
        addDebugMessage(`✅ Draft deleted successfully`, 'success');
        return true;
      } else {
        throw new Error(result.error || "Unknown error");
      }
      
    } catch (error) {
      console.error("Error deleting draft:", error);
      addDebugMessage(`❌ Failed to delete draft: ${error.message}`, 'error');
      return false;
    }
  };

  const getNextBillNumber = async (prefix = 'PL') => {
    try {
      addDebugMessage(`Fetching last ${prefix} number from Google Sheets...`);
      
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
          
          if (billNumber && typeof billNumber === 'string' && billNumber.startsWith(`${prefix}-`)) {
            const numberPart = billNumber.replace(`${prefix}-`, '');
            if (/^\d{3}$/.test(numberPart)) {
              const num = parseInt(numberPart, 10);
              if (!isNaN(num)) {
                numbers.push(num);
              }
            }
          }
        }
        
        if (numbers.length > 0) {
          lastNumber = Math.max(...numbers);
          addDebugMessage(`Found ${numbers.length} ${prefix} bills. Last number: ${lastNumber}`, 'success');
        }
      }
      
      const nextNumber = lastNumber + 1;
      const formattedNumber = String(nextNumber).padStart(3, '0');
      const billNumber = `${prefix}-${formattedNumber}`;
      
      addDebugMessage(`Generated new ${prefix} number: ${billNumber}`, 'success');
      return billNumber;
      
    } catch (error) {
      console.error("Error getting next bill number:", error);
      addDebugMessage(`Error: ${error.message}`, 'error');
      const fallbackNumber = `${prefix}-001`;
      return fallbackNumber;
    }
  };

  const fetchBillsFromSheet = async () => {
    try {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${BILLS_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.values && result.values.length > 1) {
        const headers = result.values[0];
        const rows = result.values.slice(1);
        
        const bills = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        
        return bills;
      }
      
      return [];
    } catch (error) {
      console.error("Error fetching bills:", error);
      addDebugMessage(`Failed to fetch bills: ${error.message}`, 'error');
      return [];
    }
  };

  const saveFinalBillToSheet = async (billData) => {
    try {
      addDebugMessage("Saving final bill to Google Sheets...");
      
      const dataToSave = {
        ...billData,
        documentType: 'FINAL',
        status: 'FINAL',
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        savedAt: new Date().toISOString()
      };
      
      const encodedData = encodeURIComponent(JSON.stringify(dataToSave));
      const urlEncodedData = `data=${encodedData}&type=final`;
      
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlEncodedData
      });
      
      const result = await response.json();
      
      if (result.success) {
        addDebugMessage(`✅ Final bill ${billData.billNumber} saved successfully`, 'success');
        return true;
      } else {
        throw new Error(result.error || "Unknown error");
      }
      
    } catch (error) {
      console.error("Error saving final bill:", error);
      addDebugMessage(`❌ Failed to save final bill: ${error.message}`, 'error');
      return false;
    }
  };

  // ==================== DRAFT MANAGEMENT (Local only - NO SAVE TO SHEETS) ====================
  
  // Get the current draft (either original or locally edited)
  const getCurrentDraft = (draftId) => {
    if (localEditedDrafts[draftId]) {
      return localEditedDrafts[draftId];
    }
    return drafts.find(d => d.id === draftId);
  };

  // Update draft locally (does NOT save to Google Sheets)
  const updateLocalDraft = (draftId, updatedData) => {
    setLocalEditedDrafts(prev => ({
      ...prev,
      [draftId]: updatedData
    }));
    
    // Also update the drafts array for display
    setDrafts(prev => prev.map(draft => 
      draft.id === draftId ? updatedData : draft
    ));
  };

  // Create new draft locally (does NOT save to Google Sheets)
  const createLocalDraft = (draftData) => {
    const newDraft = {
      ...draftData,
      id: Date.now().toString(),
      draftNumber: `DRAFT-${Date.now()}`,
      status: "draft",
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    
    setDrafts(prev => [newDraft, ...prev]);
    return newDraft;
  };

  // Delete draft locally (and also from Google Sheets if it was originally from there)
  const deleteLocalDraft = async (draftId, isFromSheet = true) => {
    if (isFromSheet) {
      // Delete from Google Sheets
      const deleted = await deleteDraftFromSheet(draftId);
      if (!deleted) {
        alert("Failed to delete draft from Google Sheets");
        return false;
      }
    }
    
    // Remove from local state
    setDrafts(prev => prev.filter(draft => draft.id !== draftId));
    setLocalEditedDrafts(prev => {
      const newState = { ...prev };
      delete newState[draftId];
      return newState;
    });
    
    if (selectedDraft?.id === draftId) {
      setSelectedDraft(null);
    }
    
    return true;
  };

  // ==================== PRODUCT DATABASE FUNCTIONS ====================
  
  const fetchProductDatabase = async () => {
    setLoadingProductData(true);
    addDebugMessage("Fetching product database...");
    
    try {
      const mainData = await fetchMainProductData();
      const oldData = await fetchOldLotData();
      
      setSheetData(mainData);
      setOldLotData(oldData);
      
      addDebugMessage(`Loaded ${mainData.length} products + ${oldData.length} old lots`, 'success');
    } catch (error) {
      console.error("Error fetching product database:", error);
      addDebugMessage(`Failed to load product database: ${error.message}`, 'error');
    } finally {
      setLoadingProductData(false);
    }
  };

  const fetchMainProductData = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PRODUCT_SHEET_ID}/values/${PRODUCT_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.values && data.values.length > 1) {
        const headers = data.values[0];
        const products = data.values.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            let value = row[index] || '';
            if (value && (value.startsWith('[') || value.startsWith('{'))) {
              try { value = JSON.parse(value); } catch(e) {}
            }
            obj[header] = value;
          });
          return obj;
        }).filter(p => p['Lot Number'] && p['Lot Number'] !== '');
        
        return products;
      }
      return [];
    } catch (error) {
      console.error("Error fetching main product data:", error);
      return [];
    }
  };

  const fetchOldLotData = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PRODUCT_SHEET_ID}/values/${OLD_LOT_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.values && data.values.length > 1) {
        const products = parseOldLotData(data.values);
        return products;
      }
      return [];
    } catch (error) {
      console.error("Error fetching old lot data:", error);
      return [];
    }
  };

  const parseOldLotData = (values) => {
    if (!values || values.length < 2) return [];
    
    const parsedProducts = [];
    
    values.slice(1).forEach((row) => {
      let combinedData = row[0] || '';
      if (!combinedData) return;
      
      let lotNumber = '';
      let remainingDescription = combinedData;
      
      const lotMatch = combinedData.match(/^([A-Z0-9\-/]+)\s+(.+)$/);
      if (lotMatch) {
        lotNumber = lotMatch[1].trim();
        remainingDescription = lotMatch[2].trim();
      } else {
        const firstWord = combinedData.split(/\s+/)[0];
        if (firstWord && /[A-Z0-9\-/]/.test(firstWord)) {
          lotNumber = firstWord;
          remainingDescription = combinedData.substring(firstWord.length).trim();
        } else {
          return;
        }
      }
      
      if (!lotNumber) return;
      
      let itemName = '';
      let brand = '';
      let piecesPerSet = 0;
      
      if (remainingDescription) {
        const pcsMatch = remainingDescription.match(/(\d+)\s*[Ss]$/);
        if (pcsMatch) {
          piecesPerSet = parseInt(pcsMatch[1], 10);
          remainingDescription = remainingDescription.replace(/\s*\d+\s*[Ss]$/, '').trim();
        }
        
        const brandIndicators = [
          'ADIDAS', 'NIKE', 'PUMA', 'REEBOK', 'UNDERARMOUR', 'GUCCI', 'LOUISVUITTON',
          'BALENCIAGA', 'ESSENTIALS', 'AMIRI', 'OFFWHITE', 'DIESEL', 'H&M', 'ZARA',
          'GIRLISH', 'R.L.POLO', 'LACOSTE', 'BROOKSBROTHERS', 'POLO', 'TOMMY', 'CALVINKLEIN','DIOR','HERMES','ZARA','VERSACE','THE NORTHFACE','HACKET','L.V'
        ];
        
        const words = remainingDescription.split(/\s+/);
        let brandIndex = -1;
        
        for (let i = 0; i < words.length; i++) {
          const cleanWord = words[i].toUpperCase().replace(/[.,!?;:()]/g, '');
          if (brandIndicators.includes(cleanWord)) {
            brandIndex = i;
            brand = words[i];
            break;
          }
        }
        
        if (brandIndex !== -1) {
          words.splice(brandIndex, 1);
          itemName = words.join(' ').trim();
        } else {
          itemName = remainingDescription;
        }
      }
      
      if (!itemName) itemName = `Lot ${lotNumber}`;
      if (!brand) brand = 'OLD STOCK';
      if (piecesPerSet === 0) piecesPerSet = 5;
      
      parsedProducts.push({
        'Lot Number': lotNumber,
        'Barcode ID': `LOT-${lotNumber}`,
        'Brand': brand,
        'Item Name': itemName,
        'Garment Type': itemName,
        'Pieces Per Set': piecesPerSet,
        'Party Name': brand,
        'Source': 'OLD LOT'
      });
    });
    
    return parsedProducts;
  };

  const searchProductByLotNumber = (lotNumber) => {
    addDebugMessage(`Searching for lot number: "${lotNumber}"`);
    
    const allProducts = [...sheetData, ...oldLotData];
    
    if (allProducts.length === 0) {
      addDebugMessage("Product database empty!", 'error');
      return null;
    }
    
    const product = allProducts.find(item => {
      const itemLot = item['Lot Number']?.toString();
      return itemLot === lotNumber.toString();
    });
    
    if (product) {
      addDebugMessage(`Found: ${product['Garment Type'] || product['Item Name']}`, 'success');
    } else {
      addDebugMessage(`No product found for lot number: "${lotNumber}"`, 'error');
    }
    
    return product;
  };

  const searchLotsWithSuggestions = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      return;
    }
    
    const allProducts = [...sheetData, ...oldLotData];
    
    if (allProducts.length === 0) {
      addDebugMessage("No product data available for search", 'warning');
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      return;
    }
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    const matches = allProducts.filter(product => {
      const lotNumber = product['Lot Number']?.toString().toLowerCase() || "";
      return lotNumber.includes(searchLower);
    });
    
    addDebugMessage(`Search for "${searchTerm}" found ${matches.length} matches`, 'info');
    
    const suggestions = matches.slice(0, 20).map((product, idx) => {
      const lotNumber = product['Lot Number']?.toString() || "";
      const description = product['Garment Type'] || product['Item Name'] || "";
      const brand = product['Brand'] || product['Party Name'] || "";
      const piecesPerSet = product['Pieces Per Set'] || 0;
      
      return {
        id: `${lotNumber}_${idx}_${Date.now()}`,
        lotNumber: lotNumber,
        description: description,
        displayDescription: piecesPerSet > 0 ? `${description} ${piecesPerSet}S` : description,
        brand: brand,
        piecesPerSet: piecesPerSet,
        source: product['Source'] || 'Main',
        isOldLot: product['Source'] === 'OLD LOT',
        rawData: product
      };
    });
    
    setLotSuggestions(suggestions);
    setShowLotSuggestions(suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const selectLotFromSuggestion = (suggestion, itemIndex) => {
    addDebugMessage(`Selected: ${suggestion.lotNumber} - ${suggestion.description}`, 'success');
    
    const updatedItems = [...draftForm.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      lotNumber: suggestion.lotNumber,
      brand: suggestion.brand,
      name: suggestion.description,
      description: suggestion.description,
      setsPerPcs: suggestion.piecesPerSet,
      barcode: suggestion.lotNumber
    };
    
    const totalPieces = calculateTotalPieces(updatedItems[itemIndex]);
    updatedItems[itemIndex].quantity = totalPieces.toString();
    
    setDraftForm({ ...draftForm, items: updatedItems });
    setLotSearchTerm(suggestion.lotNumber);
    setShowLotSuggestions(false);
  };

  const handleLotInputChange = (index, value) => {
    setLotSearchTerm(value);
    setActiveItemIndex(index);
    
    const updatedItems = [...draftForm.items];
    updatedItems[index].lotNumber = value;
    setDraftForm({ ...draftForm, items: updatedItems });
    
    searchLotsWithSuggestions(value);
  };

  const handleLotInputKeyDown = (e, index) => {
    if (!showLotSuggestions || lotSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleManualLotSearch(index);
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
        selectLotFromSuggestion(lotSuggestions[selectedSuggestionIndex], index);
      } else {
        handleManualLotSearch(index);
      }
    } else if (e.key === 'Escape') {
      setShowLotSuggestions(false);
    }
  };

  const handleManualLotSearch = (index) => {
    const lotNumber = draftForm.items[index].lotNumber;
    if (!lotNumber || !lotNumber.trim()) {
      addDebugMessage("Please enter a lot number", 'warning');
      return;
    }
    
    const foundProduct = searchProductByLotNumber(lotNumber.trim());
    
    if (foundProduct) {
      const piecesPerSet = foundProduct['Pieces Per Set'] || 0;
      const brand = foundProduct['Brand'] || foundProduct['Party Name'] || "";
      const itemName = foundProduct['Garment Type'] || foundProduct['Item Name'] || "";
      
      const updatedItems = [...draftForm.items];
      updatedItems[index] = {
        ...updatedItems[index],
        brand: brand,
        name: itemName,
        description: itemName,
        setsPerPcs: piecesPerSet,
        barcode: foundProduct['Barcode ID'] || `LOT-${lotNumber}`
      };
      
      const totalPieces = calculateTotalPieces(updatedItems[index]);
      updatedItems[index].quantity = totalPieces.toString();
      
      setDraftForm({ ...draftForm, items: updatedItems });
      addDebugMessage(`Auto-filled: ${itemName} (${piecesPerSet} Pc/Set)`, 'success');
    } else {
      addDebugMessage(`Lot number "${lotNumber}" not found in database`, 'error');
    }
    
    setShowLotSuggestions(false);
  };

  const calculateTotalPieces = (item) => {
    const sets = parseInt(item.sets) || 0;
    const setsPerPcs = parseInt(item.setsPerPcs) || 0;
    const loosePcs = parseInt(item.loosePcs) || 0;
    return (sets * setsPerPcs) + loosePcs;
  };

  const handleAddItem = () => {
    setDraftForm({
      ...draftForm,
      items: [...draftForm.items, { 
        name: "", 
        quantity: "", 
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: ""
      }]
    });
    setLotSearchTerm("");
    setShowLotSuggestions(false);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = draftForm.items.filter((_, i) => i !== index);
    setDraftForm({ ...draftForm, items: updatedItems });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...draftForm.items];
    updatedItems[index][field] = value;
    
    if (field === 'sets' || field === 'setsPerPcs' || field === 'loosePcs') {
      const totalPieces = calculateTotalPieces(updatedItems[index]);
      updatedItems[index].quantity = totalPieces.toString();
    }
    
    setDraftForm({ ...draftForm, items: updatedItems });
  };

  const handlePartySelect = (party) => {
    setDraftForm({
      ...draftForm,
      partyName: party.name,
      partyId: party.id,
      deliveryAddress: party.address || "",
      notes: `Contact: ${party.contact}\nEmail: ${party.email}\nGST: ${party.gst}`
    });
  };

  // Save draft - ONLY to local state, NOT to Google Sheets
  const handleSaveDraft = () => {
    if (!draftForm.orderNo || !draftForm.partyName) {
      alert("Please fill in Order Number and Party Name");
      return;
    }

    const totalQuantity = draftForm.items.reduce((sum, item) => {
      return sum + (parseInt(item.quantity) || 0);
    }, 0);

    const newDraft = {
      orderNo: draftForm.orderNo,
      partyName: draftForm.partyName,
      partyId: draftForm.partyId,
      items: draftForm.items,
      dispatchDate: draftForm.dispatchDate,
      deliveryAddress: draftForm.deliveryAddress,
      specialInstructions: draftForm.specialInstructions,
      priority: draftForm.priority,
      notes: draftForm.notes,
      totalItems: totalQuantity,
      preparedBy: preparedBy,
      preparedByRole: userRole,
      preparedByEmail: userEmail,
      lastModified: new Date().toISOString()
    };

    // Create locally only - NOT saved to Google Sheets
    const createdDraft = createLocalDraft(newDraft);
    
    setDraftForm({
      orderNo: "",
      partyName: "",
      partyId: "",
      items: [{ 
        name: "", 
        quantity: "", 
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: ""
      }],
      dispatchDate: "",
      deliveryAddress: "",
      specialInstructions: "",
      priority: "normal",
      notes: ""
    });
    
    setIsCreating(false);
    alert("Draft created locally! (Not saved to Google Sheets - only final bills are saved)");
  };

  // Update draft - ONLY to local state, NOT to Google Sheets
  const handleUpdateDraft = () => {
    if (!selectedDraft) return;

    const totalQuantity = draftForm.items.reduce((sum, item) => {
      return sum + (parseInt(item.quantity) || 0);
    }, 0);

    const updatedDraft = {
      ...selectedDraft,
      ...draftForm,
      lastModified: new Date().toISOString(),
      totalItems: totalQuantity,
      preparedBy: preparedBy,
      preparedByRole: userRole,
      preparedByEmail: userEmail
    };

    // Update locally only - NOT saved to Google Sheets
    updateLocalDraft(selectedDraft.id, updatedDraft);
    
    setSelectedDraft(null);
    setIsCreating(false);
    alert("Draft updated locally! (Changes are not saved to Google Sheets - only final bills are saved)");
  };

  const handleEditDraft = (draft) => {
    const currentDraft = getCurrentDraft(draft.id);
    
    const editFormData = {
      orderNo: currentDraft.orderNo || "",
      partyName: currentDraft.partyName || "",
      partyId: currentDraft.partyId || "",
      items: currentDraft.items && currentDraft.items.length > 0 ? currentDraft.items.map(item => ({
        name: item.name || "",
        quantity: item.quantity || "",
        description: item.description || "",
        sets: item.sets || "",
        setsPerPcs: item.setsPerPcs || "",
        loosePcs: item.loosePcs || "",
        brand: item.brand || "",
        lotNumber: item.lotNumber || "",
        barcode: item.barcode || ""
      })) : [{ 
        name: "", 
        quantity: "", 
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: ""
      }],
      dispatchDate: currentDraft.dispatchDate || "",
      deliveryAddress: currentDraft.deliveryAddress || "",
      specialInstructions: currentDraft.specialInstructions || "",
      priority: currentDraft.priority || "normal",
      notes: currentDraft.notes || ""
    };
    
    setSelectedDraft(currentDraft);
    setDraftForm(editFormData);
    setIsCreating(true);
  };

  const handleDeleteDraft = async (draftId) => {
    if (window.confirm("Are you sure you want to delete this draft?")) {
      // Check if this draft exists in Google Sheets
      const originalDraft = drafts.find(d => d.id === draftId);
      const isFromSheet = originalDraft && !localEditedDrafts[draftId];
      
      const deleted = await deleteLocalDraft(draftId, isFromSheet);
      
      if (deleted) {
        alert("Draft deleted successfully!");
      } else {
        alert("Failed to delete draft.");
      }
    }
  };

  // ==================== PDF GENERATION FUNCTION ====================
  
const generatePackingListPDF = async (packingData) => {
  if (!packingData || !packingData.items || packingData.items.length === 0) {
    console.error("Invalid packing data");
    return false;
  }

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

      // Add Bill To information centered (without prefix)
      const partyName = packingData.partyName || 'N/A';
      const maxWidth = contentWidth;
      const billToTextWidth = doc.getTextWidth(partyName);
      
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      if (billToTextWidth > maxWidth) {
        let remainingName = partyName;
        let lines = [];
        
        while (remainingName.length > 0) {
          let line = "";
          for (let i = 0; i < remainingName.length; i++) {
            const testLine = line + remainingName[i];
            if (doc.getTextWidth(testLine) <= maxWidth) {
              line = testLine;
            } else {
              break;
            }
          }
          lines.push(line);
          remainingName = remainingName.substring(line.length);
        }
        
        for (let i = 0; i < lines.length; i++) {
          doc.text(lines[i], pageWidth / 2, yPos, { align: "center" });
          yPos += 6;
        }
        yPos += 2;
      } else {
        doc.text(partyName, pageWidth / 2, yPos, { align: "center" });
        yPos += 8;
      }
      
      // Draw the main box - equally divided (50% each side)
      const boxHeight = 38;
      doc.rect(leftMargin, yPos, contentWidth, boxHeight);
      
      // Split exactly in the middle
      const midPoint = leftMargin + (contentWidth / 2);
      doc.line(midPoint, yPos, midPoint, yPos + boxHeight);

      // LEFT SIDE CONTENT
      const leftLabelX = leftMargin + 5;
      const leftValueX = leftMargin + 38;
      const leftMaxWidth = midPoint - leftValueX - 3;
      
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      
      doc.text("Date", leftLabelX, yPos + 6);
      doc.text(":", leftLabelX + 18, yPos + 6);
      doc.setFont("times", "normal");
      doc.text(`${packingData.dispatchDate || packingData.billDate || new Date().toLocaleDateString()}`, leftValueX, yPos + 6);
      
      doc.setFont("times", "bold");
      doc.text("Order Ref", leftLabelX, yPos + 12);
      doc.text(":", leftLabelX + 18, yPos + 12);
      doc.setFont("times", "normal");
      let orderRef = `${packingData.orderNo || packingData.orderReference || 'N/A'}`;
      if (doc.getTextWidth(orderRef) > leftMaxWidth) {
        orderRef = orderRef.substring(0, 20) + "...";
      }
      doc.text(orderRef, leftValueX, yPos + 12);
      
      doc.setFont("times", "bold");
      doc.text("Doc No", leftLabelX, yPos + 18);
      doc.text(":", leftLabelX + 18, yPos + 18);
      doc.setFont("times", "normal");
      doc.text(`${packingData.billNumber || packingData.packingNumber || packingData.draftNumber || 'N/A'}`, leftValueX, yPos + 18);
      
      doc.setFont("times", "bold");
      doc.text("Generated By", leftLabelX, yPos + 24);
      doc.text(":", leftLabelX + 18, yPos + 24);
      doc.setFont("times", "normal");
      const preparedByText = `${packingData.preparedBy || preparedBy}`;
      const preparedByRole = `${packingData.preparedByRole || userRole}`;
      const fullPreparedText = `${preparedByText} (${preparedByRole})`;
      
      if (doc.getTextWidth(fullPreparedText) > leftMaxWidth) {
        doc.text(preparedByText, leftValueX, yPos + 24);
        doc.text(`(${preparedByRole})`, leftValueX, yPos + 30);
      } else {
        doc.text(fullPreparedText, leftValueX, yPos + 24);
      }
      
      doc.setFont("times", "bold");
      doc.text("Packing Materials", leftLabelX, yPos + 32);
      doc.text(":", leftLabelX + 18, yPos + 32);
      doc.setFont("times", "normal");
      
      const packingMaterials = packingData.packingMaterials || { totalBoxes: 0, totalBags: 0, totalPolybags: 0 };
      const materialParts = [];
      
      if (packingMaterials.totalBoxes > 0) {
        materialParts.push(`${packingMaterials.totalBoxes} Box${packingMaterials.totalBoxes !== 1 ? 'es' : ''}`);
      }
      if (packingMaterials.totalBags > 0) {
        materialParts.push(`${packingMaterials.totalBags} Bag${packingMaterials.totalBags !== 1 ? 's' : ''}`);
      }
      if (packingMaterials.totalPolybags > 0) {
        materialParts.push(`${packingMaterials.totalPolybags} Polybag${packingMaterials.totalPolybags !== 1 ? 's' : ''}`);
      }
      
      const materialsText = materialParts.length > 0 ? materialParts.join(', ') : 'None';
      
      if (doc.getTextWidth(materialsText) > leftMaxWidth) {
        let remainingText = materialsText;
        let currentY = yPos + 32;
        while (remainingText.length > 0) {
          let line = "";
          for (let i = 0; i < remainingText.length; i++) {
            const testLine = line + remainingText[i];
            if (doc.getTextWidth(testLine) <= leftMaxWidth) {
              line = testLine;
            } else {
              break;
            }
          }
          doc.text(line, leftValueX, currentY);
          remainingText = remainingText.substring(line.length);
          currentY += 5;
        }
      } else {
        doc.text(materialsText, leftValueX, yPos + 32);
      }

      // RIGHT SIDE CONTENT
      const rightLabelX = midPoint + 5;
      const rightValueX = midPoint + 35;
      
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      
      doc.text("Total Lots", rightLabelX, yPos + 6);
      doc.text(":", rightLabelX + 18, yPos + 6);
      doc.setFont("times", "normal");
      doc.text(uniqueLots.toString(), rightValueX, yPos + 6);
      
      doc.setFont("times", "bold");
      doc.text("Total Items", rightLabelX, yPos + 12);
      doc.text(":", rightLabelX + 18, yPos + 12);
      doc.setFont("times", "normal");
      doc.text(totalItems.toString(), rightValueX, yPos + 12);
      
      doc.setFont("times", "bold");
      doc.text("Total Qty", rightLabelX, yPos + 18);
      doc.text(":", rightLabelX + 18, yPos + 18);
      doc.setFont("times", "normal");
      doc.text(`${totalQuantity} PCS`, rightValueX, yPos + 18);
      
      doc.setFont("times", "bold");
      doc.text("Total Sets", rightLabelX, yPos + 24);
      doc.text(":", rightLabelX + 18, yPos + 24);
      doc.setFont("times", "normal");
      doc.text(totalSets.toString(), rightValueX, yPos + 24);
      
      doc.setFont("times", "bold");
      doc.text("Total Value", rightLabelX, yPos + 32);
      doc.text(":", rightLabelX + 18, yPos + 32);
      doc.setFont("times", "normal");
      doc.text("To be calculated", rightValueX, yPos + 32);

      return yPos + boxHeight + 5;
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
      doc.text(`${packingData.preparedBy || preparedBy} (${packingData.preparedByRole || userRole})`, currentX + 5, footerY + 8);
      
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

    const fileName = `PackingList_${packingData.billNumber || packingData.packingNumber || packingData.draftNumber || packingData.orderNo}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    return true;

  } catch (error) {
    console.error("PDF Generation Error:", error);
    return false;
  }
};

  // Packing Materials Modal Component
  const PackingMaterialsModal = () => {
    const [localMaterials, setLocalMaterials] = useState({
      totalBoxes: packingMaterials.totalBoxes,
      totalBags: packingMaterials.totalBags,
      totalPolybags: packingMaterials.totalPolybags
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
      if (isSubmitting) return;
      
      setIsSubmitting(true);
      setPackingMaterials(localMaterials);
      setIsPackingMaterialsModalOpen(false);
      await convertToFinalBillWithMaterials(localMaterials);
      setIsSubmitting(false);
    };

    return (
      <div className="modal-overlay" onClick={() => setIsPackingMaterialsModalOpen(false)}>
        <div className="modal-content modal-medium" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-left">
              <span className="modal-icon">📦</span>
              <h3>Packing Materials</h3>
              <span className="modal-badge">Final Bill</span>
            </div>
            <button className="modal-close" onClick={() => setIsPackingMaterialsModalOpen(false)}>✕</button>
          </div>
          
          <div className="modal-body">
            <div className="info-message">
              <span>ℹ️</span>
              <p>Please enter the packing materials details for this dispatch</p>
            </div>

            <div className="form-field">
              <label>📦 Total Boxes</label>
              <input 
                type="number" 
                value={localMaterials.totalBoxes} 
                onChange={(e) => setLocalMaterials({ ...localMaterials, totalBoxes: parseInt(e.target.value) || 0 })} 
                className="form-input" 
                placeholder="Enter number of boxes"
                autoFocus
                min="0"
              />
            </div>
            
            <div className="form-field">
              <label>🛍️ Total Bags</label>
              <input 
                type="number" 
                value={localMaterials.totalBags} 
                onChange={(e) => setLocalMaterials({ ...localMaterials, totalBags: parseInt(e.target.value) || 0 })} 
                className="form-input" 
                placeholder="Enter number of bags"
                min="0"
              />
            </div>
            
            <div className="form-field">
              <label>📎 Total Polythene Bags</label>
              <input 
                type="number" 
                value={localMaterials.totalPolybags} 
                onChange={(e) => setLocalMaterials({ ...localMaterials, totalPolybags: parseInt(e.target.value) || 0 })} 
                className="form-input" 
                placeholder="Enter number of polythene bags"
                min="0"
              />
            </div>

            <div className="summary-box">
              <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Summary</div>
              <div className="summary-row">
                <span>Total Items:</span>
                <strong>{tempDraftForConversion?.items.length || 0}</strong>
              </div>
              <div className="summary-row">
                <span>Total Quantity:</span>
                <strong>{tempDraftForConversion?.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) || 0} PCS</strong>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button onClick={() => setIsPackingMaterialsModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button 
              onClick={handleConfirm} 
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : "✅ Confirm & Save to Sheet"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Convert draft to final bill with PDF download and save to Google Sheets
  const convertToFinalBillWithMaterials = async (materials) => {
    if (!tempDraftForConversion) return;
    
    if (savingToSheet) {
      addDebugMessage("Already processing, please wait...", 'warning');
      return;
    }
    
    try {
      setSavingToSheet(true);
      addDebugMessage("Converting draft to final bill...", 'info');
      
      const billNumber = await getNextBillNumber('PL');
      
      const totalQuantity = tempDraftForConversion.items.reduce((sum, item) => {
        return sum + (parseInt(item.quantity) || 0);
      }, 0);
      
      const finalBillData = {
        billNumber: billNumber,
        packingNumber: billNumber,
        partyName: tempDraftForConversion.partyName,
        orderNo: tempDraftForConversion.orderNo,
        orderReference: tempDraftForConversion.orderNo,
        dispatchDate: tempDraftForConversion.dispatchDate || new Date().toISOString().split('T')[0],
        billDate: tempDraftForConversion.dispatchDate || new Date().toISOString().split('T')[0],
        dueDate: "",
        items: tempDraftForConversion.items.map((item, idx) => ({
          id: Date.now() + idx,
          barcode: item.barcode || item.lotNumber,
          lotNumber: item.lotNumber,
          brand: item.brand,
          name: item.name || item.description,
          description: item.description || item.name,
          sets: item.sets || 0,
          setsPerPcs: item.setsPerPcs || 0,
          loosePcs: item.loosePcs || 0,
          looseOperation: "add",
          quantity: parseInt(item.quantity) || 0,
          colors: [],
          sizes: []
        })),
        notes: tempDraftForConversion.notes,
        deliveryAddress: tempDraftForConversion.deliveryAddress,
        specialInstructions: tempDraftForConversion.specialInstructions,
        priority: tempDraftForConversion.priority,
        packingMaterials: {
          totalBoxes: parseInt(materials.totalBoxes) || 0,
          totalBags: parseInt(materials.totalBags) || 0,
          totalPolybags: parseInt(materials.totalPolybags) || 0
        },
        totalQuantity: totalQuantity,
        totalItems: tempDraftForConversion.items.length,
        createdDate: new Date().toISOString(),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        status: 'FINAL',
        documentType: 'FINAL'
      };
      
      addDebugMessage(`Converting draft to final bill: ${billNumber}`, 'info');
      addDebugMessage(`Packing materials: Boxes=${materials.totalBoxes}, Bags=${materials.totalBags}, Polybags=${materials.totalPolybags}`, 'info');
      
      // Generate and download PDF FIRST
      addDebugMessage("Generating PDF...", 'info');
      setProcessingStage('pdf');
      const pdfGenerated = await generatePackingListPDF(finalBillData);
      
      if (!pdfGenerated) {
        throw new Error("Failed to generate PDF");
      }
      
      addDebugMessage(`PDF generated successfully`, 'success');
      
      // Then save to Google Sheets (PERMANENT STORAGE)
      setProcessingStage('sheet');
      const saved = await saveFinalBillToSheet(finalBillData);
      
      if (saved) {
        addDebugMessage(`Final bill ${billNumber} saved successfully`, 'success');
        
        // Delete the draft from Google Sheets (if it exists there)
        // Check if this draft originally came from Google Sheets
        const originalDraft = drafts.find(d => d.id === tempDraftForConversion.id);
        if (originalDraft) {
          addDebugMessage(`Deleting draft ${tempDraftForConversion.id} from Google Sheets...`, 'info');
          const deleted = await deleteDraftFromSheet(tempDraftForConversion.id);
          
          if (deleted) {
            addDebugMessage(`Draft deleted successfully`, 'success');
          } else {
            addDebugMessage(`Warning: Draft may not have been deleted`, 'warning');
          }
        }
        
        // Remove from local state
        setDrafts(prev => prev.filter(d => d.id !== tempDraftForConversion.id));
        setLocalEditedDrafts(prev => {
          const newState = { ...prev };
          delete newState[tempDraftForConversion.id];
          return newState;
        });
        
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 2000);
        
        // Call the parent callback if provided
        if (onConvertToDispatch) {
          onConvertToDispatch(finalBillData);
        }
        
        // Clear temp data
        setTempDraftForConversion(null);
        setSelectedDraft(null);
        
        // Show success message
        alert(`✅ Successfully converted to final bill!\n\n📄 Bill Number: ${billNumber}\n📦 Boxes: ${materials.totalBoxes}\n🛍️ Bags: ${materials.totalBags}\n📎 Polybags: ${materials.totalPolybags}\n\n📄 PDF downloaded successfully!\n💾 Saved permanently to Google Sheets.`);
        
      } else {
        throw new Error("Failed to save final bill");
      }
      
    } catch (error) {
      console.error("Error converting draft:", error);
      addDebugMessage(`Conversion error: ${error.message}`, 'error');
      alert("❌ Error converting draft. Please try again.\n\n" + error.message);
    } finally {
      setSavingToSheet(false);
      setProcessingStage(null);
    }
  };

  const handleConvertToFinal = (draft) => {
    if (!draft || draft.items.length === 0) {
      alert("No items in this draft to convert");
      return;
    }
    
    // Use the latest version of the draft (with local edits if any)
    const currentDraft = getCurrentDraft(draft.id);
    setTempDraftForConversion(currentDraft);
    setIsPackingMaterialsModalOpen(true);
  };

  // Filter drafts (use latest versions from localEditedDrafts)
  const getDisplayDrafts = () => {
    return drafts.map(draft => {
      if (localEditedDrafts[draft.id]) {
        return localEditedDrafts[draft.id];
      }
      return draft;
    });
  };

  const filteredDrafts = getDisplayDrafts().filter(draft => {
    const matchesSearch = draft.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         draft.partyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || draft.status === filterStatus;
    const matchesParty = filterParty === "all" || draft.partyName === filterParty;
    
    let matchesDate = true;
    if (filterDateFrom && draft.dispatchDate) {
      const draftDate = new Date(draft.dispatchDate);
      const fromDate = new Date(filterDateFrom);
      if (draftDate < fromDate) matchesDate = false;
    }
    if (filterDateTo && draft.dispatchDate) {
      const draftDate = new Date(draft.dispatchDate);
      const toDate = new Date(filterDateTo);
      if (draftDate > toDate) matchesDate = false;
    }
    
    return matchesSearch && matchesStatus && matchesParty && matchesDate;
  });

  const getPriorityColor = (priority) => {
    switch(priority) {
      case "high": return "#f44336";
      case "medium": return "#ff9800";
      case "low": return "#4caf50";
      default: return "#9e9e9e";
    }
  };

  const uniqueParties = [...new Set(getDisplayDrafts().map(draft => draft.partyName).filter(Boolean))];

const renderDraftDetails = (draft) => {
  if (!draft) return (
    <div className="no-draft-selected">
      <div className="no-selection-icon">📄</div>
      <h3>No Draft Selected</h3>
      <p>Select a draft from the left panel to view complete details</p>
    </div>
  );

  // Get the latest version of the draft
  const currentDraft = getCurrentDraft(draft.id);
  
  // RECALCULATE total from items array - IGNORE the stored totalItems
  const correctTotal = currentDraft.items?.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0;
    return sum + qty;
  }, 0) || 0;

  return (
    <div className="complete-draft-details">
      <div className="details-header">
        <h2>📄 Draft Bill Information</h2>
        {localEditedDrafts[draft.id] && (
          <div className="edited-badge">⚠️ Locally Edited (Not saved to Sheet)</div>
        )}
        <div className="details-actions">
          <button onClick={() => handleEditDraft(currentDraft)} className="edit-details-button">
            ✏️ Edit Draft
          </button>
          <button onClick={() => handleConvertToFinal(currentDraft)} className="convert-details-button">
            🚚 Convert to Final Bill
          </button>
          <button onClick={() => handleDeleteDraft(currentDraft.id)} className="delete-details-button">
            🗑️ Delete
          </button>
        </div>
      </div>
      
      <div className="details-body">
        <div className="detail-section bill-header">
          <div className="bill-title">
            <h3>PACKING LIST / BILL DETAILS</h3>
            <p className="bill-number">Draft No: <strong>{currentDraft.draftNumber || currentDraft.orderNo}</strong></p>
          </div>
          <div className="bill-dates">
            <p><strong>Created:</strong> {new Date(currentDraft.createdDate).toLocaleString()}</p>
            <p><strong>Last Modified:</strong> {new Date(currentDraft.lastModified).toLocaleString()}</p>
          </div>
        </div>

        <div className="detail-section party-info-section">
          <div className="section-header-with-icon">
            <span className="section-icon">🏢</span>
            <h4>Party Information</h4>
          </div>
          <div className="party-details-card">
            <div className="party-info-grid">
              <div className="party-info-item">
                <label>Party Name:</label>
                <span className="party-name-value">{currentDraft.partyName}</span>
              </div>
              <div className="party-info-item">
                <label>Order Number:</label>
                <span>{currentDraft.orderNo || 'N/A'}</span>
              </div>
              <div className="party-info-item full-width">
                <label>Delivery Address:</label>
                <div className="address-value">{currentDraft.deliveryAddress || 'N/A'}</div>
              </div>
              {currentDraft.notes && (
                <div className="party-info-item full-width">
                  <label>Contact Details:</label>
                  <div className="notes-value">{currentDraft.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <div className="section-header-with-icon">
            <span className="section-icon">📦</span>
            <h4>Items Details</h4>
          </div>
          <table className="items-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Lot Number</th>
                <th>Item Name</th>
                <th>Description</th>
                <th>Brand</th>
                <th>Sets</th>
                <th>Pcs/Set</th>
                <th>Loose Pcs</th>
                <th>Total Qty</th>
               </tr>
            </thead>
            <tbody>
              {currentDraft.items && currentDraft.items.length > 0 ? (
                currentDraft.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.lotNumber || '-'}</strong></td>
                    <td>{item.name || 'N/A'}</td>
                    <td>{item.description || '-'}</td>
                    <td><strong>{item.brand || '-'}</strong></td>
                    <td>{item.sets || 0}</td>
                    <td>{item.setsPerPcs || 0}</td>
                    <td>{item.loosePcs || 0}</td>
                    <td><strong>{item.quantity || 0}</strong></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{textAlign: 'center'}}>No items found</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan="8" style={{textAlign: 'right', fontWeight: 'bold'}}>Total Quantity:</td>
                <td style={{fontWeight: 'bold', backgroundColor: '#f0f0f0'}}>{correctTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {currentDraft.priority && (
          <div className="detail-section">
            <div className="priority-badge" style={{ backgroundColor: getPriorityColor(currentDraft.priority) }}>
              Priority: {currentDraft.priority.toUpperCase()}
            </div>
          </div>
        )}
        
        <div className="detail-section">
          <div className="prepared-by-info">
            <label>Prepared By:</label>
            <span>{currentDraft.preparedBy || 'System'} ({currentDraft.preparedByRole || 'User'})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

  const renderForm = () => (
    <div className="draft-form-fullscreen">
      <div className="form-header-fullscreen">
        <h3>{selectedDraft ? "✏️ Edit Draft" : "📝 Create New Draft Packing List"}</h3>
        <button 
          onClick={() => {
            setIsCreating(false);
            setSelectedDraft(null);
            setDraftForm({
              orderNo: "",
              partyName: "",
              partyId: "",
              items: [{ 
                name: "", 
                quantity: "", 
                description: "",
                sets: "",
                setsPerPcs: "",
                loosePcs: "",
                brand: "",
                lotNumber: "",
                barcode: ""
              }],
              dispatchDate: "",
              deliveryAddress: "",
              specialInstructions: "",
              priority: "normal",
              notes: ""
            });
            setLotSearchTerm("");
            setShowLotSuggestions(false);
          }} 
          className="cancel-fullscreen-button"
        >
          ✕ Cancel
        </button>
      </div>

      <div className="form-scrollable-content">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-section">
            <h4>📋 Basic Information</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Order Number *</label>
                <input
                  type="text"
                  value={draftForm.orderNo}
                  onChange={(e) => setDraftForm({...draftForm, orderNo: e.target.value})}
                  placeholder="Enter order number"
                  required
                />
              </div>
              <div className="form-group">
                <label>Party Name *</label>
                {selectedDraft ? (
                  <div className="party-readonly">
                    <input
                      type="text"
                      value={draftForm.partyName}
                      readOnly
                      disabled
                      className="readonly-field"
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#666', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      Party cannot be changed in edit mode
                    </small>
                  </div>
                ) : (
                  <select
                    value={draftForm.partyName}
                    onChange={(e) => {
                      const selectedParty = parties.find(p => p.name === e.target.value);
                      if (selectedParty) handlePartySelect(selectedParty);
                    }}
                  >
                    <option value="">Select a party</option>
                    {parties.map(party => (
                      <option key={party.id} value={party.name}>{party.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={draftForm.priority}
                  onChange={(e) => setDraftForm({...draftForm, priority: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>📦 Items (with Lot Numbers, Sets & Loose Pieces)</h4>
            {loadingProductData && (
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f0f4ff', borderRadius: '8px', marginBottom: '15px' }}>
                Loading product database...
              </div>
            )}
            
            {draftForm.items.map((item, index) => (
              <div key={index} className="item-row-enhanced" style={{ position: 'relative' }}>
                {/* Lot Number */}
                <div className="form-group lot-number-group" style={{ position: 'relative' }}>
                  <label>Lot Number *</label>
                  <input
                    type="text"
                    value={item.lotNumber || ''}
                    onChange={(e) => handleLotInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleLotInputKeyDown(e, index)}
                    onFocus={() => {
                      setActiveItemIndex(index);
                      if (item.lotNumber) {
                        searchLotsWithSuggestions(item.lotNumber);
                      }
                    }}
                    placeholder="Enter lot number (auto-fills details)"
                    className={`lot-input-${index}`}
                    autoComplete="off"
                  />
                  {showLotSuggestions && activeItemIndex === index && lotSuggestions.length > 0 && (
                    <div className="lot-suggestions-dropdown">
                      {lotSuggestions.map((suggestion, idx) => (
                        <div
                          key={suggestion.id}
                          className={`suggestion-item ${selectedSuggestionIndex === idx ? 'selected' : ''}`}
                          onClick={() => selectLotFromSuggestion(suggestion, index)}
                          onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                        >
                          <div style={{ fontWeight: 'bold' }}>📦 LOT: {suggestion.lotNumber}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {suggestion.displayDescription}
                            {suggestion.brand && <span style={{ marginLeft: '8px' }}>🏷️ {suggestion.brand}</span>}
                            {suggestion.isOldLot && <span style={{ marginLeft: '8px', color: '#ff9800' }}>OLD STOCK</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Item Name */}
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    value={item.name || ''}
                    onChange={(e) => handleItemChange(index, "name", e.target.value)}
                    placeholder="Auto-filled from lot"
                    required
                  />
                </div>
                
                {/* Description */}
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                
                {/* Brand */}
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={item.brand || ''}
                    onChange={(e) => handleItemChange(index, "brand", e.target.value)}
                    placeholder="Auto-filled from lot"
                  />
                </div>
                
                {/* Sets */}
                <div className="form-group-small">
                  <label>Sets</label>
                  <input
                    type="number"
                    value={item.sets || ''}
                    onChange={(e) => handleItemChange(index, "sets", e.target.value)}
                    placeholder="Sets"
                    min="0"
                    className={`sets-input-${index}`}
                  />
                </div>
                
                {/* Pcs/Set */}
                <div className="form-group-small">
                  <label>Pcs/Set</label>
                  <input
                    type="number"
                    value={item.setsPerPcs || ''}
                    onChange={(e) => handleItemChange(index, "setsPerPcs", e.target.value)}
                    placeholder="Auto-filled"
                    min="0"
                    readOnly={item.setsPerPcs && !item.setsPerPcs.toString().includes('manual')}
                  />
                </div>
                
                {/* Loose Pcs */}
                <div className="form-group-small">
                  <label>Loose Pcs</label>
                  <input
                    type="number"
                    value={item.loosePcs || ''}
                    onChange={(e) => handleItemChange(index, "loosePcs", e.target.value)}
                    placeholder="Loose"
                    min="0"
                  />
                </div>
                
                {/* Total Qty (Auto) */}
                <div className="form-group">
                  <label>Total Qty (Auto)</label>
                  <input
                    type="text"
                    value={item.quantity || calculateTotalPieces(item)}
                    readOnly
                    className="auto-calc-field"
                  />
                </div>
                
                {draftForm.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="remove-item-button"
                  >
                    ✖
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="add-item-button">
              + Add Item
            </button>
          </div>

          <div className="form-section">
            <h4>🚚 Delivery Details</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Dispatch Date</label>
                <input
                  type="date"
                  value={draftForm.dispatchDate}
                  onChange={(e) => setDraftForm({...draftForm, dispatchDate: e.target.value})}
                />
              </div>
              <div className="form-group full-width">
                <label>Delivery Address</label>
                <textarea
                  value={draftForm.deliveryAddress}
                  onChange={(e) => setDraftForm({...draftForm, deliveryAddress: e.target.value})}
                  placeholder="Enter complete delivery address"
                  rows="3"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>📝 Additional Information</h4>
            <div className="form-group full-width">
              <label>Special Instructions</label>
              <textarea
                value={draftForm.specialInstructions}
                onChange={(e) => setDraftForm({...draftForm, specialInstructions: e.target.value})}
                placeholder="Any special handling instructions"
                rows="2"
              />
            </div>
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                value={draftForm.notes}
                onChange={(e) => setDraftForm({...draftForm, notes: e.target.value})}
                placeholder="Additional notes or remarks"
                rows="2"
              />
            </div>
          </div>
        </form>
      </div>

      <div className="form-footer-actions">
        <button
          type="button"
          onClick={selectedDraft ? handleUpdateDraft : handleSaveDraft}
          className="save-draft-button"
          disabled={savingToSheet}
        >
          💾 {selectedDraft ? "Update Draft (Local Only)" : "Save Draft (Local Only)"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="draft-packing-container">
      {/* Loading/Processing Overlay */}
      {(savingToSheet || processingStage) && (
        <div className="overlay">
          <div className="processing-card">
            {processingStage === 'pdf' && (
              <>
                <div className="processing-icon">📄</div>
                <div className="processing-title">Generating PDF...</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '60%' }}></div></div>
              </>
            )}
            {processingStage === 'sheet' && (
              <>
                <div className="processing-icon">💾</div>
                <div className="processing-title">Saving to Sheets...</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '85%' }}></div></div>
              </>
            )}
            {showSuccessAnimation && (
              <>
                <div className="processing-icon success">✓</div>
                <div className="processing-title">Saved Successfully!</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Packing Materials Modal */}
      {isPackingMaterialsModalOpen && <PackingMaterialsModal />}

      {/* User Info Bar */}
      <div className="user-info-bar">
        <span className="user-icon">👤</span>
        <div>
          <strong>Logged in as:</strong> {preparedBy}
          <span className="user-role">({userRole})</span>
        </div>
        {userEmail && (
          <span className="user-email">
            📧 {userEmail}
          </span>
        )}
      </div>

      <div className="draft-header">
        <button onClick={onBack} className="back-button">
          ← Back to Dashboard
        </button>
        <h2 className="draft-title">📝 Draft Packing Lists</h2>
        {!isCreating && (
          <button onClick={() => setIsCreating(true)} className="create-draft-button">
            + Create New Draft
          </button>
        )}
      </div>

      {loading && (
        <div className="loading-spinner">
          Loading drafts from Google Sheets...
        </div>
      )}

      {!isCreating && !loading && (
        <div className="two-column-layout">
          <div className="left-column">
            <div className="filters-section">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search by Order No or Party Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="filter-row">
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft Only</option>
                </select>
                <select 
                  value={filterParty} 
                  onChange={(e) => setFilterParty(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Parties</option>
                  {uniqueParties.map(party => (
                    <option key={party} value={party}>{party}</option>
                  ))}
                </select>
              </div>
              <div className="filter-row date-filters">
                <input
                  type="date"
                  placeholder="From Date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="date-input"
                />
                <span>to</span>
                <input
                  type="date"
                  placeholder="To Date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="date-input"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button 
                    onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="clear-dates-button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="drafts-list">
              {filteredDrafts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No Drafts Found</h3>
                  <p>Create your first draft packing list to get started</p>
                  <button onClick={() => setIsCreating(true)} className="empty-create-button">
                    Create Draft
                  </button>
                </div>
              ) : (
                filteredDrafts.map(draft => (
                  <div 
                    key={draft.id} 
                    className={`draft-card ${selectedDraft?.id === draft.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDraft(draft)}
                  >
                    <div className="draft-card-header">
                      <div className="draft-info">
                        <h3 className="draft-order-no">{draft.orderNo}</h3>
                        <span className="draft-party">{draft.partyName}</span>
                      </div>
                      <div className="draft-badges">
                        <span className="draft-badge" style={{ backgroundColor: getPriorityColor(draft.priority) }}>
                          {draft.priority?.toUpperCase() || 'NORMAL'}
                        </span>
                        {localEditedDrafts[draft.id] && (
                          <span className="edited-badge-small">📝 Edited</span>
                        )}
                      </div>
                    </div>

                    <div className="draft-card-body">
                      <div className="draft-items-summary">
                        <strong>Items:</strong> {draft.items?.length || 0} item(s)
                        {draft.items?.some(item => item.lotNumber) && (
                          <span className="lot-badge">Has Lot Numbers</span>
                        )}
                        <span className="total-quantity">Total Qty: {draft.totalItems || 0}</span>
                      </div>
                      {draft.dispatchDate && (
                        <div className="draft-dispatch-date">
                          📅 {new Date(draft.dispatchDate).toLocaleDateString()}
                        </div>
                      )}
                      <div className="draft-prepared-by">
                        👤 {draft.preparedBy || 'System'} ({draft.preparedByRole || 'User'})
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="right-column">
            {renderDraftDetails(selectedDraft)}
          </div>
        </div>
      )}

      {isCreating && renderForm()}
      
      <style jsx>{`
        .lot-suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        }
        .suggestion-item:hover {
          background-color: #e3f2fd;
        }
        .suggestion-item.selected {
          background-color: #e3f2fd;
        }
        .lot-number-group {
          position: relative;
        }
        .readonly-field {
          background-color: #f5f5f5;
          color: #666;
          cursor: not-allowed;
          border: 1px solid #ddd;
        }
        .party-readonly {
          width: 100%;
        }
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .processing-card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          text-align: center;
          min-width: 250px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .processing-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        .processing-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #2196f3;
          transition: width 0.3s ease;
        }
        .success {
          color: #4caf50;
        }
        .draft-prepared-by {
          font-size: 11px;
          color: #666;
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid #eee;
        }
        .prepared-by-info {
          padding: 10px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 12px;
        }
        .prepared-by-info label {
          font-weight: bold;
          margin-right: 10px;
        }
        .user-info-bar {
          background-color: #f0f4ff;
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          border: 1px solid #cbd5e1;
        }
        .user-icon {
          font-size: 16px;
        }
        .user-role {
          margin-left: 8px;
          color: #666;
        }
        .user-email {
          margin-left: auto;
          color: #666;
        }
        .edited-badge {
          background-color: #ff9800;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 15px;
        }
        .edited-badge-small {
          background-color: #ff9800;
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 9px;
          margin-left: 8px;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .modal-medium {
          max-width: 500px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }
        .modal-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal-icon {
          font-size: 24px;
        }
        .modal-header-left h3 {
          margin: 0;
          font-size: 18px;
        }
        .modal-badge {
          background: #e3f2fd;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          color: #1976d2;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
        }
        .modal-close:hover {
          color: #333;
        }
        .modal-body {
          padding: 20px;
        }
        .info-message {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
          font-size: 13px;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }
        .form-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }
        .summary-box {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-top: 5px;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .btn-secondary {
          padding: 8px 16px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-primary {
          padding: 8px 20px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-large {
          padding: 10px 24px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default DraftPackingList;