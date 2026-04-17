// GatepassGenerator.js
import React, { useState } from 'react';
import './GatepassGenerator.css';

const GatepassGenerator = ({ parties, gatepasses, onSubmit, onBack }) => {
  const [gatepassData, setGatepassData] = useState({
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    materialDescription: '',
    materialQuantity: '',
    purpose: 'delivery',
    expectedReturnTime: '',
    remarks: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGatepassData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(gatepassData);
  };

  return (
    <div className="gatepass-container">
      <div className="gatepass-header">
        <button className="back-button" onClick={onBack}>← Back to Dashboard</button>
        <h2>Gatepass Generator</h2>
        <p>Create security gate passes for vehicle entry/exit</p>
      </div>

      <form onSubmit={handleSubmit} className="gatepass-form">
        <div className="form-section">
          <h3>Vehicle Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Vehicle Number *</label>
              <input
                type="text"
                name="vehicleNumber"
                value={gatepassData.vehicleNumber}
                onChange={handleChange}
                placeholder="e.g., MH 01 AB 1234"
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
                placeholder="Driver's full name"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Driver Contact Number *</label>
              <input
                type="tel"
                name="driverContact"
                value={gatepassData.driverContact}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                required
              />
            </div>
            <div className="form-group">
              <label>Purpose of Visit *</label>
              <select
                name="purpose"
                value={gatepassData.purpose}
                onChange={handleChange}
                required
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
                <option value="service">Service/Maintenance</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Material Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Material Description</label>
              <textarea
                name="materialDescription"
                value={gatepassData.materialDescription}
                onChange={handleChange}
                placeholder="Describe the goods/materials being transported"
                rows="3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity/Weight</label>
              <input
                type="text"
                name="materialQuantity"
                value={gatepassData.materialQuantity}
                onChange={handleChange}
                placeholder="e.g., 500 kg or 100 units"
              />
            </div>
            <div className="form-group">
              <label>Expected Return Time</label>
              <input
                type="datetime-local"
                name="expectedReturnTime"
                value={gatepassData.expectedReturnTime}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Additional Remarks</label>
              <textarea
                name="remarks"
                value={gatepassData.remarks}
                onChange={handleChange}
                placeholder="Any special instructions or notes"
                rows="2"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onBack}>Cancel</button>
          <button type="submit" className="submit-button">Generate Gatepass →</button>
        </div>
      </form>

      {/* Recent Gatepasses Section */}
      {gatepasses.length > 0 && (
        <div className="recent-gatepasses">
          <h3>Recent Gatepasses</h3>
          <div className="gatepass-list">
            {gatepasses.slice(0, 5).map(gp => (
              <div key={gp.id} className="gatepass-item">
                <div className="gatepass-info">
                  <span className="gatepass-number">{gp.gatepassNumber}</span>
                  <span className="gatepass-vehicle">{gp.vehicleNumber}</span>
                  <span className="gatepass-driver">{gp.driverName}</span>
                </div>
                <span className={`gatepass-status ${gp.status}`}>{gp.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GatepassGenerator;