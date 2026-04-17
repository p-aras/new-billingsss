import React, { useState, useEffect } from 'react';

function DispatchDetails({ updateDispatchStatus, onBack }) {
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null); // For showing detailed view

  // Your Google Sheets configuration
  const SPREADSHEET_ID = '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk';
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk'; // Replace with your actual API key
  const SHEET_NAME = 'Bills'; // Your sheet name

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
      
      // Calculate total quantity from items
      const totalQuantity = billData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      
      // Get items summary
      const itemsSummary = billData.items?.map(item => 
        `${item.brand || item.description}: ${item.quantity} pcs`
      ).join(', ') || 'No items';
      
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
    // You can add custom logic here based on bill data
    // For example, check if there's a status field in your data
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

  if (loading) {
    return (
      <div className="component-container">
        <h2>Dispatch Management</h2>
        <div className="loading-state">
          <p>Loading dispatches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="component-container">
        <h2>Dispatch Management</h2>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchDispatchData} className="action-small-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="component-container">
      <h2>Dispatch Management</h2>
      <div className="dispatches-full-list">
        {recentDispatches.length > 0 ? (
          <table className="dispatches-table full-width">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Party Name</th>
                <th>Bill Date</th>
                <th>Items Summary</th>
                <th>Total Quantity</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentDispatches.map(dispatch => (
                <React.Fragment key={dispatch.id}>
                  <tr>
                    <td>
                      <strong>{dispatch.orderNo}</strong>
                      {dispatch.orderReference && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Ref: {dispatch.orderReference}
                        </div>
                      )}
                    </td>
                    <td>{dispatch.partyName}</td>
                    <td>{dispatch.billDate ? new Date(dispatch.billDate).toLocaleDateString() : '-'}</td>
                    <td>
                      <div>
                        {dispatch.itemsCount} item(s)
                        <button 
                          onClick={() => toggleBillDetails(dispatch.id)}
                          style={{ marginLeft: '8px', fontSize: '12px' }}
                          className="action-small-btn"
                        >
                          {expandedBill === dispatch.id ? 'Hide' : 'View'} Details
                        </button>
                      </div>
                    </td>
                    <td>{dispatch.totalQuantity} pcs</td>
                    <td>
                      <span className={`status-badge status-${dispatch.status}`}>
                        {dispatch.status}
                      </span>
                    </td>
                    <td>{new Date(dispatch.createdDate).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="action-small-btn"
                        onClick={() => handleUpdateDispatchStatus(dispatch.id, "active")}
                        disabled={dispatch.status !== "pending"}
                      >
                        Start
                      </button>
                      <button 
                        className="action-small-btn complete"
                        onClick={() => handleUpdateDispatchStatus(dispatch.id, "completed")}
                        disabled={dispatch.status !== "active"}
                      >
                        Complete
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Bill Details Row */}
                  {expandedBill === dispatch.id && (
                    <tr className="bill-details-row">
                      <td colSpan="8">
                        <div className="bill-details-container">
                          <h4>Bill Details: {dispatch.orderNo}</h4>
                          
                          <div className="bill-info-grid">
                            <div className="info-group">
                              <label>Party Name:</label>
                              <span>{dispatch.partyName}</span>
                            </div>
                            <div className="info-group">
                              <label>Bill Date:</label>
                              <span>{dispatch.billDate}</span>
                            </div>
                            <div className="info-group">
                              <label>Due Date:</label>
                              <span>{dispatch.dueDate || 'Not specified'}</span>
                            </div>
                            <div className="info-group">
                              <label>Order Reference:</label>
                              <span>{dispatch.orderReference || 'N/A'}</span>
                            </div>
                            <div className="info-group">
                              <label>Notes:</label>
                              <span>{dispatch.notes || 'No notes'}</span>
                            </div>
                          </div>

                          <h5>Items List:</h5>
                          <table className="items-details-table">
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
                                  <td>{item.barcode || '-'}</td>
                                  <td>{item.lotNumber || '-'}</td>
                                  <td>{item.brand || '-'}</td>
                                  <td>{item.description || '-'}</td>
                                  <td>{item.sets || '-'}</td>
                                  <td>{item.setsPerPcs || '-'}</td>
                                  <td>{item.loosePcs || 0}</td>
                                  <td><strong>{item.quantity}</strong></td>
                                  <td>{item.colors?.join(', ') || '-'}</td>
                                  <td>{item.sizes?.join(', ') || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="7" style={{ textAlign: 'right' }}>
                                  <strong>Total Quantity:</strong>
                                </td>
                                <td colSpan="3">
                                  <strong>{dispatch.totalQuantity} pcs</strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No dispatches found. Create your first packing copy to get started!</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .bill-details-container {
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
          margin: 10px 0;
        }
        
        .bill-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 6px;
        }
        
        .info-group {
          display: flex;
          flex-direction: column;
        }
        
        .info-group label {
          font-weight: bold;
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }
        
        .info-group span {
          font-size: 14px;
          color: #333;
        }
        
        .items-details-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 13px;
        }
        
        .items-details-table th,
        .items-details-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .items-details-table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        
        .items-details-table tfoot td {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        
        h4, h5 {
          margin: 0 0 15px 0;
          color: #333;
        }
        
        h5 {
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
}

export default DispatchDetails;