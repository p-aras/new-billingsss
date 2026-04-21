import React, { useState, useEffect } from 'react';

function DispatchDetails({ updateDispatchStatus, onBack }) {
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Your Google Sheets configuration
  const SPREADSHEET_ID = '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk';
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SHEET_NAME = 'Bills';

  useEffect(() => {
    fetchDispatchData();
  }, []);

  const fetchDispatchData = async () => {
    try {
      setLoading(true);
      const range = `${SHEET_NAME}!A:G`;
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
      setError('Failed to load dispatch data');
      setRecentDispatches([]);
    } finally {
      setLoading(false);
    }
  };

  const transformSheetData = (sheetValues) => {
    const headers = sheetValues[0];
    const rows = sheetValues.slice(1);
    
    return rows.map((row, index) => {
      let billData = {};
      const billDataColumnIndex = headers.findIndex(h => h === 'Bill Data (JSON)');
      
      if (billDataColumnIndex !== -1 && row[billDataColumnIndex]) {
        try {
          billData = JSON.parse(row[billDataColumnIndex]);
        } catch (e) {
          console.error('Error parsing Bill Data JSON:', e);
        }
      }
      
      const totalQuantity = billData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      
      return {
        id: billData.billNumber || row[headers.findIndex(h => h === 'Bill Number')] || `dispatch-${index}`,
        orderNo: billData.billNumber || row[headers.findIndex(h => h === 'Bill Number')] || '',
        partyName: billData.partyName || row[headers.findIndex(h => h === 'Party Name')] || '',
        billDate: billData.billDate || row[headers.findIndex(h => h === 'Bill Date')] || '',
        dueDate: billData.dueDate || '',
        orderReference: billData.orderReference || '',
        items: billData.items || [],
        itemsCount: billData.items?.length || 0,
        totalQuantity: totalQuantity,
        notes: billData.notes || '',
        status: determineStatus(billData),
        createdDate: billData.createdDate || row[headers.findIndex(h => h === 'Created Date')] || new Date().toISOString(),
        billData: billData
      };
    });
  };

  const determineStatus = (billData) => {
    return billData.status || 'pending';
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

  const toggleBillDetails = (dispatchId) => {
    setExpandedBill(expandedBill === dispatchId ? null : dispatchId);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#10b981';
      case 'active': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return '✓';
      case 'active': return '▶';
      case 'pending': return '○';
      default: return '•';
    }
  };

  const filteredDispatches = recentDispatches.filter(dispatch => {
    const matchesSearch = dispatch.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dispatch.partyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dispatch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: recentDispatches.length,
    pending: recentDispatches.filter(d => d.status === 'pending').length,
    active: recentDispatches.filter(d => d.status === 'active').length,
    completed: recentDispatches.filter(d => d.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="dispatch-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading dispatches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispatch-container">
        <div className="error-screen">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchDispatchData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatch-container">
      {/* Header Section */}
      <div className="dispatch-header">
        <div className="header-left">
          {onBack && (
            <button onClick={onBack} className="btn-back">
              ← Back
            </button>
          )}
          <h1 className="dispatch-title">Dispatch Management</h1>
        </div>
        <div className="header-right">
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-card pending">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
            <div className="stat-card active">
              <span className="stat-label">Active</span>
              <span className="stat-value">{stats.active}</span>
            </div>
            <div className="stat-card completed">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{stats.completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by bill number or party name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-tabs">
          {['all', 'pending', 'active', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dispatches List */}
      <div className="dispatches-list">
        {filteredDispatches.length > 0 ? (
          filteredDispatches.map(dispatch => (
            <div key={dispatch.id} className="dispatch-card">
              <div className="card-header" onClick={() => toggleBillDetails(dispatch.id)}>
                <div className="card-header-left">
                  <div className="bill-number">
                    <span className="bill-label">Bill No.</span>
                    <span className="bill-value">{dispatch.orderNo}</span>
                    {dispatch.orderReference && (
                      <span className="bill-reference">Ref: {dispatch.orderReference}</span>
                    )}
                  </div>
                  <div className="party-info">
                    <span className="party-icon">🏢</span>
                    <span>{dispatch.partyName}</span>
                  </div>
                </div>
                <div className="card-header-right">
                  <div className="status-badge" style={{ backgroundColor: getStatusColor(dispatch.status) }}>
                    <span className="status-icon">{getStatusIcon(dispatch.status)}</span>
                    <span>{dispatch.status}</span>
                  </div>
                  <button className="expand-btn">
                    {expandedBill === dispatch.id ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              <div className="card-body">
                <div className="info-row">
                  <div className="info-item">
                    <span className="info-label">Bill Date</span>
                    <span className="info-value">{dispatch.billDate ? new Date(dispatch.billDate).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Due Date</span>
                    <span className="info-value">{dispatch.dueDate ? new Date(dispatch.dueDate).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Items</span>
                    <span className="info-value">{dispatch.itemsCount} products</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Total Quantity</span>
                    <span className="info-value highlight">{dispatch.totalQuantity} pcs</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Created</span>
                    <span className="info-value">{new Date(dispatch.createdDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
                    className="btn-action btn-start"
                    onClick={() => handleUpdateDispatchStatus(dispatch.id, "active")}
                    disabled={dispatch.status !== "pending"}
                  >
                    <span>▶</span> Start Dispatch
                  </button>
                  <button 
                    className="btn-action btn-complete"
                    onClick={() => handleUpdateDispatchStatus(dispatch.id, "completed")}
                    disabled={dispatch.status !== "active"}
                  >
                    <span>✓</span> Mark Complete
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedBill === dispatch.id && (
                <div className="card-expanded">
                  <div className="expanded-content">
                    <h3 className="expanded-title">Bill Details</h3>
                    
                    <div className="details-grid">
                      <div className="detail-group">
                        <label>Party Name</label>
                        <p>{dispatch.partyName}</p>
                      </div>
                      <div className="detail-group">
                        <label>Bill Date</label>
                        <p>{dispatch.billDate}</p>
                      </div>
                      <div className="detail-group">
                        <label>Due Date</label>
                        <p>{dispatch.dueDate || 'Not specified'}</p>
                      </div>
                      <div className="detail-group">
                        <label>Order Reference</label>
                        <p>{dispatch.orderReference || 'N/A'}</p>
                      </div>
                      {dispatch.notes && (
                        <div className="detail-group full-width">
                          <label>Notes</label>
                          <p>{dispatch.notes}</p>
                        </div>
                      )}
                    </div>

                    <h4 className="items-title">Items List</h4>
                    <div className="items-table-container">
                      <table className="items-table">
                        <thead>
                          <tr>
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
                          {dispatch.items.map((item, idx) => (
                            <tr key={idx}>
                              <td><code>{item.barcode || '-'}</code></td>
                              <td>{item.lotNumber || '-'}</td>
                              <td>{item.brand || '-'}</td>
                              <td>{item.description || '-'}</td>
                              <td>{item.sets || '-'}</td>
                              <td>{item.setsPerPcs || '-'}</td>
                              <td>{item.loosePcs || 0}</td>
                              <td className="quantity-cell">{item.quantity}</td>
                              <td>{item.colors?.join(', ') || '-'}</td>
                              <td>{item.sizes?.join(', ') || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="7" className="total-label">Total Quantity:</td>
                            <td colSpan="3" className="total-value">{dispatch.totalQuantity} pcs</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No dispatches found</h3>
            <p>Create your first packing copy to get started!</p>
          </div>
        )}
      </div>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .dispatch-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
        }

        /* Loading Screen */
        .loading-screen {
          background: white;
          border-radius: 16px;
          padding: 60px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error Screen */
        .error-screen {
          background: white;
          border-radius: 16px;
          padding: 60px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        /* Header */
        .dispatch-header {
          background: white;
          border-radius: 16px;
          padding: 24px 32px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          flex-wrap: wrap;
          gap: 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: #f3f4f6;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #4b5563;
          transition: all 0.2s;
        }

        .btn-back:hover {
          background: #e5e7eb;
          transform: translateX(-2px);
        }

        .dispatch-title {
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Stats Grid */
        .stats-grid {
          display: flex;
          gap: 16px;
        }

        .stat-card {
          background: #f9fafb;
          padding: 12px 20px;
          border-radius: 12px;
          text-align: center;
          min-width: 80px;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
        }

        .stat-card.pending { background: #fef3c7; }
        .stat-card.active { background: #dbeafe; }
        .stat-card.completed { background: #d1fae5; }

        .stat-label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
        }

        /* Filters */
        .filters-section {
          background: white;
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .search-box {
          position: relative;
          margin-bottom: 20px;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 48px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .filter-tabs {
          display: flex;
          gap: 12px;
        }

        .filter-tab {
          padding: 8px 20px;
          border: 2px solid #e5e7eb;
          background: white;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .filter-tab:hover {
          border-color: #667eea;
          background: #f9fafb;
        }

        .filter-tab.active {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        /* Dispatch Cards */
        .dispatches-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .dispatch-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: all 0.3s;
        }

        .dispatch-card:hover {
          box-shadow: 0 8px 16px rgba(0,0,0,0.15);
          transform: translateY(-2px);
        }

        .card-header {
          padding: 20px 24px;
          background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .card-header:hover {
          background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%);
        }

        .card-header-left {
          flex: 1;
        }

        .bill-number {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .bill-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .bill-value {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
        }

        .bill-reference {
          font-size: 12px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .party-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
          font-size: 14px;
        }

        .party-icon {
          font-size: 16px;
        }

        .card-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: white;
          font-size: 13px;
          font-weight: 500;
        }

        .expand-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #9ca3af;
          transition: color 0.2s;
        }

        .expand-btn:hover {
          color: #667eea;
        }

        .card-body {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }

        .info-value.highlight {
          color: #667eea;
          font-size: 18px;
          font-weight: 700;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-action {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-start {
          background: #dbeafe;
          color: #3b82f6;
        }

        .btn-start:hover:not(:disabled) {
          background: #3b82f6;
          color: white;
          transform: translateY(-1px);
        }

        .btn-complete {
          background: #d1fae5;
          color: #10b981;
        }

        .btn-complete:hover:not(:disabled) {
          background: #10b981;
          color: white;
          transform: translateY(-1px);
        }

        .btn-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Expanded Section */
        .card-expanded {
          padding: 24px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        }

        .expanded-content {
          max-width: 100%;
          overflow-x: auto;
        }

        .expanded-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 20px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
          padding: 16px;
          background: white;
          border-radius: 12px;
        }

        .detail-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-group.full-width {
          grid-column: 1 / -1;
        }

        .detail-group label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.5px;
        }

        .detail-group p {
          font-size: 14px;
          color: #374151;
          margin: 0;
        }

        .items-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
        }

        .items-table-container {
          overflow-x: auto;
          border-radius: 12px;
          background: white;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .items-table th {
          background: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }

        .items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
        }

        .items-table tbody tr:hover {
          background: #f9fafb;
        }

        .quantity-cell {
          font-weight: 700;
          color: #667eea;
        }

        .items-table tfoot td {
          background: #f3f4f6;
          padding: 12px;
          font-weight: 600;
        }

        .total-label {
          text-align: right;
          font-weight: 600;
          color: #374151;
        }

        .total-value {
          font-weight: 700;
          color: #667eea;
          font-size: 16px;
        }

        code {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Empty State */
        .empty-state {
          background: white;
          border-radius: 16px;
          padding: 60px;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .empty-state h3 {
          font-size: 20px;
          color: #374151;
          margin-bottom: 8px;
        }

        .empty-state p {
          color: #9ca3af;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-top: 20px;
          transition: transform 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .dispatch-container {
            padding: 16px;
          }
          
          .dispatch-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .stats-grid {
            justify-content: space-around;
          }
          
          .info-row {
            grid-template-columns: 1fr;
          }
          
          .filter-tabs {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

export default DispatchDetails;