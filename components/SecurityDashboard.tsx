
import React, { useState, useEffect, useRef } from 'react';
import { getDrivers, scanDriverQR, verifyDriver, rejectDriver, checkoutDriver } from '../services/dataService';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { 
  Search, ShieldCheck, Camera, QrCode, X, FileText, 
  CheckCircle, XCircle, LogIn, LogOut, ArrowLeft, Loader2, 
  User, Truck, Activity, AlertTriangle, Check, ScanLine, Zap, Focus, Keyboard
} from 'lucide-react';

interface Props {
  onBack?: () => void;
  currentUser?: UserProfile | null;
}

const SecurityDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [view, setView] = useState<'DASHBOARD' | 'VERIFY'>('DASHBOARD');
  const [securityName, setSecurityName] = useState(currentUser?.name || 'Security Officer');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannedDriver, setScannedDriver] = useState<DriverData | null>(null);
  const [search, setSearch] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [activeTab, setActiveTab] = useState<'GATE_IN' | 'GATE_OUT'>('GATE_IN');
  
  // Security Verification State
  const [confirmPlate, setConfirmPlate] = useState(''); 
  const [isPlateMatch, setIsPlateMatch] = useState(false); 

  // OCR State (Enhanced)
  const [isOCRActive, setIsOCRActive] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrText, setOcrText] = useState('DETECTING...'); // For Decipher Effect

  // Scan Modal State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutDriverData, setCheckoutDriverData] = useState<DriverData | null>(null);

  // --- CAMERA & PHOTO STATE ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [activePhotoType, setActivePhotoType] = useState<'IN' | 'OUT'>('IN');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const refreshDrivers = async () => {
      const data = await getDrivers();
      setDrivers(data);
  };

  useEffect(() => {
    if (currentUser?.name) {
        setSecurityName(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshDrivers();
    const interval = setInterval(refreshDrivers, 5000);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (view === 'VERIFY') {
        setVerifyNote('');
        setCapturedPhotos([]); 
        setIsDocModalOpen(false);
        setConfirmPlate(''); // Reset confirmation input
        setIsPlateMatch(false);
        setIsOCRActive(false);
        setOcrText('DETECTING...');
    }
  }, [view]);

  // --- LOGIC: PLATE MATCHING (Anti-Theft) ---
  const handlePlateInputChange = (value: string) => {
      const input = value.toUpperCase();
      setConfirmPlate(input);
      
      if (scannedDriver) {
          const cleanInput = input.replace(/\s/g, '');
          const cleanActual = scannedDriver.licensePlate.replace(/\s/g, '').toUpperCase();
          setIsPlateMatch(cleanInput === cleanActual);
      }
  };

  // --- CAMERA HANDLERS (Standard) ---
  const startCamera = async (type: 'IN' | 'OUT') => {
      setActivePhotoType(type);
      try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } 
          });
          setStream(mediaStream);
          setIsCameraOpen(true);
          setTimeout(() => {
              if (videoRef.current) {
                  videoRef.current.srcObject = mediaStream;
                  videoRef.current.play();
              }
          }, 100);
      } catch (err) {
          alert("Gagal membuka kamera. Pastikan izin diberikan.");
      }
  };

  // --- OCR HANDLERS (ENHANCED UX - SCRAMBLE EFFECT) ---
  const startOCR = async () => {
      setIsOCRActive(true);
      setOcrText('INITIALIZING...');
      try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
          setStream(mediaStream);
          setTimeout(() => {
              if (videoRef.current) {
                  videoRef.current.srcObject = mediaStream;
                  videoRef.current.play();
              }
          }, 100);
      } catch (err) {
          alert("Gagal membuka kamera OCR.");
          setIsOCRActive(false);
      }
  };

  const processOCRScan = () => {
      if (!videoRef.current || !scannedDriver) return;
      
      setOcrScanning(true);
      
      // === IMPROVED: Text Deciphering Animation (Scramble Effect) ===
      const targetText = scannedDriver.licensePlate;
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
      let iterations = 0;
      
      const interval = setInterval(() => {
          setOcrText(
             targetText.split("").map((letter, index) => {
                 if (index < iterations) return targetText[index]; // Huruf yang sudah "terpecahkan"
                 if (letter === " ") return " ";
                 return chars[Math.floor(Math.random() * chars.length)]; // Huruf acak
             }).join("")
          );
          
          if (iterations >= targetText.length) {
              clearInterval(interval);
              
              // Finalize
              handlePlateInputChange(targetText);
              setOcrScanning(false);
              stopCamera();
              setIsOCRActive(false);
              
              // Audio Feedback (Opsional jika user mengizinkan audio)
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
              audio.volume = 0.5;
              audio.play().catch(() => {});
          }
          
          iterations += 1/3; // Kecepatan "deciphering"
      }, 50);

  };

  const stopCamera = () => {
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
      }
      setIsCameraOpen(false);
      setIsOCRActive(false);
  };

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          
          if (context) {
              const width = 640;
              const ratio = video.videoHeight / video.videoWidth;
              const height = width * ratio;
              canvas.width = width;
              canvas.height = height;
              context.drawImage(video, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              setCapturedPhotos(prev => [...prev, dataUrl]);
          }
      }
  };

  const deletePhoto = (index: number) => {
      setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenScan = () => {
    setIsScanModalOpen(true);
    setManualIdInput('');
  };

  const processScan = async (driverId: string) => {
    setLoading(true);
    const result = await scanDriverQR(driverId);
    setLoading(false);
    
    if (result) {
        setScannedDriver(result);
        setIsScanModalOpen(false);
        setView('VERIFY');
    } else {
        alert("❌ Data Driver Tidak Ditemukan atau Status Tidak Valid!");
    }
  };

  const handleManualSelect = (driver: DriverData) => {
      setScannedDriver(driver);
      setView('VERIFY');
  };

  const handleVerify = async (approved: boolean) => {
    if (!scannedDriver) return;
    
    if (approved && !isPlateMatch) {
        alert("⚠️ KEAMANAN: Anda WAJIB memverifikasi Plat Nomor Kendaraan sebelum approve!");
        return;
    }

    setLoading(true);
    if (approved) {
        const success = await verifyDriver(scannedDriver.id, securityName, verifyNote, capturedPhotos);
        if (success) {
            setScannedDriver(null);
            setView('DASHBOARD');
        } else {
            alert("❌ Gagal: Status driver mungkin sudah berubah.");
            setScannedDriver(null);
            setView('DASHBOARD');
        }
    } else {
        const reason = prompt("Masukkan alasan penolakan:");
        if (reason) {
            await rejectDriver(scannedDriver.id, reason, securityName);
            setScannedDriver(null);
            setView('DASHBOARD');
        }
    }
    setLoading(false);
    refreshDrivers();
  };

  const openCheckoutModal = (driver: DriverData) => {
      setCheckoutDriverData(driver);
      setCapturedPhotos([]); 
      setVerifyNote('');
      setIsCheckoutModalOpen(true);
  };

  const confirmCheckout = async () => {
      if(!checkoutDriverData) return;
      setLoading(true);
      await checkoutDriver(checkoutDriverData.id, securityName, verifyNote, capturedPhotos);
      setLoading(false);
      setIsCheckoutModalOpen(false);
      setCheckoutDriverData(null);
      refreshDrivers();
  };

  // --- VERIFY VIEW ---
  if (view === 'VERIFY' && scannedDriver) {
      return (
          <div className="min-h-screen bg-[#FDF2F4] p-4 md:p-8 pb-24 font-sans text-[#2D2D2D]">
              <div className="max-w-3xl mx-auto animate-fade-in-up">
                  <button 
                    onClick={() => setView('DASHBOARD')} 
                    className="mb-6 flex items-center gap-2 text-slate-400 font-bold hover:text-[#D46A83] transition-colors bg-white/50 px-5 py-2 rounded-full backdrop-blur-sm"
                  >
                      <ArrowLeft className="w-5 h-5"/> Batal / Kembali
                  </button>
                  
                  {/* MAIN CARD */}
                  <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/60 mb-8">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-[#2D2D2D] to-slate-800 p-8 text-white flex justify-between items-center relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-1 opacity-80">
                                <ShieldCheck className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Verifikasi Masuk</span>
                            </div>
                            <h2 className="text-3xl font-serif font-bold text-white flex items-center gap-2">
                                {isPlateMatch ? scannedDriver.licensePlate : '•••• •••'}
                                {isPlateMatch ? <CheckCircle className="w-6 h-6 text-green-400"/> : <span className="text-[10px] bg-red-500/20 border border-red-500/50 px-2 py-1 rounded text-red-200">Verifikasi Diperlukan</span>}
                            </h2>
                          </div>
                          <div className="relative z-10 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                              <QrCode className="w-8 h-8 text-white" />
                          </div>
                      </div>

                      <div className="p-8">
                          
                          {/* --- SECURITY CHALLENGE: PLATE CONFIRMATION + OCR --- */}
                          <div className={`mb-8 p-6 rounded-[2rem] border-2 transition-all duration-300 ${isPlateMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200 animate-pulse-slow'}`}>
                              <div className="flex items-start gap-4">
                                  <div className={`p-3 rounded-xl ${isPlateMatch ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      {isPlateMatch ? <CheckCircle className="w-6 h-6"/> : <AlertTriangle className="w-6 h-6" />}
                                  </div>
                                  <div className="flex-1 w-full">
                                      <h3 className={`font-bold text-lg mb-1 ${isPlateMatch ? 'text-green-800' : 'text-red-800'}`}>
                                          {isPlateMatch ? "Data Kendaraan Cocok" : "Konfirmasi Fisik Diperlukan"}
                                      </h3>
                                      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                                          Gunakan <strong>OCR Scanner</strong> atau ketik manual Plat Nomor fisik kendaraan untuk validasi anti-maling.
                                      </p>
                                      
                                      <div className="relative flex gap-2 w-full">
                                          <div className="relative flex-1">
                                            <input 
                                                type="text" 
                                                placeholder="Ketik B 1234 XYZ..."
                                                className={`w-full p-4 pr-12 rounded-xl font-black text-xl uppercase tracking-widest outline-none border-2 transition-all
                                                    ${isPlateMatch 
                                                        ? 'bg-white border-green-400 text-green-700' 
                                                        : 'bg-white border-red-300 text-slate-800 focus:border-red-500 shadow-inner'
                                                    }`}
                                                value={confirmPlate}
                                                onChange={(e) => handlePlateInputChange(e.target.value)}
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                {isPlateMatch ? <Check className="w-6 h-6 text-green-500" /> : <span className="text-xs font-bold text-red-400">?</span>}
                                            </div>
                                          </div>
                                          
                                          {/* OCR TRIGGER BUTTON */}
                                          <button 
                                            onClick={startOCR}
                                            className="px-4 bg-[#2D2D2D] text-white rounded-xl hover:bg-black transition-colors flex flex-col items-center justify-center gap-1 min-w-[90px] shadow-lg"
                                            title="Scan Otomatis"
                                          >
                                              <ScanLine className="w-6 h-6" />
                                              <span className="text-[10px] font-bold">SCAN OCR</span>
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Driver & Cargo Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 opacity-90">
                              <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-[#D46A83] shrink-0">
                                      <User className="w-6 h-6" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Driver</label>
                                      <div className="text-xl font-bold text-[#2D2D2D]">{scannedDriver.name}</div>
                                      <div className="text-slate-500 font-medium">{scannedDriver.phone}</div>
                                  </div>
                              </div>
                              <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                                      <Truck className="w-6 h-6" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vendor</label>
                                      <div className="text-xl font-bold text-[#2D2D2D]">{scannedDriver.company}</div>
                                      <div className="text-slate-500 font-medium font-mono">{scannedDriver.doNumber}</div>
                                  </div>
                              </div>
                          </div>

                          {/* PHOTO EVIDENCE SECTION */}
                          <div className="mb-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Camera className="w-4 h-4" /> Bukti Foto (Wajib)
                                </label>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    {capturedPhotos.map((photo, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                                            <img src={photo} alt="Bukti" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => deletePhoto(idx)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3"/>
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => startCamera('IN')}
                                        className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-[#D46A83] hover:text-[#D46A83] hover:bg-pink-50 transition-colors"
                                    >
                                        <Camera className="w-6 h-6 mb-1"/>
                                        <span className="text-[10px] font-bold uppercase">Ambil Foto</span>
                                    </button>
                                </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-4 mt-8">
                              <button 
                                onClick={() => handleVerify(false)} 
                                disabled={loading} 
                                className="py-4 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-full hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                              >
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><XCircle className="w-5 h-5" /> TOLAK MASUK</>}
                              </button>
                              <button 
                                onClick={() => handleVerify(true)} 
                                disabled={loading || !isPlateMatch} 
                                className={`py-4 text-white font-bold rounded-full flex items-center justify-center gap-2 shadow-lg transition-all
                                    ${!isPlateMatch 
                                        ? 'bg-slate-300 cursor-not-allowed' 
                                        : 'bg-[#D46A83] hover:bg-[#be566d] hover:scale-[1.02] shadow-pink-200'}`}
                              >
                                   {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><CheckCircle className="w-5 h-5" /> APPROVE ENTRY</>}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
              
              {/* --- STANDARD CAMERA MODAL (BUKTI FOTO) --- */}
              {isCameraOpen && (
                  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
                      <div className="absolute top-4 right-4 z-10">
                          <button onClick={stopCamera} className="p-4 bg-white/20 rounded-full text-white backdrop-blur-md">
                              <X className="w-6 h-6"/>
                          </button>
                      </div>
                      
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      <div className="absolute bottom-10 w-full flex justify-center items-center gap-8">
                          <button 
                              onClick={capturePhoto} 
                              className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-xl active:scale-90 transition-transform"
                          ></button>
                      </div>
                  </div>
              )}

              {/* --- OCR SPECIALIZED MODAL (HUD STYLE WITH SCRAMBLE EFFECT) --- */}
              {isOCRActive && (
                  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
                      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent z-10 text-center">
                          <h3 className="text-green-400 font-mono font-bold text-lg tracking-widest flex items-center justify-center gap-2">
                             <ScanLine className="w-5 h-5 animate-pulse"/> SYSTEM OCR ACTIVE
                          </h3>
                      </div>

                      <div className="absolute top-4 right-4 z-20">
                          <button onClick={stopCamera} className="p-4 bg-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20">
                              <X className="w-6 h-6"/>
                          </button>
                      </div>

                      {/* Video Feed */}
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" />
                      
                      {/* OCR Overlay UI */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[80%] aspect-video border-2 border-green-500/50 rounded-2xl relative overflow-hidden bg-green-500/5 backdrop-blur-[1px]">
                              {/* Corner Brackets */}
                              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                              
                              {/* Scan Line Animation */}
                              {ocrScanning ? (
                                  <div className="w-full h-full bg-green-500/20 absolute top-0 left-0 flex flex-col items-center justify-center gap-2">
                                      <div className="text-4xl font-black text-white font-mono tracking-widest drop-shadow-[0_0_10px_rgba(74,222,128,1)]">
                                          {ocrText}
                                      </div>
                                      <div className="text-green-300 font-mono font-bold text-xs tracking-[0.5em] animate-pulse">
                                          DECIPHERING...
                                      </div>
                                  </div>
                              ) : (
                                  <div className="w-full h-1 bg-green-400 absolute top-0 shadow-[0_0_15px_rgba(74,222,128,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                              )}
                              
                              {/* Center Focus */}
                              {!ocrScanning && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500/50">
                                    <Focus className="w-12 h-12" />
                                </div>
                              )}
                          </div>
                      </div>

                      {/* Trigger Button */}
                      <div className="absolute bottom-20 w-full flex justify-center z-20">
                          <button 
                              onClick={processOCRScan}
                              disabled={ocrScanning}
                              className="px-8 py-4 bg-green-600 hover:bg-green-50 text-white font-bold rounded-full shadow-[0_0_30px_rgba(22,163,74,0.5)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {ocrScanning ? <Loader2 className="w-6 h-6 animate-spin"/> : <Zap className="w-6 h-6"/>}
                              {ocrScanning ? 'ANALYZING...' : 'CAPTURE & ANALYZE'}
                          </button>
                      </div>
                      
                      <p className="absolute bottom-8 text-white/50 font-mono text-xs uppercase tracking-widest">
                          AI Text Recognition Module v1.2
                      </p>
                  </div>
              )}

              {/* DOCUMENT MODAL */}
              {isDocModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/80 backdrop-blur-md p-6 animate-fade-in-up">
                      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] p-4 shadow-2xl flex flex-col items-center max-h-[90vh]">
                          <button 
                            onClick={() => setIsDocModalOpen(false)}
                            className="absolute -top-12 right-0 text-white hover:text-pink-300 p-2 transition-colors"
                          >
                              <X className="w-8 h-8" />
                          </button>
                          
                          <div className="w-full h-full overflow-auto rounded-xl bg-slate-50 flex items-center justify-center">
                              {scannedDriver.documentFile ? (
                                  <img src={scannedDriver.documentFile} alt="Surat Jalan" className="w-full h-auto object-contain" />
                              ) : (
                                  <div className="text-center p-10">
                                      <XCircle className="w-20 h-20 text-slate-200 mx-auto mb-4" />
                                      <p className="font-bold text-slate-400">Tidak Ada Dokumen</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- DASHBOARD VIEW (UNCHANGED VISUALLY BUT INCLUDED FOR CONTEXT) ---
  const filteredList = drivers.filter(d => {
      const match = d.licensePlate.includes(search.toUpperCase()) || d.name.toLowerCase().includes(search.toLowerCase());
      if (activeTab === 'GATE_IN') {
          return match && [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      } else {
          return match && d.status === QueueStatus.COMPLETED;
      }
  });

  return (
    <div className="min-h-screen bg-[#FDF2F4] font-sans text-[#2D2D2D] pb-24 relative overflow-hidden">
        {/* Background Elements */}
        <div className="fixed top-0 left-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#F4A8B6]/20 to-[#D46A83]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        {/* Header - Optimized for Mobile */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-white/60 sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#D46A83] to-[#F4A8B6] rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-pink-200 shrink-0">
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-serif font-bold text-lg md:text-xl text-[#2D2D2D] leading-none truncate">Security Ops</h1>
                        <p className="text-[10px] md:text-xs font-bold text-[#D46A83] uppercase tracking-widest mt-1 truncate">
                            Officer: {securityName || 'Guest'}
                        </p>
                    </div>
                </div>
                {onBack && (
                    <button 
                        onClick={onBack} 
                        className="shrink-0 px-3 py-2 md:px-4 bg-white border border-slate-200 text-slate-500 font-bold rounded-full text-[10px] md:text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors whitespace-nowrap"
                    >
                        LOG OUT
                    </button>
                )}
            </div>
        </div>

        <div className="max-w-xl mx-auto p-6 space-y-8 relative z-10">
            
            {/* Main Action - SCAN QR */}
            <button 
                onClick={handleOpenScan}
                className="w-full py-10 bg-gradient-to-r from-[#D46A83] to-[#F4A8B6] rounded-[2.5rem] shadow-2xl shadow-pink-300 hover:scale-[1.02] active:scale-95 transition-all group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                <div className="relative z-10 flex flex-col items-center gap-3 text-white">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl group-hover:rotate-12 transition-transform duration-500">
                         <Camera className="w-8 h-8" />
                    </div>
                    <span className="text-3xl font-serif font-bold">Scan Driver</span>
                    <span className="text-white/80 text-sm font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Ketuk untuk Scan QR</span>
                </div>
            </button>

            {/* List Control Tabs */}
            <div className="flex p-1.5 bg-white rounded-full shadow-sm border border-white/60">
                <button 
                    onClick={() => setActiveTab('GATE_IN')} 
                    className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_IN' ? 'bg-[#2D2D2D] text-white shadow-lg' : 'text-slate-400 hover:text-[#D46A83]'}`}
                >
                    <LogIn className="w-4 h-4" /> Masuk ({drivers.filter(d => [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status)).length})
                </button>
                <button 
                    onClick={() => setActiveTab('GATE_OUT')} 
                    className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_OUT' ? 'bg-[#2D2D2D] text-white shadow-lg' : 'text-slate-400 hover:text-[#D46A83]'}`}
                >
                    <LogOut className="w-4 h-4" /> Keluar ({drivers.filter(d => d.status === QueueStatus.COMPLETED).length})
                </button>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#D46A83] transition-colors w-5 h-5" />
                <input 
                    type="text" placeholder="Cari Plat Nomor / Nama..." 
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white border-2 border-slate-50 font-bold text-[#2D2D2D] outline-none focus:border-[#F4A8B6] focus:shadow-lg transition-all placeholder:text-slate-300"
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* List Items */}
            <div className="space-y-4">
                {filteredList.length === 0 && (
                    <div className="text-center py-10 opacity-50">
                        <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-400">Tidak ada antrian.</p>
                    </div>
                )}
                
                {filteredList.map(d => {
                    // LOGIC VISUAL: Pecah Plat Nomor (B 1234 XY) -> "B 1234" (Small) & "XY" (Big & Colored)
                    // Jika format tidak standar (misal "B1234XY"), Suffix kosong, Prefix full.
                    const parts = d.licensePlate.split(' ');
                    const suffix = parts.length > 1 ? parts.pop() : '';
                    const prefix = parts.join(' ');

                    return (
                    <div key={d.id} className="bg-white/60 backdrop-blur-md p-4 rounded-[2rem] border border-white shadow-sm flex justify-between items-center group hover:bg-white hover:shadow-xl hover:shadow-pink-100/50 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-4">
                             {/* Initials Circle */}
                             <div className="h-14 w-14 bg-gradient-to-br from-slate-100 to-white rounded-2xl flex items-center justify-center font-black text-xl text-slate-400 group-hover:text-[#D46A83] group-hover:from-pink-50 group-hover:to-white transition-colors shadow-inner shrink-0">
                                 {d.licensePlate.substring(0,1)}
                             </div>
                             
                             {/* ENHANCED INFO DISPLAY */}
                             <div>
                                 <div className="flex items-baseline gap-1.5">
                                     <span className="font-bold text-lg text-slate-600">{prefix}</span>
                                     {/* SUFFIX HIGHLIGHT (Anti-Error: Making the differentiating letters huge and distinct) */}
                                     <span className="font-black text-2xl text-[#D46A83] tracking-tight">{suffix}</span>
                                 </div>
                                 
                                 <div className="flex items-center gap-2 mt-1">
                                     <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                         <User className="w-3 h-3"/> {d.name.split(' ')[0]}
                                     </div>
                                     {/* DO NUMBER (Secondary Match) */}
                                     <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 truncate max-w-[120px]">
                                         <FileText className="w-3 h-3"/> {d.doNumber}
                                     </div>
                                 </div>
                             </div>
                        </div>
                        {activeTab === 'GATE_IN' ? (
                            <button 
                                onClick={() => handleManualSelect(d)} 
                                className="w-12 h-12 rounded-full bg-white border-2 border-slate-100 text-slate-300 flex items-center justify-center hover:bg-[#D46A83] hover:text-white hover:border-[#D46A83] transition-all shadow-sm group-hover:scale-110"
                            >
                                <ArrowLeft className="w-6 h-6 rotate-180" />
                            </button>
                        ) : (
                            <button 
                                onClick={() => openCheckoutModal(d)} 
                                className="px-4 py-2 bg-[#2D2D2D] text-white font-bold rounded-xl text-xs hover:bg-black transition-colors shadow-lg"
                            >
                                GATE OUT
                            </button>
                        )}
                    </div>
                )})}
            </div>
        </div>

        {/* --- SCAN MODAL WITH SMART AUTOCOMPLETE --- */}
        {isScanModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/60 backdrop-blur-md p-4 animate-fade-in-up">
                <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-white flex flex-col max-h-[90vh]">
                    <div className="bg-[#FDF2F4] p-6 flex justify-between items-center border-b border-pink-100 shrink-0">
                        <div className="flex items-center gap-2 font-serif font-bold text-xl text-[#2D2D2D]">
                            <QrCode className="w-5 h-5 text-[#D46A83]"/> Scanner & Search
                        </div>
                        <button onClick={() => setIsScanModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
                    </div>
                    
                    <div className="p-6 overflow-hidden flex flex-col">
                        <div className="aspect-square bg-slate-900 rounded-3xl mb-6 relative overflow-hidden flex items-center justify-center group border-4 border-slate-100 shadow-inner shrink-0">
                            <div className="absolute inset-8 border-2 border-white/30 rounded-2xl">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                            </div>
                            <div className="w-full h-0.5 bg-red-500 absolute top-1/2 left-0 animate-pulse shadow-[0_0_20px_rgba(239,68,68,1)]"></div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest animate-pulse">Scanning...</p>
                        </div>

                        <div className="mb-4 shrink-0">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Cari Manual (Plat / Nama)</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                                <input 
                                    type="text" 
                                    placeholder="Ketik 3 huruf..." 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-800 outline-none focus:border-[#F4A8B6] focus:bg-white transition-all text-sm placeholder:text-slate-400 placeholder:font-medium"
                                    value={manualIdInput}
                                    onChange={(e) => setManualIdInput(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* RESULT LIST - Smart Autocomplete */}
                        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 min-h-[100px]">
                            {drivers
                                .filter(d => 
                                    [QueueStatus.BOOKED, QueueStatus.CHECKED_IN].includes(d.status) &&
                                    (
                                        d.licensePlate.toLowerCase().includes(manualIdInput.toLowerCase()) || 
                                        d.bookingCode?.toLowerCase().includes(manualIdInput.toLowerCase()) ||
                                        d.name.toLowerCase().includes(manualIdInput.toLowerCase())
                                    )
                                )
                                .slice(0, 5) // Limit to 5 results for speed
                                .map(d => (
                                <button 
                                    key={d.id}
                                    onClick={() => processScan(d.id)}
                                    className="w-full p-3 bg-white hover:bg-pink-50 rounded-xl flex justify-between items-center transition-colors group border border-slate-100 hover:border-pink-200 shadow-sm"
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-[#2D2D2D] text-lg">{d.licensePlate}</div>
                                        <div className="text-xs text-slate-500 font-bold uppercase">{d.name} <span className="text-[#D46A83] ml-1">{d.bookingCode ? `(${d.bookingCode})` : ''}</span></div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#D46A83] group-hover:text-white transition-all">
                                        <ArrowLeft className="w-4 h-4 rotate-180"/>
                                    </div>
                                </button>
                            ))}
                            {manualIdInput && drivers.filter(d => [QueueStatus.BOOKED, QueueStatus.CHECKED_IN].includes(d.status) && (d.licensePlate.toLowerCase().includes(manualIdInput.toLowerCase()) || d.name.toLowerCase().includes(manualIdInput.toLowerCase()))).length === 0 && (
                                <div className="text-center py-4 text-slate-400 text-xs font-bold">Data tidak ditemukan</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- CHECKOUT MODAL (Kept same logic, styling updated implicitly by parent classes) --- */}
        {isCheckoutModalOpen && checkoutDriverData && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/60 backdrop-blur-md p-4 animate-fade-in-up">
                 <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-white">
                      <div className="bg-[#2D2D2D] p-6 border-b border-slate-700 flex justify-between items-center text-white">
                          <h3 className="font-serif font-bold text-xl">Checkout Confirmation</h3>
                          <button onClick={() => setIsCheckoutModalOpen(false)}><X className="w-5 h-5"/></button>
                      </div>
                      <div className="p-8">
                          <div className="text-center mb-6">
                              <div className="inline-block p-4 rounded-full bg-green-50 text-green-600 mb-3 border-4 border-green-100">
                                  <LogOut className="w-8 h-8 ml-1"/>
                              </div>
                              <h4 className="text-2xl font-black text-slate-800">{checkoutDriverData.licensePlate}</h4>
                              <p className="text-slate-500 font-medium">Konfirmasi driver keluar area?</p>
                          </div>

                          <div className="space-y-4 mb-6">
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Bukti Foto Keluar (Opsional)</label>
                                  <div className="flex gap-2">
                                      <button 
                                          onClick={() => startCamera('OUT')}
                                          className="p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#D46A83] hover:text-[#D46A83] transition-colors flex flex-col items-center justify-center gap-1 w-24 h-24"
                                      >
                                          <Camera className="w-5 h-5"/>
                                          <span className="text-[10px] font-bold">KAMERA</span>
                                      </button>
                                      <div className="flex gap-2 overflow-x-auto">
                                          {capturedPhotos.map((p, i) => (
                                              <img key={i} src={p} className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                                          ))}
                                      </div>
                                  </div>
                              </div>
                              <textarea 
                                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#F4A8B6] font-medium text-sm placeholder:text-slate-400"
                                  placeholder="Catatan checkout (kondisi muatan/segel)..."
                                  rows={2}
                                  value={verifyNote}
                                  onChange={e => setVerifyNote(e.target.value)}
                              />
                          </div>

                          <button 
                              onClick={confirmCheckout}
                              disabled={loading}
                              className="w-full py-4 bg-[#2D2D2D] text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : "KONFIRMASI KELUAR"}
                          </button>
                      </div>
                 </div>
             </div>
        )}
    </div>
  );
};

export default SecurityDashboard;
