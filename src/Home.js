// Home.js
import React, { useState, useEffect } from "react";
import "./Home.css";
import SplashScreen from "./SplashScreen";
import BarcodeGenerator from "./BarcodeGenerator";
import PartyProfile from "./PartyProfile";
import PackingCopy from "./PackingCopy";
import DispatchDetails from "./DispatchDetails";
import StickerGenerator from "./StickerGenerator";
import BarcodeScanner from "./BarcodeScanner";
import PartyBill from "./PartyBill";
import PartySelection from "./PartySelection";
import GatepassGenerator from "./GatepassGenerator";
import GatepassDetails from "./GatepassDetails";
import Login from "./Login";
import DraftPackingList from "./DraftPackingList";
import ManualStickerCreate from "./ManualStickerCreate";

function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [activeComponent, setActiveComponent] = useState("dashboard");
  const [selectedParty, setSelectedParty] = useState(null);
  const [dispatchStats, setDispatchStats] = useState({
    totalDispatches: 0,
    activeDispatches: 0,
    completedToday: 0,
    pendingDispatches: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    onTimeRate: 0,
    totalParties: 0,
    totalBills: 0,
    totalGatepasses: 0,
    totalManualStickers: 0
  });
  
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [partyData, setPartyData] = useState({
    name: "",
    contact: "",
    address: "",
    gst: "",
    email: ""
  });
  const [packingData, setPackingData] = useState({
    orderNo: "",
    partyName: "",
    items: [],
    quantity: "",
    dispatchDate: "",
    deliveryAddress: ""
  });
  const [parties, setParties] = useState([]);
  const [stickerData, setStickerData] = useState({
    title: "",
    content: "",
    type: "shipping",
    size: "medium",
    quantity: 1
  });
  const [bills, setBills] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [gatepasses, setGatepasses] = useState([]);
  const [manualStickers, setManualStickers] = useState([]);

  useEffect(() => {
    const authenticated = localStorage.getItem("isAuthenticated");
    const userData = localStorage.getItem("userData");
    
    if (authenticated === "true" && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    
    const splashShown = sessionStorage.getItem("splashShown");
    
    if (splashShown) {
      setShowSplash(false);
    }
    
    if (authenticated === "true") {
      loadDashboardData();
      loadParties();
      loadRecentDispatches();
      loadStickers();
      loadBills();
      loadGatepasses();
      loadManualStickers();
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadDashboardData = () => {
    const savedDispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
    const savedParties = JSON.parse(localStorage.getItem("parties") || "[]");
    const savedBills = JSON.parse(localStorage.getItem("bills") || "[]");
    const savedGatepasses = JSON.parse(localStorage.getItem("gatepasses") || "[]");
    const savedManualStickers = JSON.parse(localStorage.getItem("manualStickers") || "[]");
    const today = new Date().toDateString();
    
    const completedToday = savedDispatches.filter(
      d => d.status === "completed" && new Date(d.completedDate).toDateString() === today
    ).length;
    
    const onTimeDeliveries = savedDispatches.filter(d => d.status === "completed" && d.onTime).length;
    const totalCompleted = savedDispatches.filter(d => d.status === "completed").length;
    const onTimeRate = totalCompleted > 0 ? (onTimeDeliveries / totalCompleted * 100).toFixed(1) : 0;
    
    setDispatchStats({
      totalDispatches: savedDispatches.length,
      activeDispatches: savedDispatches.filter(d => d.status === "active").length,
      completedToday: completedToday,
      pendingDispatches: savedDispatches.filter(d => d.status === "pending").length,
      totalDrivers: 15,
      availableDrivers: 8,
      onTimeRate: onTimeRate,
      totalParties: savedParties.length,
      totalBills: savedBills.length,
      totalGatepasses: savedGatepasses.length,
      totalManualStickers: savedManualStickers.length
    });
  };

  const loadParties = () => {
    const savedParties = JSON.parse(localStorage.getItem("parties") || "[]");
    setParties(savedParties);
  };

  const loadRecentDispatches = () => {
    const savedDispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
    setRecentDispatches(savedDispatches.slice(0, 5));
  };

  const loadStickers = () => {
    const savedStickers = JSON.parse(localStorage.getItem("stickers") || "[]");
  };

  const loadBills = () => {
    const savedBills = JSON.parse(localStorage.getItem("bills") || "[]");
    setBills(savedBills);
  };

  const loadGatepasses = () => {
    const savedGatepasses = JSON.parse(localStorage.getItem("gatepasses") || "[]");
    setGatepasses(savedGatepasses);
  };

  const loadManualStickers = () => {
    const savedManualStickers = JSON.parse(localStorage.getItem("manualStickers") || "[]");
    setManualStickers(savedManualStickers);
  };

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    loadDashboardData();
    loadParties();
    loadRecentDispatches();
    loadStickers();
    loadBills();
    loadGatepasses();
    loadManualStickers();
    showToast(`Welcome back, ${userData.username}!`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userData");
    setIsAuthenticated(false);
    setUser(null);
    setActiveComponent("dashboard");
    showToast("Logged out successfully", 'info');
  };

  const handleSplashFinish = () => {
    sessionStorage.setItem("splashShown", "true");
    setShowSplash(false);
  };

  const handlePartyProfileSubmit = (e) => {
    e.preventDefault();
    const newParty = { ...partyData, id: Date.now(), createdAt: new Date().toISOString() };
    const updatedParties = [...parties, newParty];
    setParties(updatedParties);
    localStorage.setItem("parties", JSON.stringify(updatedParties));
    
    showToast(`Party profile for ${partyData.name} saved successfully!`, 'success');
    setPartyData({ name: "", contact: "", address: "", gst: "", email: "" });
    loadDashboardData();
  };

  const handleAddParty = (newParty) => {
    const updatedParties = [...parties, newParty];
    setParties(updatedParties);
    localStorage.setItem("parties", JSON.stringify(updatedParties));
    loadDashboardData();
    showToast(`Party "${newParty.name}" added successfully!`, 'success');
  };

  const handlePackingCopySubmit = (e) => {
    e.preventDefault();
    const newDispatch = {
      id: Date.now(),
      ...packingData,
      status: "pending",
      createdDate: new Date().toISOString(),
      barcode: `DISP-${Date.now()}`
    };
    
    const existingDispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
    const updatedDispatches = [newDispatch, ...existingDispatches];
    localStorage.setItem("dispatches", JSON.stringify(updatedDispatches));
    
    showToast(`Packing copy generated for Order #${packingData.orderNo}`, 'success');
    setPackingData({ orderNo: "", partyName: "", items: [], quantity: "", dispatchDate: "", deliveryAddress: "" });
    loadDashboardData();
    loadRecentDispatches();
  };

  const handleStickerSubmit = (e) => {
    e.preventDefault();
    const newSticker = {
      id: Date.now(),
      ...stickerData,
      createdDate: new Date().toISOString(),
      stickerCode: `STK-${Date.now()}`
    };
    
    const existingStickers = JSON.parse(localStorage.getItem("stickers") || "[]");
    const updatedStickers = [newSticker, ...existingStickers];
    localStorage.setItem("stickers", JSON.stringify(updatedStickers));
    
    showToast(`${stickerData.quantity} ${stickerData.title} sticker(s) created successfully!`, 'success');
    setStickerData({ title: "", content: "", type: "shipping", size: "medium", quantity: 1 });
    loadDashboardData();
  };

  const handleManualStickerSubmit = (stickerData) => {
    const newSticker = {
      id: Date.now(),
      ...stickerData,
      stickerNumber: `MANUAL-STK-${Date.now()}`,
      createdDate: new Date().toISOString(),
      createdBy: user?.username || 'user',
      status: 'active'
    };
    
    const existingManualStickers = JSON.parse(localStorage.getItem("manualStickers") || "[]");
    const updatedManualStickers = [newSticker, ...existingManualStickers];
    localStorage.setItem("manualStickers", JSON.stringify(updatedManualStickers));
    setManualStickers(updatedManualStickers);
    
    showToast(`Manual sticker "${stickerData.stickerTitle}" created successfully!`, 'success');
    loadDashboardData();
    setActiveComponent("dashboard");
  };

  const handlePartySelect = (party) => {
    setSelectedParty(party);
    setActiveComponent("party-bill");
    showToast(`Selected party: ${party.name}`, 'info');
  };

  const handleBillSubmit = (billData) => {
    const newBill = {
      id: Date.now(),
      ...billData,
      billNumber: `BILL-${Date.now()}`,
      createdDate: new Date().toISOString(),
      status: "pending"
    };
    
    const existingBills = JSON.parse(localStorage.getItem("bills") || "[]");
    const updatedBills = [newBill, ...existingBills];
    localStorage.setItem("bills", JSON.stringify(updatedBills));
    setBills(updatedBills);
    
    showToast(`Bill #${newBill.billNumber} created successfully for ${billData.partyName}!`, 'success');
    loadDashboardData();
    
    setSelectedParty(null);
    setActiveComponent("dashboard");
  };

  const handleBackFromBill = () => {
    setSelectedParty(null);
    setActiveComponent("party-bill-selection");
  };

  const updateDispatchStatus = (dispatchId, newStatus) => {
    const dispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
    const updatedDispatches = dispatches.map(d => {
      if (d.id === dispatchId) {
        return { 
          ...d, 
          status: newStatus,
          ...(newStatus === "completed" && { completedDate: new Date().toISOString(), onTime: true })
        };
      }
      return d;
    });
    localStorage.setItem("dispatches", JSON.stringify(updatedDispatches));
    loadDashboardData();
    loadRecentDispatches();
    showToast(`Dispatch status updated to ${newStatus}`, 'success');
  };

  const handleGatepassSubmit = (gatepassData) => {
    const newGatepass = {
      id: Date.now(),
      ...gatepassData,
      gatepassNumber: `GP-${Date.now()}`,
      createdDate: new Date().toISOString(),
      status: "active",
      qrCode: `GP-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
    };
    
    const existingGatepasses = JSON.parse(localStorage.getItem("gatepasses") || "[]");
    const updatedGatepasses = [newGatepass, ...existingGatepasses];
    localStorage.setItem("gatepasses", JSON.stringify(updatedGatepasses));
    setGatepasses(updatedGatepasses);
    
    showToast(`Gatepass #${newGatepass.gatepassNumber} created successfully for ${gatepassData.vehicleNumber || 'hand delivery'}!`, 'success');
    loadDashboardData();
    setActiveComponent("dashboard");
  };

  const navigationCards = [
    {
      id: "barcode",
      title: "Generate Barcode",
      icon: "🔖",
      description: "Create unique barcodes for product tracking and inventory management",
      theoreticalInfo: "Barcodes encode product information in a visual pattern readable by scanners. Each barcode is unique and can store up to 20+ characters. Uses GS1-128 standards for supply chain compatibility.",
      details: "✓ GS1-128 Compliant\n✓ Unique identifiers\n✓ Instant scanning",
      stats: "Generate GS1-128 compliant barcodes",
      color: "#4CAF50",
      lightColor: "#E8F5E9"
    },
    {
      id: "barcode-scanner",
      title: "Barcode Scanner",
      icon: "📷",
      description: "Scan barcodes to instantly retrieve product and dispatch information",
      theoreticalInfo: "Uses camera or laser to read barcode patterns. Decodes information in milliseconds using advanced image recognition algorithms and integrates with your inventory database in real-time.",
      details: "✓ Real-time scanning\n✓ Instant validation\n✓ History tracking",
      stats: "Real-time scanning & validation",
      color: "#00BCD4",
      lightColor: "#E0F7FA"
    },
    {
      id: "manual-sticker",
      title: "Manual Sticker Create",
      icon: "🏷️",
      description: "Create custom manual stickers for products, packages, and special labeling requirements",
      theoreticalInfo: "Create and print custom stickers manually with specific text, batch numbers, expiry dates, and other variable information for product labeling. Supports multiple formats and sizes.",
      details: "✓ Custom text & batch numbers\n✓ Multiple sizes & formats\n✓ Print ready output",
      stats: `${dispatchStats.totalManualStickers} stickers created`,
      color: "#FF9800",
      lightColor: "#FFF3E0"
    },
    {
      id: "party",
      title: "Party Profile",
      icon: "👥",
      description: "Maintain comprehensive profiles for customers, suppliers, and partners",
      theoreticalInfo: "Centralized database storing contact info, GST details, transaction history, and preferences for all business parties. Enables seamless communication and transaction tracking.",
      details: "✓ GST & contact info\n✓ Transaction history\n✓ Preference management",
      stats: `${dispatchStats.totalParties} registered parties`,
      color: "#2196F3",
      lightColor: "#E3F2FD"
    },
    {
      id: "party-bill-selection",
      title: "Create Party Bill",
      icon: "💰",
      description: "Generate professional invoices and track payment history",
      theoreticalInfo: "Automated billing system calculates taxes, applies discounts, and maintains financial records for accounting compliance. Supports GST calculations and digital signatures.",
      details: "✓ Automatic tax calculation\n✓ GST compliance\n✓ Digital signatures",
      stats: `${dispatchStats.totalBills} bills generated`,
      color: "#FF5722",
      lightColor: "#FBE9E7"
    },
    {
      id: "dispatch",
      title: "Dispatch Details",
      icon: "🚚",
      description: "Track shipments, manage delivery routes, and monitor fleet performance",
      theoreticalInfo: "Real-time tracking system with route optimization, delivery confirmation, and performance analytics. Uses GPS integration and automated status updates for complete visibility.",
      details: "✓ Real-time tracking\n✓ Route optimization\n✓ Performance analytics",
      stats: `${dispatchStats.activeDispatches} active deliveries`,
      color: "#9C27B0",
      lightColor: "#F3E5F5"
    },
    {
      id: "draft-packing",
      title: "Draft Packing List",
      icon: "📝",
      description: "Create and manage draft packing lists before final dispatch",
      theoreticalInfo: "Create preliminary packing lists, review items, make changes, and convert to final dispatch when ready. Reduces errors by allowing multiple review cycles before finalization.",
      details: "✓ Multiple review cycles\n✓ Easy modifications\n✓ Convert to final",
      stats: "Save drafts for later processing",
      color: "#607D8B",
      lightColor: "#ECEFF1"
    },
    {
      id: "gatepass",
      title: "Gatepass Creation",
      icon: "🚪",
      description: "Generate security gate passes for vehicle entry and exit with automated tracking",
      theoreticalInfo: "Digital gatepass system with QR code authentication, vehicle verification, and real-time security logging for warehouse/facility access control. Enhances security and compliance.",
      details: "✓ QR code authentication\n✓ Vehicle verification\n✓ Security logging",
      stats: `${dispatchStats.totalGatepasses} gatepasses issued`,
      color: "#3F51B5",
      lightColor: "#E8EAF6"
    },
    {
      id: "gatepass-details",
      title: "Gatepass Details",
      icon: "📋",
      description: "View, track, and manage all generated gatepasses with detailed information",
      theoreticalInfo: "Centralized repository of all gatepasses with status tracking, search functionality, and detailed view of each gatepass including associated bills and dispatch information.",
      details: "✓ Centralized repository\n✓ Status tracking\n✓ Search functionality",
      stats: `${gatepasses.filter(gp => gp.status === 'active').length} active gatepasses`,
      color: "#009688",
      lightColor: "#E0F2F1"
    },
  ];

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} duration={3000} />;
  }

  const renderComponent = () => {
    switch(activeComponent) {
      case "barcode":
        return <BarcodeGenerator onBack={() => setActiveComponent("dashboard")} />;
      case "barcode-scanner":
        return <BarcodeScanner onBack={() => setActiveComponent("dashboard")} />;
      case "manual-sticker":
        return (
          <ManualStickerCreate
            parties={parties}
            manualStickers={manualStickers}
            onSubmit={handleManualStickerSubmit}
            onBack={() => setActiveComponent("dashboard")}
            currentUser={user}
          />
        );
      case "party":
        return (
          <PartyProfile 
            parties={parties}
            partyData={partyData}
            setPartyData={setPartyData}
            onSubmit={handlePartyProfileSubmit}
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      case "party-bill-selection":
        return (
          <PartySelection 
            parties={parties}
            onSelectParty={handlePartySelect}
            onBack={() => setActiveComponent("dashboard")}
            onAddParty={handleAddParty}
          />
        );
      case "party-bill":
        return (
          <PartyBill 
            parties={parties}
            bills={bills}
            selectedParty={selectedParty}
            onSubmit={handleBillSubmit}
            onBack={handleBackFromBill}
            currentUser={user}
          />
        );
      case "packing":
        return (
          <PackingCopy 
            packingData={packingData}
            setPackingData={setPackingData}
            onSubmit={handlePackingCopySubmit}
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      case "draft-packing":
        return (
          <DraftPackingList 
            onBack={() => setActiveComponent("dashboard")}
            parties={parties}
            currentUser={user}
          />
        );
      case "dispatch":
        return (
          <DispatchDetails 
            recentDispatches={recentDispatches}
            updateDispatchStatus={updateDispatchStatus}
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      case "sticker":
        return (
          <StickerGenerator
            stickerData={stickerData}
            setStickerData={setStickerData}
            onSubmit={handleStickerSubmit}
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      case "gatepass":
        return (
          <GatepassGenerator
            parties={parties}
            gatepasses={gatepasses}
            onSubmit={handleGatepassSubmit}
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      case "gatepass-details":
        return (
          <GatepassDetails
            onBack={() => setActiveComponent("dashboard")}
          />
        );
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => {
    return (
      <div className="dashboard-white">
        {/* Enhanced Header Section with Stats */}
        <div className="header-white">
          <div className="header-content">
            <div className="header-left">
              <h1 className="title-white">
                <span className="title-gradient">DISPATCH MANAGEMENT SYSTEM</span>
              </h1>
              <p className="subtitle-white">
                Enterprise Logistics Management System
              </p>
            </div>
            <div className="header-right">
              <div className="user-info-card">
                <div className="user-avatar">
                  <span className="user-icon">👤</span>
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.fullName || user?.username}</span>
                  <span className="user-role">{user?.role === "admin" ? "Administrator" : "Team Member"}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="logout-button-enhanced">
                <span className="logout-icon">🚪</span>
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
          
          {/* Enhanced Stats Row */}
          {/* <div className="header-stats-row">
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-info">
                <div className="stat-value">{dispatchStats.totalDispatches}</div>
                <div className="stat-label">Total Dispatches</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚚</div>
              <div className="stat-info">
                <div className="stat-value">{dispatchStats.activeDispatches}</div>
                <div className="stat-label">Active Deliveries</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-value">{dispatchStats.completedToday}</div>
                <div className="stat-label">Completed Today</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <div className="stat-value">{dispatchStats.onTimeRate}%</div>
                <div className="stat-label">On-Time Rate</div>
              </div>
            </div>
          </div> */}
        </div>

        {/* Quick Stats Summary */}
        {/* <div className="quick-stats-summary">
          <div className="summary-item">
            <span className="summary-label">Fleet Status:</span>
            <span className="summary-value">{dispatchStats.availableDrivers}/{dispatchStats.totalDrivers} Drivers Available</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-item">
            <span className="summary-label">Pending Tasks:</span>
            <span className="summary-value">{dispatchStats.pendingDispatches} Dispatches Need Action</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-item">
            <span className="summary-label">Business Partners:</span>
            <span className="summary-value">{dispatchStats.totalParties} Active Parties</span>
          </div>
        </div> */}

        {/* Action Modules Section */}
        <div className="actions-section">
          {/* <div className="section-header-enhanced">
            <div className="section-badge">⚡ Quick Access</div>
            <h2 className="section-title-enhanced">Action Modules</h2>
            <p className="section-subtitle-enhanced">
              Select any module below to start managing your logistics operations
            </p>
          </div> */}
          
          <div className="actions-grid-enhanced">
            {navigationCards.map((card, index) => (
              <div 
                key={card.id}
                className="action-card-enhanced"
                onClick={() => setActiveComponent(card.id)}
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  borderTopColor: card.color 
                }}
              >
                <div className="card-icon-section" style={{ backgroundColor: card.lightColor }}>
                  <span className="card-icon-enhanced" style={{ color: card.color }}>{card.icon}</span>
                </div>
                
                <div className="card-content-section">
                  <h3 className="card-title-enhanced">{card.title}</h3>
                  <p className="card-description-enhanced">{card.description}</p>
                  
                  <div className="card-badge" style={{ backgroundColor: card.lightColor, color: card.color }}>
                    {card.stats}
                  </div>
                </div>
                
                <div className="card-details-section">
                  <div className="theoretical-insight">
                    <div className="insight-icon">💡</div>
                    <div className="insight-content">
                      <div className="insight-label">Theoretical Insight</div>
                      <div className="insight-text">{card.theoreticalInfo}</div>
                    </div>
                  </div>
                  
                  <div className="feature-list">
                    {card.details.split('\n').map((feature, i) => (
                      <div key={i} className="feature-item">
                        <span className="feature-check">✓</span>
                        <span className="feature-text">{feature.replace('✓ ', '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="card-footer-enhanced">
                  <button className="launch-button" style={{ backgroundColor: card.color }}>
                    Launch Module
                    <span className="button-arrow">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="home-container-white">
      {toastMessage && (
        <div className={`toast-white ${toastMessage.type}`}>
          <div className="toast-content-white">
            <span className="toast-icon-white">
              {toastMessage.type === 'success' ? '✓' : toastMessage.type === 'error' ? '✗' : 'ℹ'}
            </span>
            <span className="toast-message-white">{toastMessage.message}</span>
          </div>
        </div>
      )}

      <div className="logout-floating">
        <button onClick={handleLogout} className="logout-floating-button" title="Logout">
          🚪
        </button>
      </div>

      <div className="dispatch-content-white">
        {renderComponent()}
      </div>
    </div>
  );
}

export default Home;