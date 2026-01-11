import { ActivityLog, DivisionConfig, DriverData, EntryType, Gate, GateConfig, Priority, QueueStatus, SlotInfo, UserProfile } from '../types';

// --- LOCAL STORAGE KEYS ---
const DB_KEY_DRIVERS = 'yms_drivers_v1';
const DB_KEY_GATES = 'yms_gates_v1';
const DB_KEY_USERS = 'yms_users_v1';
const DB_KEY_DIVISIONS = 'yms_divisions_v1';
const DB_KEY_LOGS = 'yms_logs_v1';
const DB_KEY_CONFIG = 'yms_dev_config';
const DB_KEY_WA_GROUP = 'wa_group_id';

// --- INITIAL DATA SEEDING ---
const seedLocalData = () => {
    if (!localStorage.getItem(DB_KEY_GATES)) {
        const defaultGates: GateConfig[] = [
            { id: 'GATE_1', name: 'GATE 1 (Utama)', capacity: 5, status: 'OPEN', type: 'GENERAL' },
            { id: 'DOCK_1', name: 'Loading Dock A', capacity: 1, status: 'OPEN', type: 'DOCK' },
            { id: 'DOCK_2', name: 'Loading Dock B', capacity: 1, status: 'OPEN', type: 'DOCK' },
        ];
        localStorage.setItem(DB_KEY_GATES, JSON.stringify(defaultGates));
    }

    if (!localStorage.getItem(DB_KEY_USERS)) {
        const defaultUsers: UserProfile[] = [
            { id: 'security', name: 'Pak Satpam', role: 'SECURITY', pin_code: '1234', status: 'ACTIVE' },
            { id: 'admin', name: 'Admin Ops', role: 'ADMIN', pin_code: '1234', status: 'ACTIVE' },
            { id: 'manager', name: 'Manager Logistik', role: 'MANAGER', pin_code: '1234', status: 'ACTIVE' }
        ];
        localStorage.setItem(DB_KEY_USERS, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(DB_KEY_DIVISIONS)) {
        const defaultDivs: DivisionConfig[] = [
            { id: 'SECURITY', name: 'Pos Security', password: '123', role: 'SECURITY', theme: 'emerald' },
            { id: 'ADMIN', name: 'Traffic Control', password: '123', role: 'ADMIN', theme: 'blue' },
            { id: 'MANAGER', name: 'System Admin', password: '123', role: 'MANAGER', theme: 'purple' }
        ];
        localStorage.setItem(DB_KEY_DIVISIONS, JSON.stringify(defaultDivs));
    }
};

seedLocalData();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string, defaultVal: T): T => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
};

const setStorage = (key: string, val: any) => {
    localStorage.setItem(key, JSON.stringify(val));
};

// --- WHATSAPP SERVICES (PRODUCTION READY) ---

export const getWAGroupID = (): string => {
    return localStorage.getItem(DB_KEY_WA_GROUP) || '120363423657558569@g.us';
};

export const saveWAGroupID = (id: string) => {
    localStorage.setItem(DB_KEY_WA_GROUP, id);
};

const formatPhone = (phone: string): string => {
    return phone.replace(/\D/g, '').replace(/^0/, '62');
};

/**
 * REVISI: Fungsi Kirim WA menggunakan API Vercel
 */
const sendWANotification = async (target: string, message: string): Promise<boolean> => {
    try {
        const response = await fetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, message }),
        });
        const result = await response.json();
        if (response.ok && result.status === true) {
            console.log(`%c[WA SENT] To: ${target}`, 'color: #25D366; font-weight: bold;');
            return true;
        }
        return false;
    } catch (error) {
        console.error('WhatsApp Error:', error);
        return false;
    }
};

// --- DRIVER SERVICES ---

export const getDrivers = async (): Promise<DriverData[]> => {
    await delay(200);
    return getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
};

export const getDriverById = async (id: string): Promise<DriverData | null> => {
    await delay(100);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    return drivers.find(d => d.id === id) || null;
};

/**
 * REVISI: Template #1 - Konfirmasi Booking Berhasil
 */
export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData> => {
    await delay(500);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const newId = `DRV-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const bookingCode = `SOC-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;

    const newDriver: DriverData = {
        ...data as DriverData,
        id: newId,
        bookingCode: bookingCode,
        status: QueueStatus.BOOKED,
        checkInTime: Date.now(),
        documentFile: docFile,
        gate: Gate.NONE,
        queueNumber: '-',
    };

    drivers.push(newDriver);
    setStorage(DB_KEY_DRIVERS, drivers);

    if (newDriver.phone) {
        const msg = `*KONFIRMASI BOOKING BERHASIL* ✅\n\n` +
                    `Halo ${newDriver.name},\n` +
                    `Booking Anda telah terdaftar:\n\n` +
                    `📋 *Detail Booking:*\n` +
                    `Kode: ${bookingCode}\n` +
                    `No. Pol: ${newDriver.licensePlate}\n` +
                    `Vendor: ${newDriver.company}\n\n` +
                    `⚠️ *Harap diingat:*\n` +
                    `- Datang 15 menit lebih awal\n` +
                    `- Scan QR di security saat tiba\n` +
                    `- Siapkan dokumen lengkap\n\n` +
                    `Terima kasih! 🚚\n` +
                    `_Sociolla Warehouse Management_`;
        sendWANotification(newDriver.phone, msg);
    }

    return newDriver;
};

export const confirmArrivalCheckIn = async (id: string, notes: string, editData?: Partial<DriverData>, newDoc?: string): Promise<DriverData> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Driver not found");

    const updatedDriver = {
        ...drivers[idx],
        ...editData,
        status: QueueStatus.AT_GATE,
        arrivedAtGateTime: Date.now(),
        securityNotes: notes,
        documentFile: newDoc || drivers[idx].documentFile
    };

    drivers[idx] = updatedDriver;
    setStorage(DB_KEY_DRIVERS, drivers);
    return updatedDriver;
};

/**
 * REVISI: Template #2A & #2B - Tiket Antrian & Report Ops
 */
export const verifyDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    const verifiedCount = drivers.filter(d => d.status === QueueStatus.VERIFIED).length;
    const queueNumber = `Q-${(verifiedCount + 1).toString().padStart(3, '0')}`;

    const updatedDriver = {
        ...drivers[idx],
        status: QueueStatus.VERIFIED,
        verifiedBy: verifier,
        verifiedTime: Date.now(),
        securityNotes: notes,
        queueNumber: queueNumber,
        photoBeforeURLs: photos
    };

    drivers[idx] = updatedDriver;
    setStorage(DB_KEY_DRIVERS, drivers);

    if (updatedDriver.phone) {
        const msgDriver = `*TIKET ANTRIAN ANDA* 🎫\n\n` +
                          `Halo ${updatedDriver.name},\n` +
                          `🔢 Nomor Antrian: *#${queueNumber}*\n\n` +
                          `Silakan tunggu di area parkir. Anda akan dipanggil via WA saat giliran tiba.\n` +
                          `_Sociolla Warehouse Management_`;
        sendWANotification(updatedDriver.phone, msgDriver);
    }

    const groupID = getWAGroupID();
    const msgGroup = `*NOTIFIKASI OPERASIONAL* 📦\n` +
                     `STATUS: *ENTRY APPROVED* ✅\n\n` +
                     `Vendor: ${updatedDriver.company}\n` +
                     `No. Pol: ${updatedDriver.licensePlate}\n` +
                     `Antrian: #${queueNumber}\n` +
                     `Petugas: ${verifier}`;
    sendWANotification(groupID, msgGroup);

    return true;
};

/**
 * REVISI: Template #3 - Notifikasi Penolakan
 */
export const rejectDriver = async (id: string, reason: string, verifier: string): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = QueueStatus.REJECTED;
    drivers[idx].rejectionReason = reason;
    drivers[idx].verifiedBy = verifier;

    setStorage(DB_KEY_DRIVERS, drivers);

    if (drivers[idx].phone) {
        const msg = `*BOOKING DITOLAK* ❌\n\n` +
                    `Halo ${drivers[idx].name},\n` +
                    `Mohon maaf, unit ${drivers[idx].licensePlate} ditolak dengan alasan:\n` +
                    `*"${reason}"*\n\n` +
                    `💡 Silakan hubungi admin untuk info lebih lanjut.\n` +
                    `_Sociolla Warehouse Management_`;
        sendWANotification(drivers[idx].phone, msg);
    }
    return true;
};

export const callDriver = async (id: string, caller: string, gate: string): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = QueueStatus.CALLED;
    drivers[idx].gate = gate as Gate;
    drivers[idx].calledBy = caller;
    drivers[idx].calledTime = Date.now();

    setStorage(DB_KEY_DRIVERS, drivers);
    return true;
};

export const updateDriverStatus = async (id: string, status: QueueStatus): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = status;
    if (status === QueueStatus.LOADING) drivers[idx].loadingStartTime = Date.now();
    setStorage(DB_KEY_DRIVERS, drivers);
    return true;
};

/**
 * REVISI: Template #4 - Checkout Berhasil
 */
export const checkoutDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = QueueStatus.EXITED;
    drivers[idx].exitVerifiedBy = verifier;
    drivers[idx].exitTime = Date.now();
    drivers[idx].notes = notes;
    drivers[idx].photoAfterURLs = photos;

    setStorage(DB_KEY_DRIVERS, drivers);

    if (drivers[idx].phone) {
        const msg = `*CHECKOUT BERHASIL* ✅\n\n` +
                    `Terima kasih ${drivers[idx].name}!\n` +
                    `Unit ${drivers[idx].licensePlate} telah selesai checkout.\n` +
                    `Semoga perjalanan pulang lancar! 🚚💨\n` +
                    `_Sociolla Warehouse Management_`;
        sendWANotification(drivers[idx].phone, msg);
    }
    return true;
};

// --- LOOKUP & SYSTEM UTILS (TETAP SAMA) ---
export const findBookingByCode = async (code: string): Promise<DriverData | null> => {
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    return drivers.find(d => d.bookingCode === code) || null;
};

export const findBookingByPlateOrPhone = async (query: string): Promise<DriverData | null> => {
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const q = query.toLowerCase();
    return drivers.find(d =>
        (d.licensePlate.toLowerCase().includes(q) || d.phone === q) &&
        [QueueStatus.BOOKED].includes(d.status)
    ) || null;
};

export const scanDriverQR = async (id: string): Promise<DriverData | null> => {
    let driver = await getDriverById(id);
    if (!driver) driver = await findBookingByCode(id);
    return driver;
};

export const getAvailableSlots = async (date: string): Promise<SlotInfo[]> => {
    const times = ["08:00 - 10:00", "10:00 - 12:00", "13:00 - 15:00", "15:00 - 17:00"];
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    return times.map(t => {
        const booked = drivers.filter(d => d.slotDate === date && d.slotTime === t && d.status !== QueueStatus.CANCELLED).length;
        const capacity = 10;
        return { id: t, timeLabel: t, capacity, booked, isAvailable: booked < capacity };
    });
};

export const getGateConfigs = async (): Promise<GateConfig[]> => { await delay(100); return getStorage<GateConfig[]>(DB_KEY_GATES, []); };
export const saveGateConfig = async (gate: GateConfig): Promise<boolean> => {
    const gates = getStorage<GateConfig[]>(DB_KEY_GATES, []);
    const idx = gates.findIndex(g => g.id === gate.id);
    if (idx >= 0) gates[idx] = gate; else gates.push(gate);
    setStorage(DB_KEY_GATES, gates);
    return true;
};
export const deleteSystemSetting = async (id: string): Promise<boolean> => {
    let gates = getStorage<GateConfig[]>(DB_KEY_GATES, []);
    gates = gates.filter(g => g.id !== id);
    setStorage(DB_KEY_GATES, gates);
    return true;
};
export const getProfiles = async (): Promise<UserProfile[]> => { await delay(100); return getStorage<UserProfile[]>(DB_KEY_USERS, []); };
export const addProfile = async (user: UserProfile): Promise<boolean> => {
    const users = getStorage<UserProfile[]>(DB_KEY_USERS, []);
    if (users.find(u => u.id === user.id)) return false;
    users.push(user);
    setStorage(DB_KEY_USERS, users);
    return true;
};
export const updateProfile = async (user: Partial<UserProfile>): Promise<boolean> => {
    const users = getStorage<UserProfile[]>(DB_KEY_USERS, []);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], ...user };
    setStorage(DB_KEY_USERS, users);
    return true;
};
export const deleteProfile = async (id: string): Promise<boolean> => {
    let users = getStorage<UserProfile[]>(DB_KEY_USERS, []);
    users = users.filter(u => u.id !== id);
    setStorage(DB_KEY_USERS, users);
    return true;
};
export const getDivisions = async (): Promise<DivisionConfig[]> => { await delay(100); return getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []); };
export const saveDivision = async (div: DivisionConfig): Promise<boolean> => {
    const divs = getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
    const idx = divs.findIndex(d => d.id === div.id);
    if (idx >= 0) divs[idx] = div; else divs.push(div);
    setStorage(DB_KEY_DIVISIONS, divs);
    return true;
};
export const deleteDivision = async (id: string): Promise<boolean> => {
    let divs = getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
    divs = divs.filter(d => d.id !== id);
    setStorage(DB_KEY_DIVISIONS, divs);
    return true;
};
export const loginSystem = async (id: string, pass: string): Promise<UserProfile> => {
    await delay(500);
    const users = getStorage<UserProfile[]>(DB_KEY_USERS, []);
    const user = users.find(u => (u.id === id || u.name === id) && u.pin_code === pass);
    if (!user) throw new Error("User atau PIN salah");
    return user;
};
export const verifyDivisionCredential = async (id: string, pass: string): Promise<DivisionConfig | null> => {
    await delay(500);
    const divs = getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
    const div = divs.find(d => d.id === id && d.password === pass);
    return div || null;
};
export const getActivityLogs = async (): Promise<ActivityLog[]> => { return getStorage<ActivityLog[]>(DB_KEY_LOGS, []); };

export interface DevConfig { enableGpsBypass: boolean; enableMockOCR: boolean; }
export const getDevConfig = (): DevConfig => getStorage<DevConfig>(DB_KEY_CONFIG, { enableGpsBypass: false, enableMockOCR: false });
export const saveDevConfig = (cfg: DevConfig) => setStorage(DB_KEY_CONFIG, cfg);
export const wipeDatabase = async () => { localStorage.clear(); seedLocalData(); };
export const seedDummyData = async (force?: boolean) => {
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const dummy: DriverData = {
        id: `DUMMY-${Date.now()}`,
        name: "Budi Santoso (Dummy)",
        licensePlate: "B 1234 TES",
        company: "PT Logistik Test",
        status: QueueStatus.BOOKED,
        bookingCode: "TEST01",
        checkInTime: Date.now(),
        doNumber: "DO-TEST-001",
        phone: "08123456789",
        entryType: EntryType.BOOKING,
        purpose: 'LOADING',
        priority: Priority.NORMAL,
        gate: Gate.NONE
    };
    drivers.push(dummy);
    setStorage(DB_KEY_DRIVERS, drivers);
};
export const checkDatabaseConnection = async (): Promise<boolean> => true;
export const exportDatabase = (): string => JSON.stringify({ drivers: getStorage(DB_KEY_DRIVERS, []), users: getStorage(DB_KEY_USERS, []), gates: getStorage(DB_KEY_GATES, []), config: getStorage(DB_KEY_CONFIG, {}) }, null, 2);
export const importDatabase = (json: string): boolean => {
    try {
        const data = JSON.parse(json);
        if (data.drivers) setStorage(DB_KEY_DRIVERS, data.drivers);
        if (data.users) setStorage(DB_KEY_USERS, data.users);
        if (data.gates) setStorage(DB_KEY_GATES, data.gates);
        if (data.config) setStorage(DB_KEY_CONFIG, data.config);
        return true;
    } catch (e) { return false; }
};

export const fetchWAGroups = async () => [];
export const sendPersonalNotification = async (target: string, msg: string) => sendWANotification(target, msg);
export const sendGroupNotification = async (msg: string) => sendWANotification('GROUP', msg);
export const sendDailyReportToGroup = async () => true;
