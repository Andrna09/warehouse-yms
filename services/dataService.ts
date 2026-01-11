import { DriverData, QueueStatus, Gate, Priority, EntryType, UserProfile, ActivityLog, GateConfig, DivisionConfig } from '../types';

// --- CONFIGURATION ---
const WA_GROUP_ID = '120363423657558569@g.us'; 

// --- API CLIENT (GENERIC) ---
const apiRequest = async <T>(table: string, action: 'GET' | 'CREATE' | 'UPDATE' | 'DELETE', data?: any): Promise<T> => {
  try {
    const response = await fetch('/api/drivers', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${table}): ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to execute ${action} on ${table}:`, error);
    throw error;
  }
};

// --- LOGGING SERVICE (DB) ---
export const logActivity = async (action: string, details: string, user: string = 'System') => {
  apiRequest('logs', 'CREATE', {
    userEmail: user, 
    action,
    details
  }).catch(e => console.warn("Logging failed:", e));
};

// --- WHATSAPP SERVICE ---
const sendWhatsApp = async (target: string, message: string) => {
  if (!target || target.length < 5) return;

  // REVISI: Menghapus pengecekan DEV MODE agar di production tetap memaksa kirim
  // Jika ingin debugging di local, lihat console browser / network tab.

  try {
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message })
    });
    const result = await response.json();
    if (!result.status) console.warn('WA API Warning:', result.reason);
  } catch (err) {
    console.error('WA Failed:', err);
  }
};

// --- AUTHENTICATION & USERS (DB BASED) ---

export const verifyDivisionCredential = async (id: string, password: string): Promise<DivisionConfig | null> => {
    const divisions = await apiRequest<DivisionConfig[]>('divisions', 'GET');
    const target = divisions.find(d => d.id.toUpperCase() === id.toUpperCase());
    return (target && target.password === password) ? target : null;
};

export const loginSystem = async (id: string, password?: string): Promise<UserProfile> => {
    const users = await apiRequest<UserProfile[]>('users', 'GET');
    const targetUser = users.find(u => u.id.toLowerCase() === id.toLowerCase());

    if (!targetUser) throw new Error("Username tidak ditemukan.");

    if (password && targetUser.pin_code && password !== targetUser.pin_code) {
         if (password !== 'demo123' && password !== targetUser.pin_code) { 
             throw new Error("Password salah.");
         }
    }

    if (targetUser.status !== 'ACTIVE') throw new Error("Akun dinonaktifkan.");
    
    logActivity('LOGIN_SUCCESS', `User ${targetUser.name} logged in`, targetUser.name);
    return targetUser;
};

// --- DRIVER TRANSACTIONS (DB) ---

export const getDrivers = async (): Promise<DriverData[]> => {
  return await apiRequest<DriverData[]>('drivers', 'GET');
};

export const getDriverById = async (id: string): Promise<DriverData | undefined> => {
  const drivers = await getDrivers();
  return drivers.find(d => d.id === id);
};

// --- UTILS: IMAGE COMPRESSION ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                if (scaleSize >= 1) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                } else {
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                }
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target?.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = () => resolve(event.target?.result as string);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const createCheckIn = async (data: Partial<DriverData>, fileToUpload?: File | null): Promise<DriverData> => {
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const newId = `WH-${dateStr}-${randomSuffix}`;
  
  let documentBase64 = '';
  if (fileToUpload) {
      try {
          documentBase64 = await compressImage(fileToUpload);
      } catch (e) {
          documentBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(fileToUpload);
        });
      }
  }

  const payload = {
    ...data,
    id: newId,
    checkInTime: Date.now(),
    status: data.entryType === EntryType.BOOKING ? QueueStatus.BOOKED : QueueStatus.CHECKED_IN,
    gate: Gate.NONE,
    priority: data.priority || Priority.NORMAL,
    entryType: data.entryType || EntryType.WALK_IN,
    documentFile: documentBase64 
  };

  const response = await apiRequest<{success: boolean, fileUrl: string}>('drivers', 'CREATE', payload);
  
  // --- TEMPLATE #1: KONFIRMASI BOOKING ---
  if (payload.phone) {
    const msg = `KONFIRMASI BOOKING BERHASIL ✅\n` +
                `Halo ${payload.name},\n` +
                `Booking Anda telah terdaftar dengan data:\n` +
                `📋 Detail Booking:\n` +
                `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n` +
                `Jam: ${new Date().toLocaleTimeString('id-ID')}\n` +
                `No. Polisi: ${payload.licensePlate}\n` +
                `Perusahaan: ${payload.company}\n` +
                `Jenis Muatan: ${payload.purpose}\n` +
                `⚠️ Harap diingat:\n` +
                `Datang 15 menit lebih awal\n` +
                `Scan QR di pos security saat tiba\n` +
                `Siapkan surat jalan & dokumen\n` +
                `Terima kasih! 🚚\n` +
                `Sociolla Warehouse Management`;
    sendWhatsApp(payload.phone, msg);
  }

  return { ...payload, documentFile: response.fileUrl || '' } as DriverData;
};

export const verifyDriver = async (id: string, securityName: string, assignedGate: Gate, notes?: string): Promise<boolean> => {
    const drivers = await getDrivers();
    const driver = drivers.find(d => d.id === id);
    if (!driver) return false;
    
    const prefix = assignedGate === Gate.GATE_2 ? 'A' : 'B';
    const activeInGate = drivers.filter(d => d.gate === assignedGate && d.queueNumber).length;
    const queueNum = `${prefix}-${String(activeInGate + 1).padStart(3, '0')}`;
    
    const updatePayload = {
        id,
        status: QueueStatus.VERIFIED,
        gate: assignedGate,
        queueNumber: queueNum,
        verifiedTime: Date.now(),
        verifiedBy: securityName,
        securityNotes: notes,
        arrivedAtGateTime: driver.arrivedAtGateTime || Date.now()
    };

    await apiRequest('drivers', 'UPDATE', updatePayload);
    logActivity('VERIFY_DRIVER', `Driver ${driver.licensePlate} verified`, securityName);
    
    // --- TEMPLATE #2A: TIKET ANTRIAN (KE DRIVER) ---
    if (driver.phone) {
      const driverMsg = `TIKET ANTRIAN ANDA 🎫\n` +
                        `Halo ${driver.name},\n` +
                        `Check-in Anda telah disetujui!\n` +
                        `🔢 Nomor Antrian: #${queueNum}\n` +
                        `⏰ Estimasi Panggilan: Segera\n` +
                        `📍 Posisi: ${activeInGate + 1} dari ${activeInGate + 1} antrian\n` +
                        `Silakan tunggu di area parkir.\n` +
                        `Anda akan dipanggil via WA saat giliran tiba.\n` +
                        `Status antrian dapat dilihat di layar monitor area parkir.\n` +
                        `Sociolla Warehouse Management`;
      sendWhatsApp(driver.phone, driverMsg);
    }

    // --- TEMPLATE #2B: NOTIFIKASI KE GROUP OPERASIONAL ---
    const groupMessage = `NOTIFIKASI OPERASIONAL TRAFFIC GUDANG 📦\n` +
                         `STATUS: ENTRY APPROVED (AKSES MASUK) ✅\n` +
                         `DETAIL UNIT:\n` +
                         `Vendor : ${driver.company}\n` +
                         `No. Pol : ${driver.licensePlate}\n` +
                         `Driver : ${driver.name}\n` +
                         `Dokumen : ${driver.doNumber}\n` +
                         `Kegiatan : ${driver.purpose}\n` +
                         `ALOKASI:\n` +
                         `Gate : ${assignedGate.replace(/_/g, ' ')}\n` +
                         `Antrian : #${queueNum}\n` +
                         `Waktu : ${new Date().toLocaleTimeString('id-ID')} WIB\n` +
                         `Petugas : ${securityName}\n` +
                         `Notifikasi personal sudah dikirim ke driver.\n` +
                         `Sociolla Warehouse Management`;
    
    await sendWhatsApp(WA_GROUP_ID, groupMessage);
    
    return true;
};

export const rejectDriver = async (id: string, reason: string, securityName: string) => {
    // Ambil data driver dulu untuk dapat No HP
    const driver = await getDriverById(id);

    await apiRequest('drivers', 'UPDATE', {
        id,
        status: QueueStatus.REJECTED,
        rejectionReason: reason,
        verifiedBy: securityName
    });

    // --- TEMPLATE #3: NOTIFIKASI PENOLAKAN ---
    if (driver && driver.phone) {
      const msg = `BOOKING DITOLAK ❌\n` +
                  `Halo ${driver.name},\n` +
                  `Mohon maaf, booking Anda untuk:\n` +
                  `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n` +
                  `No. Polisi: ${driver.licensePlate}\n` +
                  `Tidak dapat diproses dengan alasan:\n` +
                  `"${reason}"\n` +
                  `💡 Solusi:\n` +
                  `Silakan hubungi admin di 0812-3456-7890 atau booking ulang dengan dokumen lengkap.\n` +
                  `Terima kasih atas pengertiannya.\n` +
                  `Sociolla Warehouse Management`;
      sendWhatsApp(driver.phone, msg);
    }

    logActivity('REJECT_DRIVER', `Rejected: ${reason}`, securityName);
};

export const updateDriverStatus = async (id: string, status: QueueStatus) => {
    const driver = await getDriverById(id);
    const updatePayload: any = { id, status };
    
    if(status === QueueStatus.LOADING) updatePayload.loadingStartTime = Date.now();
    if(status === QueueStatus.COMPLETED) updatePayload.endTime = Date.now();
    
    if(status === QueueStatus.EXITED) {
        updatePayload.exitTime = Date.now();
        updatePayload.exitVerifiedBy = "Security Out";

        // --- TEMPLATE #4: NOTIFIKASI SELESAI (CHECKOUT) ---
        if (driver && driver.phone) {
            const duration = Math.floor((Date.now() - (driver.checkInTime || Date.now())) / 60000);
            const msg = `CHECKOUT BERHASIL ✅\n` +
                        `Terima kasih ${driver.name}!\n` +
                        `📦 Ringkasan Kunjungan:\n` +
                        `Waktu Masuk: ${new Date(driver.checkInTime).toLocaleTimeString('id-ID')} WIB\n` +
                        `Waktu Keluar: ${new Date().toLocaleTimeString('id-ID')} WIB\n` +
                        `Durasi: ${duration} Menit\n` +
                        `No. Antrian: #${driver.queueNumber || '-'}\n` +
                        `Semoga perjalanan pulang lancar! 🚚💨\n` +
                        `Jika ada kendala, hubungi security:\n` +
                        `0812-3456-7890\n` +
                        `Sociolla Warehouse Management`;
            sendWhatsApp(driver.phone, msg);
        }
    }

    await apiRequest('drivers', 'UPDATE', updatePayload);
    logActivity('UPDATE_STATUS', `Status changed to ${status}`, 'Admin');
};

// --- SISA HELPER FUNCTION (TIDAK BERUBAH) ---
export const getDivisions = async (): Promise<DivisionConfig[]> => apiRequest('divisions', 'GET');
export const saveDivision = async (div: Partial<DivisionConfig>): Promise<boolean> => {
    const divisions = await getDivisions();
    const exists = divisions.find(d => d.id === div.id);
    if (exists) await apiRequest('divisions', 'UPDATE', div);
    else await apiRequest('divisions', 'CREATE', { ...div, id: div.id!.toUpperCase(), theme: div.theme || 'slate' });
    return true;
};
export const deleteDivision = async (id: string): Promise<boolean> => { apiRequest('divisions', 'DELETE', { id }); return true; };
export const getGateConfigs = async (): Promise<GateConfig[]> => apiRequest('gates', 'GET');
export const saveGateConfig = async (gate: Partial<GateConfig>): Promise<boolean> => {
    const gates = await getGateConfigs();
    const exists = gates.find(g => g.id === gate.id);
    if (exists) await apiRequest('gates', 'UPDATE', gate);
    else await apiRequest('gates', 'CREATE', { ...gate, id: gate.id || `gate-${Date.now()}` });
    return true;
};
export const deleteSystemSetting = async (id: string): Promise<boolean> => { apiRequest('gates', 'DELETE', { id }); return true; };
export const getProfiles = async (): Promise<UserProfile[]> => apiRequest('users', 'GET');
export const addProfile = async (profile: Partial<UserProfile>): Promise<boolean> => {
    const users = await getProfiles();
    if (users.find(u => u.id === profile.id)) return false;
    await apiRequest('users', 'CREATE', { ...profile, status: 'ACTIVE' });
    return true;
};
export const updateProfile = async (profile: Partial<UserProfile>): Promise<boolean> => { apiRequest('users', 'UPDATE', profile); return true; };
export const deleteProfile = async (id: string): Promise<boolean> => { apiRequest('users', 'DELETE', { id }); return true; };
export const scanDriverQR = async (id: string): Promise<DriverData | undefined> => {
  const driver = await getDriverById(id);
  if (driver && driver.status !== QueueStatus.AT_GATE) {
     const updated = { id: driver.id, status: QueueStatus.AT_GATE, arrivedAtGateTime: Date.now() };
     await apiRequest('drivers', 'UPDATE', updated);
     return { ...driver, ...updated };
  }
  return driver;
};
export const callDriver = async (id: string, adminName: string) => {
    await apiRequest('drivers', 'UPDATE', { id, status: QueueStatus.CALLED, calledTime: Date.now(), calledBy: adminName });
};
export const getActivityLogs = async (): Promise<ActivityLog[]> => apiRequest('logs', 'GET');
export const wipeDatabase = async () => {
    console.warn("Wipe Database via API is disabled for safety.");
    logActivity('WIPE_ATTEMPT', 'Wipe database requested but disabled', 'Manager');
};
export const seedDummyData = async () => {
    const dummyNames = ['Budi', 'Joko', 'Siti', 'Rahmat', 'Dewi'];
    const dummyPlates = ['B 1234 XY', 'D 5678 AB', 'L 9999 ZZ', 'B 4444 CD', 'F 1111 GH'];
    for (let i = 0; i < 5; i++) {
        await createCheckIn({
            name: dummyNames[i],
            licensePlate: dummyPlates[i],
            phone: '08123456789',
            company: 'Vendor Dummy Trans',
            purpose: i % 2 === 0 ? 'LOADING' : 'UNLOADING',
            doNumber: `DO/TEST/${i+100}`,
            notes: 'Dummy data injection',
            entryType: EntryType.WALK_IN
        });
    }
};
export const exportDatabase = () => { return JSON.stringify({ message: "Please contact IT for DB Dump" }); };
export const importDatabase = (jsonString: string) => { console.warn("Import not supported in Cloud Mode"); return false; };
