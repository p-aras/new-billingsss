import React, { useState, useEffect } from 'react';
import './DispatchDetails.css';

function DispatchDetails({ updateDispatchStatus, onBack }) {
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(''); // New state for date filter
  
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [lotSearchResults, setLotSearchResults] = useState([]);
  const [showLotDetails, setShowLotDetails] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);

  const SPREADSHEET_ID = '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk';
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SHEET_NAME = 'Bills';

  useEffect(() => {
    fetchDispatchData();
  }, []);

  const fetchDispatchData = async () => {
    try {
      setLoading(true);
      const range = `${SHEET_NAME}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const dispatches = transformSheetData(data.values);
        setRecentDispatches(dispatches);
      } else {
        setRecentDispatches([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load dispatch data: ' + err.message);
      setRecentDispatches([]);
    } finally {
      setLoading(false);
    }
  };

  const transformSheetData = (sheetValues) => {
    const headers = sheetValues[0];
    const rows = sheetValues.slice(1);
    
    const billNumberIndex = headers.findIndex(h => h === 'Bill Number');
    const partyNameIndex = headers.findIndex(h => h === 'Party Name');
    const billDateIndex = headers.findIndex(h => h === 'Bill Date');
    const dueDateIndex = headers.findIndex(h => h === 'Due Date');
    const orderReferenceIndex = headers.findIndex(h => h === 'Order Reference');
    const itemsIndex = headers.findIndex(h => h === 'Items');
    const statusIndex = headers.findIndex(h => h === 'Status');
    const createdDateIndex = headers.findIndex(h => h === 'Created Date');
    const billDataJsonIndex = headers.findIndex(h => h === 'Bill Data (JSON)' || h === 'BillData' || h === 'billData');
    
    return rows.map((row, index) => {
      let billData = {};
      let items = [];
      let parsedItems = [];
      
      if (billDataJsonIndex !== -1 && row[billDataJsonIndex]) {
        try {
          const jsonStr = row[billDataJsonIndex];
          let parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
          while (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          billData = parsed;
          items = billData.items || [];
          parsedItems = parseItems(items);
        } catch (e) {
          console.error('Error parsing Bill Data JSON:', e);
        }
      }
      
      if (parsedItems.length === 0 && itemsIndex !== -1 && row[itemsIndex]) {
        try {
          parsedItems = parseItemsFromString(row[itemsIndex]);
        } catch (e) {
          console.error('Error parsing items from string:', e);
        }
      }
      
      if (parsedItems.length === 0) {
        parsedItems = [{
          barcode: row[billNumberIndex] || 'N/A',
          lotNumber: 'LOT001',
          brand: 'Generic',
          description: 'Product',
          sets: 0,
          setsPerPcs: 1,
          loosePcs: 0,
          quantity: 0,
          colors: [],
          sizes: []
        }];
      }
      
      const totalQuantity = parsedItems.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity) || 0);
        return sum + qty;
      }, 0);
      
      const totalSets = parsedItems.reduce((sum, item) => {
        const sets = typeof item.sets === 'number' ? item.sets : (parseFloat(item.sets) || 0);
        return sum + sets;
      }, 0);
      
      const totalLoosePcs = parsedItems.reduce((sum, item) => {
        const loosePcs = typeof item.loosePcs === 'number' ? item.loosePcs : (parseFloat(item.loosePcs) || 0);
        return sum + loosePcs;
      }, 0);
      
      // Parse bill date properly
      let billDate = billData.billDate || row[billDateIndex] || '';
      let formattedBillDate = billDate;
      
      // Try to parse and format the date for consistent filtering
      if (billDate) {
        try {
          const dateObj = new Date(billDate);
          if (!isNaN(dateObj.getTime())) {
            formattedBillDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
      
      return {
        id: billData.billNumber || row[billNumberIndex] || `dispatch-${index}`,
        orderNo: billData.billNumber || row[billNumberIndex] || '',
        partyName: billData.partyName || row[partyNameIndex] || '',
        billDate: formattedBillDate,
        billDateRaw: billDate,
        dueDate: billData.dueDate || (dueDateIndex !== -1 ? row[dueDateIndex] : ''),
        orderReference: billData.orderReference || (orderReferenceIndex !== -1 ? row[orderReferenceIndex] : ''),
        items: parsedItems,
        itemsCount: parsedItems.length,
        totalQuantity: totalQuantity,
        totalSets: totalSets,
        totalLoosePcs: totalLoosePcs,
        notes: billData.notes || '',
        status: billData.status || (statusIndex !== -1 ? row[statusIndex] : 'pending'),
        createdDate: billData.createdDate || (createdDateIndex !== -1 ? row[createdDateIndex] : new Date().toISOString()),
        billData: billData
      };
    });
  };

  const parseItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      barcode: item.barcode || item.Barcode || 'N/A',
      lotNumber: item.lotNumber || item.LotNumber || item.lot || 'N/A',
      brand: item.brand || item.Brand || 'Generic',
      description: item.description || item.Description || item.productName || 'Product',
      sets: parseFloat(item.sets || item.Sets || 0),
      setsPerPcs: parseFloat(item.setsPerPcs || item.SetsPerPcs || item.setsPerPiece || 1),
      loosePcs: parseFloat(item.loosePcs || item.LoosePcs || 0),
      quantity: parseFloat(item.quantity || item.Quantity || 0),
      colors: Array.isArray(item.colors) ? item.colors : (item.colors ? [item.colors] : []),
      sizes: Array.isArray(item.sizes) ? item.sizes : (item.sizes ? [item.sizes] : [])
    }));
  };

  const parseItemsFromString = (itemsString) => {
    try {
      const parsed = JSON.parse(itemsString);
      if (Array.isArray(parsed)) {
        return parseItems(parsed);
      }
    } catch (e) {
      console.log('Items not in JSON format:', itemsString);
    }
    return [];
  };

  const searchLotNumber = (lotNumber) => {
    if (!lotNumber.trim()) {
      setLotSearchResults([]);
      setShowLotDetails(false);
      return;
    }

    const results = [];
    const lowerLotNumber = lotNumber.toLowerCase();

    recentDispatches.forEach(dispatch => {
      const matchingItems = dispatch.items.filter(item => 
        item.lotNumber?.toLowerCase().includes(lowerLotNumber)
      );

      if (matchingItems.length > 0) {
        const totalSetsForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.sets) || 0), 0);
        const totalLoosePcsForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.loosePcs) || 0), 0);
        const totalQuantityForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        results.push({
          dispatchId: dispatch.id,
          orderNo: dispatch.orderNo,
          partyName: dispatch.partyName,
          status: dispatch.status,
          billDate: dispatch.billDate,
          items: matchingItems,
          totalSets: totalSetsForLot,
          totalLoosePcs: totalLoosePcsForLot,
          totalQuantity: totalQuantityForLot,
          lotNumber: lotNumber
        });
      }
    });

    setLotSearchResults(results);
    setShowLotDetails(results.length > 0);
    
    if (results.length > 0 && results[0].items.length > 0) {
      setSelectedLot(results[0].items[0].lotNumber);
    }
  };

  const handleLotSearch = (e) => {
    const value = e.target.value;
    setLotSearchTerm(value);
    if (value.length >= 2) {
      searchLotNumber(value);
    } else if (value.length === 0) {
      setLotSearchResults([]);
      setShowLotDetails(false);
    }
  };

  const handleUpdateDispatchStatus = async (dispatchId, newStatus) => {
    try {
      setRecentDispatches(prevDispatches =>
        prevDispatches.map(d =>
          d.id === dispatchId ? { ...d, status: newStatus } : d
        )
      );
      
      if (updateDispatchStatus) {
        updateDispatchStatus(dispatchId, newStatus);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      fetchDispatchData();
    }
  };

  const getStatusConfig = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': 
        return { color: '#059669', bg: '#d1fae5', icon: '✓', label: 'Completed' };
      case 'active': 
        return { color: '#2563eb', bg: '#dbeafe', icon: '🚚', label: 'Active' };
      case 'pending': 
        return { color: '#d97706', bg: '#fef3c7', icon: '⏰', label: 'Pending' };
      default: 
        return { color: '#6b7280', bg: '#f3f4f6', icon: '📋', label: status || 'Unknown' };
    }
  };

  // Clear date filter
  const clearDateFilter = () => {
    setSelectedDate('');
  };

  // Filter dispatches based on search, status, and date
  const filteredDispatches = recentDispatches.filter(dispatch => {
    // Search filter
    const matchesSearch = dispatch.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dispatch.partyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || dispatch.status?.toLowerCase() === statusFilter;
    
    // Date filter
    let matchesDate = true;
    if (selectedDate) {
      const dispatchDate = dispatch.billDate;
      if (dispatchDate) {
        // Compare dates in YYYY-MM-DD format
        matchesDate = dispatchDate === selectedDate;
      } else {
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const stats = {
    total: recentDispatches.length,
    pending: recentDispatches.filter(d => d.status?.toLowerCase() === 'pending').length,
    active: recentDispatches.filter(d => d.status?.toLowerCase() === 'active').length,
    completed: recentDispatches.filter(d => d.status?.toLowerCase() === 'completed').length,
    totalItems: recentDispatches.reduce((sum, d) => sum + (parseInt(d.itemsCount) || 0), 0),
    totalQuantity: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalQuantity) || 0), 0),
    totalSets: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalSets) || 0), 0),
    totalLoosePcs: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalLoosePcs) || 0), 0),
  };

  // Get unique dates for the date picker placeholder
  const getDatePlaceholder = () => {
    if (selectedDate) {
      return `Filtering by: ${selectedDate}`;
    }
    return "Select date to filter bills...";
  };

  if (loading) {
    return (
      <div className="dispatch-modern-container">
        <div className="dispatch-modern-loading">
          <div className="dispatch-modern-loading-animation">
            <div className="dispatch-modern-loading-truck">🚚</div>
          </div>
          <p className="dispatch-modern-loading-text">Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispatch-modern-container">
        <div className="dispatch-modern-error">
          <div className="dispatch-modern-error-icon">⚠️</div>
          <h3>Oops! Something went wrong</h3>
          <p>{error}</p>
          <button onClick={fetchDispatchData} className="dispatch-modern-btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatch-modern-container">
      <div className="dispatch-modern-wrapper">
        {/* Header Section */}
        <div className="dispatch-modern-header">
          <div className="dispatch-modern-header-left">
            {onBack && (
              <button onClick={onBack} className="dispatch-modern-back-btn">
                <span className="dispatch-modern-back-icon">←</span>
                <span>Back</span>
              </button>
            )}
            <div className="dispatch-modern-title-section">
              <div className="dispatch-modern-title-icon">📦</div>
              <div>
                <h1 className="dispatch-modern-title">Dispatch Management</h1>
                <p className="dispatch-modern-subtitle">Track and manage all your dispatches in one place</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="dispatch-modern-stats-grid">
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-blue">
              <span>📄</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.total}</span>
              <span className="dispatch-modern-stat-label">Total Bills</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-orange">
              <span>⏰</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.pending}</span>
              <span className="dispatch-modern-stat-label">Pending</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-blue-light">
              <span>🚚</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.active}</span>
              <span className="dispatch-modern-stat-label">Active</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-green">
              <span>✓</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.completed}</span>
              <span className="dispatch-modern-stat-label">Completed</span>
            </div>
          </div>
        </div>

        {/* Enhanced Metrics */}
        <div className="dispatch-modern-metrics">
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">📊</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalItems}</div>
              <div className="dispatch-modern-metric-label">Total Items</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">📦</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalQuantity}</div>
              <div className="dispatch-modern-metric-label">Total Quantity</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">🔢</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalSets}</div>
              <div className="dispatch-modern-metric-label">Total Sets</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">🔧</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalLoosePcs}</div>
              <div className="dispatch-modern-metric-label">Loose Pieces</div>
            </div>
          </div>
        </div>

        {/* Lot Number Tracking */}
        <div className="dispatch-modern-lot-section">
          <div className="dispatch-modern-section-header">
            <div className="dispatch-modern-section-title">
              <span>🏷️</span>
              <h3>Lot Number Tracking</h3>
            </div>
            <p className="dispatch-modern-section-desc">Search and track lots across all dispatches</p>
          </div>
          
          <div className="dispatch-modern-search-wrapper">
            <span className="dispatch-modern-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Enter lot number to track across all dispatches..."
              value={lotSearchTerm}
              onChange={handleLotSearch}
              className="dispatch-modern-lot-input"
            />
            {lotSearchTerm && (
              <button className="dispatch-modern-clear-btn" onClick={() => {
                setLotSearchTerm('');
                setLotSearchResults([]);
                setShowLotDetails(false);
              }}>
                ✕
              </button>
            )}
          </div>

          {showLotDetails && (
            <div className="dispatch-modern-lot-results">
              {lotSearchResults.length > 0 ? (
                <>
                  <div className="dispatch-modern-lot-summary">
                    <div className="dispatch-modern-summary-header">
                      <span className="dispatch-modern-found-count">📋 {lotSearchResults.length} Dispatch(es) Found</span>
                      <span className="dispatch-modern-lot-highlight">Lot: {lotSearchTerm}</span>
                    </div>
                    <div className="dispatch-modern-lot-totals">
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Sets</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalSets, 0)}</strong>
                      </div>
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Loose Pcs</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalLoosePcs, 0)}</strong>
                      </div>
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Quantity</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalQuantity, 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {lotSearchResults.map((result, idx) => (
                    <div key={idx} className="dispatch-modern-lot-card">
                      <div className="dispatch-modern-lot-card-header">
                        <div className="dispatch-modern-lot-card-info">
                          <span className="dispatch-modern-bill-no">🧾 {result.orderNo}</span>
                          <span className="dispatch-modern-party-name">👤 {result.partyName}</span>
                        </div>
                        <span className={`dispatch-modern-status-badge dispatch-modern-status-${result.status}`}>
                          {result.status === 'pending' && '⏰'}
                          {result.status === 'active' && '🚚'}
                          {result.status === 'completed' && '✓'}
                          {result.status}
                        </span>
                      </div>
                      
                      <div className="dispatch-modern-lot-table-wrapper">
                        <table className="dispatch-modern-lot-table">
                          <thead>
                            <tr>
                              <th>Barcode</th>
                              <th>Lot Number</th>
                              <th>Brand</th>
                              <th>Description</th>
                              <th>Sets</th>
                              <th>Loose Pcs</th>
                              <th>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.items.map((item, itemIdx) => (
                              <tr key={itemIdx}>
                                <td><code>{item.barcode}</code></td>
                                <td><strong>{item.lotNumber}</strong></td>
                                <td>{item.brand}</td>
                                <td>{item.description}</td>
                                <td>{parseFloat(item.sets) || 0}</td>
                                <td>{parseFloat(item.loosePcs) || 0}</td>
                                <td className="dispatch-modern-quantity-cell">{parseFloat(item.quantity) || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="4" className="dispatch-modern-total-label">Totals:</td>
                              <td className="dispatch-modern-total-value">{result.totalSets}</td>
                              <td className="dispatch-modern-total-value">{result.totalLoosePcs}</td>
                              <td className="dispatch-modern-total-value">{result.totalQuantity}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="dispatch-modern-no-results">
                  <span>🔍</span>
                  <p>No dispatches found with lot number: <strong>{lotSearchTerm}</strong></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="dispatch-modern-filters">
          <div className="dispatch-modern-search-filter">
            <span className="dispatch-modern-filter-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by bill number or party name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dispatch-modern-filter-input"
            />
          </div>
          
          {/* Date Filter - New Addition */}
          <div className="dispatch-modern-date-filter">
            <span className="dispatch-modern-filter-icon">📅</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="dispatch-modern-date-input"
              placeholder="Filter by date"
            />
            {selectedDate && (
              <button 
                onClick={clearDateFilter}
                className="dispatch-modern-clear-date-btn"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="dispatch-modern-status-filters">
            {['all', 'pending', 'active', 'completed'].map(status => {
              const icon = status === 'all' ? '📊' : 
                          status === 'pending' ? '⏰' : 
                          status === 'active' ? '🚚' : '✓';
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`dispatch-modern-status-btn ${statusFilter === status ? 'dispatch-modern-status-active' : ''}`}
                >
                  <span>{icon}</span>
                  <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  {status !== 'all' && (
                    <span className="dispatch-modern-filter-count">
                      {stats[status === 'pending' ? 'pending' : status === 'active' ? 'active' : 'completed']}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedDate || searchTerm || statusFilter !== 'all') && (
          <div className="dispatch-modern-active-filters">
            <span className="dispatch-modern-active-filters-label">Active Filters:</span>
            {selectedDate && (
              <span className="dispatch-modern-filter-tag">
                📅 Date: {selectedDate}
                <button onClick={clearDateFilter} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            {searchTerm && (
              <span className="dispatch-modern-filter-tag">
                🔍 Search: {searchTerm}
                <button onClick={() => setSearchTerm('')} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="dispatch-modern-filter-tag">
                {statusFilter === 'pending' ? '⏰' : statusFilter === 'active' ? '🚚' : '✓'} Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            <button 
              onClick={() => {
                setSelectedDate('');
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="dispatch-modern-clear-all-filters"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Filter Result Info */}
        <div className="dispatch-modern-filter-info">
          <span>Showing {filteredDispatches.length} of {recentDispatches.length} bills</span>
          {selectedDate && (
            <span className="dispatch-modern-date-badge">
              📅 {selectedDate}
            </span>
          )}
        </div>

        {/* Dispatches Table */}
        <div className="dispatch-modern-table-container">
          <table className="dispatch-modern-table">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Party Name</th>
                <th>Bill Date</th>
                <th>Due Date</th>
                <th>Items</th>
                <th>Total Qty</th>
                <th>Sets</th>
                <th>Loose Pcs</th>
                <th>Status</th>
                <th>Actions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.length > 0 ? (
                filteredDispatches.map(dispatch => {
                  const statusConfig = getStatusConfig(dispatch.status);
                  const isExpanded = expandedBill === dispatch.id;
                  
                  return (
                    <React.Fragment key={dispatch.id}>
                      <tr className={`dispatch-modern-row ${isExpanded ? 'dispatch-modern-row-expanded' : ''}`}>
                        <td>
                          <span className="dispatch-modern-bill-number">{dispatch.orderNo}</span>
                          {dispatch.orderReference && (
                            <span className="dispatch-modern-ref-badge">{dispatch.orderReference}</span>
                          )}
                        </td>
                        <td>
                          <div className="dispatch-modern-party-cell">
                            <span>👤</span>
                            <span>{dispatch.partyName}</span>
                          </div>
                        </td>
                        <td className="dispatch-modern-date-cell">{dispatch.billDate || '-'}</td>
                        <td>{dispatch.dueDate ? new Date(dispatch.dueDate).toLocaleDateString() : '-'}</td>
                        <td className="dispatch-modern-center">{dispatch.itemsCount}</td>
                        <td className="dispatch-modern-center dispatch-modern-highlight">{dispatch.totalQuantity}</td>
                        <td className="dispatch-modern-center">{dispatch.totalSets}</td>
                        <td className="dispatch-modern-center">{dispatch.totalLoosePcs}</td>
                        <td>
                          <span className="dispatch-modern-status-badge" style={{ background: statusConfig.bg, color: statusConfig.color }}>
                            <span>{statusConfig.icon}</span>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td>
                          <div className="dispatch-modern-actions">
                            <button 
                              className="dispatch-modern-action-start"
                              onClick={() => handleUpdateDispatchStatus(dispatch.id, "active")}
                              disabled={dispatch.status !== "pending"}
                              title="Start Dispatch"
                            >
                              ▶
                            </button>
                            <button 
                              className="dispatch-modern-action-complete"
                              onClick={() => handleUpdateDispatchStatus(dispatch.id, "completed")}
                              disabled={dispatch.status !== "active"}
                              title="Mark Complete"
                            >
                              ✓
                            </button>
                          </div>
                        </td>
                        <td>
                          <button 
                            className="dispatch-modern-expand-btn"
                            onClick={() => setExpandedBill(isExpanded ? null : dispatch.id)}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="dispatch-modern-details-row">
                          <td colSpan="11">
                            <div className="dispatch-modern-details-content">
                              <div className="dispatch-modern-details-header">
                                <h4>📋 Bill Details</h4>
                                <button className="dispatch-modern-details-action">
                                  <span>👁️</span>
                                  View Full Details
                                </button>
                              </div>
                              
                              <div className="dispatch-modern-details-grid">
                                <div className="dispatch-modern-detail-item">
                                  <label>Bill Number</label>
                                  <span>{dispatch.orderNo}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Party Name</label>
                                  <span>{dispatch.partyName}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Bill Date</label>
                                  <span>{dispatch.billDate || 'Not specified'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Due Date</label>
                                  <span>{dispatch.dueDate || 'Not specified'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Order Reference</label>
                                  <span>{dispatch.orderReference || 'N/A'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Status</label>
                                  <span className={`dispatch-modern-status-text dispatch-modern-status-${dispatch.status}`}>
                                    {dispatch.status?.toUpperCase()}
                                  </span>
                                </div>
                              </div>

                              <h5 className="dispatch-modern-items-title">📦 Items List ({dispatch.itemsCount} items)</h5>
                              <div className="dispatch-modern-items-table-wrapper">
                                <table className="dispatch-modern-items-table">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Barcode</th>
                                      <th>Lot Number</th>
                                      <th>Brand</th>
                                      <th>Description</th>
                                      <th>Sets</th>
                                      <th>Sets/Pcs</th>
                                      <th>Loose Pcs</th>
                                      <th>Quantity</th>
                                      <th>Colors</th>
                                      <th>Sizes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dispatch.items && dispatch.items.length > 0 ? (
                                      dispatch.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td>{idx + 1}</td>
                                          <td><code>{item.barcode || '-'}</code></td>
                                          <td><strong>{item.lotNumber || '-'}</strong></td>
                                          <td>{item.brand || '-'}</td>
                                          <td className="dispatch-modern-desc-cell">{item.description || '-'}</td>
                                          <td className="dispatch-modern-number-cell">{parseFloat(item.sets) || 0}</td>
                                          <td className="dispatch-modern-number-cell">{parseFloat(item.setsPerPcs) || 1}</td>
                                          <td className="dispatch-modern-number-cell">{parseFloat(item.loosePcs) || 0}</td>
                                          <td className="dispatch-modern-qty-cell"><strong>{parseFloat(item.quantity) || 0}</strong></td>
                                          <td>
                                            {item.colors && item.colors.length > 0 ? (
                                              <div className="dispatch-modern-tags">
                                                {item.colors.map((color, i) => (
                                                  <span key={i} className="dispatch-modern-color-tag">{color}</span>
                                                ))}
                                              </div>
                                            ) : '-'}
                                          </td>
                                          <td>
                                            {item.sizes && item.sizes.length > 0 ? (
                                              <div className="dispatch-modern-tags">
                                                {item.sizes.map((size, i) => (
                                                  <span key={i} className="dispatch-modern-size-tag">{size}</span>
                                                ))}
                                              </div>
                                            ) : '-'}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan="11" className="dispatch-modern-no-items">No items found</td>
                                      </tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Sets:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalSets || 0}</td>
                                    </tr>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Loose Pcs:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalLoosePcs || 0}</td>
                                    </tr>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Quantity:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalQuantity} pcs</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="dispatch-modern-empty">
                    <span>📦</span>
                    <h3>No dispatches found</h3>
                    <p>
                      {selectedDate 
                        ? `No bills found for date: ${selectedDate}` 
                        : searchTerm 
                        ? `No results matching "${searchTerm}"` 
                        : "Create your first packing copy to get started!"}
                    </p>
                    {selectedDate && (
                      <button onClick={clearDateFilter} className="dispatch-modern-btn-primary">
                        Clear Date Filter
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DispatchDetails;