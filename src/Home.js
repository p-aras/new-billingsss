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
import Login from "./Login";

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
    totalGatepasses: 0
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

  useEffect(() => {
    // Check if user is already logged in
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
    
    // Only load data if authenticated
    if (authenticated === "true") {
      loadDashboardData();
      loadParties();
      loadRecentDispatches();
      loadStickers();
      loadBills();
      loadGatepasses();
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
      totalGatepasses: savedGatepasses.length
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

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    // Load all data after login
    loadDashboardData();
    loadParties();
    loadRecentDispatches();
    loadStickers();
    loadBills();
    loadGatepasses();
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
    
    showToast(`Gatepass #${newGatepass.gatepassNumber} created successfully for ${gatepassData.vehicleNumber}!`, 'success');
    loadDashboardData();
    setActiveComponent("dashboard");
  };

  const navigationCards = [
    {
      id: "barcode",
      title: "Generate Barcode",
      icon: "🔖",
      description: "Create unique barcodes for product tracking and inventory management",
      theoreticalInfo: "Barcodes encode product information in a visual pattern readable by scanners. Each barcode is unique and can store up to 20+ characters.",
      stats: "Generate GS1-128 compliant barcodes",
      color: "#4CAF50",
      lightColor: "#E8F5E9"
    },
    {
      id: "barcode-scanner",
      title: "Barcode Scanner",
      icon: "📷",
      description: "Scan barcodes to instantly retrieve product and dispatch information",
      theoreticalInfo: "Uses camera or laser to read barcode patterns. Decodes information in milliseconds and integrates with your inventory database.",
      stats: "Real-time scanning & validation",
      color: "#00BCD4",
      lightColor: "#E0F7FA"
    },
    {
      id: "party",
      title: "Party Profile",
      icon: "👥",
      description: "Maintain comprehensive profiles for customers, suppliers, and partners",
      theoreticalInfo: "Centralized database storing contact info, GST details, transaction history, and preferences for all business parties.",
      stats: `${dispatchStats.totalParties} registered parties`,
      color: "#2196F3",
      lightColor: "#E3F2FD"
    },
    {
      id: "party-bill-selection",
      title: "Create Party Bill",
      icon: "💰",
      description: "Generate professional invoices and track payment history",
      theoreticalInfo: "Automated billing system calculates taxes, applies discounts, and maintains financial records for accounting compliance.",
      stats: `${dispatchStats.totalBills} bills generated`,
      color: "#FF5722",
      lightColor: "#FBE9E7"
    },
    {
      id: "packing",
      title: "Packing Copy",
      icon: "📋",
      description: "Create detailed packing slips for dispatch and delivery verification",
      theoreticalInfo: "Packing slips list all items in a shipment, quantities, and special handling instructions for warehouse staff.",
      stats: `${dispatchStats.pendingDispatches} pending dispatches`,
      color: "#FF9800",
      lightColor: "#FFF3E0"
    },
    {
      id: "dispatch",
      title: "Dispatch Details",
      icon: "🚚",
      description: "Track shipments, manage delivery routes, and monitor fleet performance",
      theoreticalInfo: "Real-time tracking system with route optimization, delivery confirmation, and performance analytics.",
      stats: `${dispatchStats.activeDispatches} active deliveries`,
      color: "#9C27B0",
      lightColor: "#F3E5F5"
    },
    {
      id: "sticker",
      title: "Create Sticker",
      icon: "🏷️",
      description: "Design custom labels for branding, warnings, and shipping instructions",
      theoreticalInfo: "Create weather-resistant stickers with custom text, logos, and barcodes for product identification.",
      stats: "Print-ready sticker designs",
      color: "#E91E63",
      lightColor: "#FCE4EC"
    },
    {
      id: "gatepass",
      title: "Gatepass Creation",
      icon: "🚪",
      description: "Generate security gate passes for vehicle entry and exit with automated tracking",
      theoreticalInfo: "Digital gatepass system with QR code authentication, vehicle verification, and real-time security logging for warehouse/facility access control.",
      stats: `${dispatchStats.totalGatepasses} gatepasses issued`,
      color: "#3F51B5",
      lightColor: "#E8EAF6"
    }
  ];

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // If splash screen is showing
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} duration={3000} />;
  }

  const renderComponent = () => {
    switch(activeComponent) {
      case "barcode":
        return <BarcodeGenerator onBack={() => setActiveComponent("dashboard")} />;
      case "barcode-scanner":
        return <BarcodeScanner onBack={() => setActiveComponent("dashboard")} />;
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
      // In Home.js, find the party-bill case in renderComponent:
case "party-bill":
  return (
    <PartyBill 
      parties={parties}
      bills={bills}
      selectedParty={selectedParty}
      onSubmit={handleBillSubmit}
      onBack={handleBackFromBill}
      currentUser={user}  // Add this line to pass user data
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
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => {
    return (
      <div className="dashboard-white">
        {/* Header Section with Logout Button */}
        <div className="header-white">
          <div className="header-content">
            <div className="header-left">
              <h1 className="title-white">Dispatch Management System</h1>
              <p className="subtitle-white">Streamline your logistics operations with powerful tools</p>
            </div>
            <div className="header-right">
              <div className="user-info">
                <span className="user-icon">👤</span>
                <span className="user-name">{user?.fullName || user?.username}</span>
                <span className="user-role">{user?.role === "admin" ? "Admin" : "User"}</span>
              </div>
              <button onClick={handleLogout} className="logout-button">
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid with Large Cards */}
        <div className="actions-section">
          <div className="actions-grid-large">
            {navigationCards.map((card, index) => (
              <div 
                key={card.id}
                className="action-card-large"
                onClick={() => setActiveComponent(card.id)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="card-header" style={{ borderBottomColor: card.lightColor }}>
                  <div className="icon-container" style={{ backgroundColor: card.lightColor }}>
                    <span className="card-icon" style={{ color: card.color }}>{card.icon}</span>
                  </div>
                  <div className="card-title-section">
                    <h3 className="card-title-large">{card.title}</h3>
                    <span className="card-stats" style={{ color: card.color }}>{card.stats}</span>
                  </div>
                </div>
                
                <div className="card-body">
                  <p className="card-description">{card.description}</p>
                  <div className="theoretical-box" style={{ backgroundColor: card.lightColor, borderLeftColor: card.color }}>
                    <div className="theoretical-icon">💡</div>
                    <div className="theoretical-text">
                      <span className="theoretical-label">How it works:</span>
                      <p className="theoretical-info">{card.theoreticalInfo}</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-footer">
                  <button className="action-button" style={{ backgroundColor: card.color }}>
                    Launch Module →
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

      {/* Floating logout button for all views */}
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