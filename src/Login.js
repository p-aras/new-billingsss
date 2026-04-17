// Login.js
import React, { useState, useEffect, useRef } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    fullName: ""
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAllCredentials, setShowAllCredentials] = useState(false);
  const [characterMessage, setCharacterMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [characterExpression, setCharacterExpression] = useState("happy");
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [hasSpokenWelcome, setHasSpokenWelcome] = useState(false);
  const [activeField, setActiveField] = useState(null);
  
  const speechSynthRef = useRef(window.speechSynthesis);
  const currentUtteranceRef = useRef(null);

  // Manager credentials (Vinay) - Updated from admin
  const MANAGER_CREDENTIALS = {
    username: "Vinay",
    password: "Vinay123",
    fullName: "Vinay",
    role: "Manager"
  };

  // Employee credentials (Lavish Jain)
  const EMPLOYEE_CREDENTIALS = {
    username: "Lavish jain",
    password: "Lavish123",
    fullName: "Lavish Jain",
    role: "Employee"
  };

  // Demo user credentials
  const DEMO_USERS = [
    { username: "Vinay", password: "Vinay123", role: "Manager", fullName: "Vinay", color: "#4CAF50" },
    { username: "Lavish jain", password: "Lavish123", role: "Employee", fullName: "Lavish Jain", color: "#2196F3" },
    { username: "manager", password: "manager123", role: "Manager", fullName: "Operations Manager", color: "#4CAF50" },
    { username: "user", password: "user123", role: "User", fullName: "Regular User", color: "#2196F3" },
    { username: "dispatch", password: "dispatch123", role: "Dispatch Officer", fullName: "Dispatch Officer", color: "#FF9800" }
  ];

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthRef.current.getVoices();
      setAvailableVoices(voices);
      const preferredVoice = voices.find(voice => 
        voice.name.includes("Google UK English Female") || 
        voice.name.includes("Samantha") ||
        voice.name.includes("Microsoft Zira") ||
        voice.name.toLowerCase().includes("female")
      );
      setSelectedVoice(preferredVoice || voices[0]);
    };

    loadVoices();
    if (speechSynthRef.current.onvoiceschanged !== undefined) {
      speechSynthRef.current.onvoiceschanged = loadVoices;
    }
  }, []);

  // Speak welcome message when component mounts
  useEffect(() => {
    if (!hasSpokenWelcome && isSpeakingEnabled) {
      setTimeout(() => {
        speakText("Hello User, Welcome back to the MH dispatch management system", "happy");
        setHasSpokenWelcome(true);
        setCharacterMessage("Hello User! Welcome back to the MH dispatch management system 👋");
        setCharacterExpression("happy");
      }, 500);
    }
  }, [hasSpokenWelcome, isSpeakingEnabled]);

  // Stop any ongoing speech when component unmounts
  useEffect(() => {
    return () => {
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  const speakText = (text, emotion = "normal") => {
    if (!isSpeakingEnabled) return;
    
    if (speechSynthRef.current.speaking) {
      speechSynthRef.current.cancel();
    }
    
    const cleanText = text.replace(/[^\w\s!?.,]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    switch(emotion) {
      case "happy":
        utterance.rate = 1.1;
        utterance.pitch = 1.2;
        break;
      case "sad":
        utterance.rate = 0.9;
        utterance.pitch = 0.8;
        break;
      case "excited":
        utterance.rate = 1.2;
        utterance.pitch = 1.3;
        break;
      case "confused":
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        break;
      default:
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
    }
    
    utterance.volume = 1;
    currentUtteranceRef.current = utterance;
    
    speechSynthRef.current.speak(utterance);
  };

  const startTypingMessage = (message, emotion = "normal") => {
    setIsTyping(true);
    let currentMessage = "";
    let i = 0;
    
    speakText(message, emotion);
    
    const typingInterval = setInterval(() => {
      if (i < message.length) {
        currentMessage += message[i];
        setCharacterMessage(currentMessage);
        i++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 50);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError("");
  };

  const handleFieldFocus = (fieldName, placeholderText) => {
    setActiveField(fieldName);
    setCharacterExpression("talking");
    
    // Speak specific message based on which field is focused
    let message = "";
    switch(fieldName) {
      case "username":
        message = "Enter your username";
        break;
      case "password":
        message = "Enter your password";
        break;
      case "fullName":
        message = "Enter your full name";
        break;
      case "email":
        message = "Enter your email address";
        break;
      case "confirmPassword":
        message = "Confirm your password";
        break;
      default:
        message = placeholderText || `Please enter your ${fieldName}`;
    }
    
    startTypingMessage(message, "normal");
    setTimeout(() => setCharacterExpression("happy"), 2000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError("Please enter both username and password");
      setCharacterExpression("sad");
      startTypingMessage("Please enter both username and password to continue", "sad");
      setTimeout(() => setCharacterExpression("happy"), 2000);
      return;
    }

    // Check against Manager credentials (Vinay)
    if (formData.username === MANAGER_CREDENTIALS.username && 
        formData.password === MANAGER_CREDENTIALS.password) {
      const userData = {
        username: MANAGER_CREDENTIALS.username,
        fullName: MANAGER_CREDENTIALS.fullName,
        loginTime: new Date().toISOString(),
        role: MANAGER_CREDENTIALS.role
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userData", JSON.stringify(userData));
      setCharacterExpression("celebrating");
      startTypingMessage(`Welcome ${MANAGER_CREDENTIALS.fullName}! Redirecting you to the dashboard`, "excited");
      setTimeout(() => onLogin(userData), 1500);
      return;
    }

    // Check against Employee credentials (Lavish Jain)
    if (formData.username === EMPLOYEE_CREDENTIALS.username && 
        formData.password === EMPLOYEE_CREDENTIALS.password) {
      const userData = {
        username: EMPLOYEE_CREDENTIALS.username,
        fullName: EMPLOYEE_CREDENTIALS.fullName,
        loginTime: new Date().toISOString(),
        role: EMPLOYEE_CREDENTIALS.role
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userData", JSON.stringify(userData));
      setCharacterExpression("celebrating");
      startTypingMessage(`Welcome ${EMPLOYEE_CREDENTIALS.fullName}! Redirecting you to the dashboard`, "excited");
      setTimeout(() => onLogin(userData), 1500);
      return;
    }

    // Check against demo users
    const demoUser = DEMO_USERS.find(
      user => user.username === formData.username && user.password === formData.password
    );
    
    if (demoUser) {
      const userData = {
        username: demoUser.username,
        fullName: demoUser.fullName,
        role: demoUser.role,
        loginTime: new Date().toISOString()
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userData", JSON.stringify(userData));
      setCharacterExpression("celebrating");
      startTypingMessage(`Welcome ${demoUser.fullName}! Redirecting you to the dashboard`, "excited");
      setTimeout(() => onLogin(userData), 1500);
      return;
    }

    // Check against registered users
    const existingUsers = JSON.parse(localStorage.getItem("registeredUsers") || "[]");
    const registeredUser = existingUsers.find(
      u => u.username === formData.username && u.password === formData.password
    );
    
    if (registeredUser) {
      const userData = {
        username: registeredUser.username,
        fullName: registeredUser.fullName,
        email: registeredUser.email,
        loginTime: new Date().toISOString(),
        role: registeredUser.role || "user"
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userData", JSON.stringify(userData));
      setCharacterExpression("celebrating");
      startTypingMessage(`Welcome back ${registeredUser.fullName}!`, "happy");
      setTimeout(() => onLogin(userData), 1500);
    } else {
      setError("Invalid username or password");
      setCharacterExpression("sad");
      startTypingMessage("Invalid username or password. Please check your credentials and try again", "sad");
      setTimeout(() => setCharacterExpression("happy"), 3000);
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.username || !formData.password) {
      setError("Please fill in all fields");
      setCharacterExpression("sad");
      startTypingMessage("Please fill in all fields to complete your registration", "sad");
      setTimeout(() => setCharacterExpression("happy"), 2000);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setCharacterExpression("confused");
      startTypingMessage("Passwords do not match. Please re-enter your password", "confused");
      setTimeout(() => setCharacterExpression("happy"), 2000);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      startTypingMessage("Password must be at least 6 characters long for security", "sad");
      return;
    }

    const existingUsers = JSON.parse(localStorage.getItem("registeredUsers") || "[]");
    
    if (existingUsers.some(user => user.username === formData.username)) {
      setError("Username already exists");
      setCharacterExpression("sad");
      startTypingMessage("Username already exists. Please choose a different username", "sad");
      setTimeout(() => setCharacterExpression("happy"), 2000);
      return;
    }

    if (DEMO_USERS.some(user => user.username === formData.username) ||
        formData.username === MANAGER_CREDENTIALS.username ||
        formData.username === EMPLOYEE_CREDENTIALS.username) {
      setError("Username is reserved");
      startTypingMessage("That username is reserved. Please choose a different one", "sad");
      return;
    }

    const newUser = {
      id: Date.now(),
      fullName: formData.fullName,
      email: formData.email,
      username: formData.username,
      password: formData.password,
      role: "user",
      createdAt: new Date().toISOString()
    };

    existingUsers.push(newUser);
    localStorage.setItem("registeredUsers", JSON.stringify(existingUsers));
    
    const userData = {
      username: formData.username,
      fullName: formData.fullName,
      loginTime: new Date().toISOString(),
      role: "user"
    };
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("userData", JSON.stringify(userData));
    setCharacterExpression("celebrating");
    startTypingMessage(`Account created successfully! Welcome ${formData.fullName}!`, "excited");
    setTimeout(() => onLogin(userData), 1500);
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: ""
    });
    setActiveField(null);
    setCharacterExpression("talking");
    
    const message = isLogin 
      ? "Let's create your new account. Please fill in your details" 
      : "Welcome back. Please enter your login credentials";
    
    startTypingMessage(message, "normal");
    setTimeout(() => setCharacterExpression("happy"), 2000);
  };

  const fillDemoCredentials = (username, password, user) => {
    setFormData({
      ...formData,
      username: username,
      password: password
    });
    setError("");
    setCharacterExpression("excited");
    startTypingMessage(`${user.role} credentials loaded. Click the login button to continue`, "excited");
    setTimeout(() => setCharacterExpression("happy"), 2000);
  };

  const toggleSpeaking = () => {
    if (isSpeakingEnabled) {
      speechSynthRef.current.cancel();
    }
    setIsSpeakingEnabled(!isSpeakingEnabled);
    const message = isSpeakingEnabled ? "Voice assistance disabled" : "Voice assistance enabled";
    startTypingMessage(message, "normal");
  };

  // Blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000);
    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className="login-container-column">
      {/* 3D Background */}
      <div className="background-3d-column">
        <div className="floating-cubes">
          <div className="cube-mini cube1"></div>
          <div className="cube-mini cube2"></div>
          <div className="cube-mini cube3"></div>
          <div className="cube-mini cube4"></div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="columns-wrapper">
        {/* Left Column - Character */}
        <div className={`character-column ${showCharacter ? 'fade-in' : ''}`}>
          <div className="character-container-3d">
            {/* Voice Control Button */}
            <button 
              className={`voice-control-btn ${isSpeakingEnabled ? 'active' : 'muted'}`}
              onClick={toggleSpeaking}
              title={isSpeakingEnabled ? "Mute voice assistant" : "Unmute voice assistant"}
            >
              {isSpeakingEnabled ? "🔊" : "🔇"}
            </button>
            
            {/* 3D Character */}
            <div className={`character-3d-enhanced ${characterExpression}`}>
              {/* Shadow */}
              <div className="character-shadow"></div>
              
              {/* Body */}
              <div className="character-body-3d">
                {/* Legs */}
                <div className="legs-3d">
                  <div className="leg-3d left-leg-3d">
                    <div className="shoe"></div>
                  </div>
                  <div className="leg-3d right-leg-3d">
                    <div className="shoe"></div>
                  </div>
                </div>
                
                {/* Torso */}
                <div className="torso-3d">
                  <div className="shirt-3d">
                    <div className="shirt-pattern"></div>
                    <div className="tie"></div>
                    <div className="buttons">
                      <div className="btn"></div>
                      <div className="btn"></div>
                      <div className="btn"></div>
                    </div>
                  </div>
                  
                  {/* Arms */}
                  <div className="arms-3d">
                    <div className="arm-3d left-arm-3d">
                      <div className="hand-3d">
                        <div className="finger"></div>
                        <div className="finger"></div>
                        <div className="finger"></div>
                      </div>
                    </div>
                    <div className="arm-3d right-arm-3d">
                      <div className="hand-3d">
                        <div className="finger"></div>
                        <div className="finger"></div>
                        <div className="finger"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Head */}
                <div className="head-3d">
                  {/* Hat */}
                  <div className="hat-3d">
                    <div className="hat-top-3d"></div>
                    <div className="hat-brim-3d"></div>
                    <div className="hat-band"></div>
                  </div>
                  
                  {/* Face */}
                  <div className="face-3d">
                    {/* Eyes */}
                    <div className="eyes-3d">
                      <div className={`eye-3d left-eye-3d ${isBlinking ? 'blink' : ''}`}>
                        <div className="pupil"></div>
                      </div>
                      <div className={`eye-3d right-eye-3d ${isBlinking ? 'blink' : ''}`}>
                        <div className="pupil"></div>
                      </div>
                    </div>
                    
                    {/* Eyebrows */}
                    <div className="eyebrows-3d">
                      <div className="eyebrow left-eyebrow"></div>
                      <div className="eyebrow right-eyebrow"></div>
                    </div>
                    
                    {/* Nose */}
                    <div className="nose-3d"></div>
                    
                    {/* Mouth based on expression */}
                    <div className={`mouth-3d ${characterExpression}`}>
                      {characterExpression === "happy" && <div className="smile"></div>}
                      {characterExpression === "sad" && <div className="sad-mouth"></div>}
                      {characterExpression === "excited" && <div className="excited-mouth"></div>}
                      {characterExpression === "talking" && <div className="talking-mouth"></div>}
                      {characterExpression === "confused" && <div className="confused-mouth"></div>}
                      {characterExpression === "celebrating" && <div className="celebrating-mouth"></div>}
                    </div>
                    
                    {/* Cheeks */}
                    <div className="cheeks-3d">
                      <div className="cheek left-cheek"></div>
                      <div className="cheek right-cheek"></div>
                    </div>
                  </div>
                  
                  {/* Ears */}
                  <div className="ears-3d">
                    <div className="ear left-ear"></div>
                    <div className="ear right-ear"></div>
                  </div>
                </div>
              </div>
              
              {/* Speech Bubble */}
              <div className="speech-bubble-3d">
                <div className="bubble-content">
                  <span className="bubble-icon">
                    {characterExpression === "happy" && "😊"}
                    {characterExpression === "sad" && "😢"}
                    {characterExpression === "excited" && "🤩"}
                    {characterExpression === "talking" && "💬"}
                    {characterExpression === "confused" && "🤔"}
                    {characterExpression === "celebrating" && "🎉"}
                  </span>
                  <span className="bubble-text">
                    {characterMessage || "Hello! 👋"}
                    {isTyping && <span className="typing-cursor">|</span>}
                  </span>
                </div>
                <div className="bubble-tail"></div>
              </div>
              
              {/* Sound wave animation when speaking */}
              {isTyping && isSpeakingEnabled && (
                <div className="sound-waves">
                  <div className="wave"></div>
                  <div className="wave"></div>
                  <div className="wave"></div>
                </div>
              )}
              
              {/* Floating particles around character */}
              <div className="character-particles">
                <div className="particle-star">⭐</div>
                <div className="particle-star">✨</div>
                <div className="particle-star">🌟</div>
                <div className="particle-star">💫</div>
              </div>
            </div>
            
            {/* Character name tag */}
            <div className="name-tag">
              <span className="name-icon">🤖</span>
              <span className="name-text">Dispatch Assistant</span>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="form-column">
          <div className="login-card-enhanced">
            <div className="login-header-enhanced">
              <div className="logo-container-enhanced">
                <span className="logo-icon-enhanced">🚚</span>
                <div className="logo-glow"></div>
              </div>
              <h1 className="login-title-enhanced">Dispatch Management System</h1>
              <p className="login-subtitle-enhanced">
                {isLogin ? "Welcome back! Please login to your account" : "Create a new account to get started"}
              </p>
            </div>

            {error && (
              <div className="error-message-enhanced">
                <span className="error-icon-enhanced">⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="login-form-enhanced">
              {!isLogin && (
                <>
                  <div className="form-group-enhanced">
                    <label className="form-label-enhanced">
                      <span className="label-icon-enhanced">👤</span>
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      onFocus={() => handleFieldFocus("fullName", "Enter your full name")}
                      className="form-input-enhanced"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="form-group-enhanced">
                    <label className="form-label-enhanced">
                      <span className="label-icon-enhanced">📧</span>
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => handleFieldFocus("email", "Enter your email address")}
                      className="form-input-enhanced"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group-enhanced">
                <label className="form-label-enhanced">
                  <span className="label-icon-enhanced">👨‍💼</span>
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus("username", "Enter your username")}
                  className="form-input-enhanced"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group-enhanced">
                <label className="form-label-enhanced">
                  <span className="label-icon-enhanced">🔒</span>
                  Password
                </label>
                <div className="password-input-wrapper-enhanced">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("password", "Enter your password")}
                    className="form-input-enhanced"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-enhanced"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="form-group-enhanced">
                  <label className="form-label-enhanced">
                    <span className="label-icon-enhanced">✓</span>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("confirmPassword", "Confirm your password")}
                    className="form-input-enhanced"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="login-button-enhanced">
                <span className="button-icon">{isLogin ? "🔓" : "📝"}</span>
                {isLogin ? "Login to Dashboard" : "Create Account"}
                <span className="button-glow"></span>
              </button>
            </form>

            <div className="login-footer-enhanced">
              <p className="toggle-text-enhanced">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button onClick={toggleForm} className="toggle-button-enhanced">
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
              
              {isLogin && (
                <div className="demo-credentials-enhanced">
                  <div className="demo-header-enhanced">
                    <p className="demo-title-enhanced">🎯 Quick Login with Demo Accounts</p>
                    <button 
                      className="toggle-credentials-enhanced"
                      onClick={() => setShowAllCredentials(!showAllCredentials)}
                    >
                      {showAllCredentials ? "Hide All" : "Show All"}
                    </button>
                  </div>
                  
                  {!showAllCredentials ? (
                    <div className="demo-quick-enhanced">
                      <div className="demo-card-enhanced" onClick={() => fillDemoCredentials("Vinay", "Vinay123", DEMO_USERS[0])}>
                        <span className="demo-role-enhanced">👑 Manager</span>
                        <div className="demo-details-enhanced">
                          <code>Vinay / Vinay123</code>
                          <span className="demo-click-enhanced">Click to auto-fill →</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="demo-list-enhanced">
                      {DEMO_USERS.map((user, index) => (
                        <div 
                          key={index}
                          className="demo-item-enhanced"
                          onClick={() => fillDemoCredentials(user.username, user.password, user)}
                          style={{ borderLeftColor: user.color }}
                        >
                          <div className="demo-item-header-enhanced">
                            <span className="demo-item-role-enhanced">
                              {user.role === "Manager" ? "👑" : 
                               user.role === "Employee" ? "👤" : 
                               user.role === "Dispatch Officer" ? "🚚" : "📊"} {user.role}
                            </span>
                            <span className="demo-item-badge">Click to use</span>
                          </div>
                          <div className="demo-item-credentials-enhanced">
                            <code>{user.username}</code>
                            <span className="demo-separator-enhanced">/</span>
                            <code>{user.password}</code>
                          </div>
                          <div className="demo-item-name-enhanced">{user.fullName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="demo-note-enhanced">
                    <span className="demo-note-icon-enhanced">💡</span>
                    <span>Click any credential to auto-fill</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;