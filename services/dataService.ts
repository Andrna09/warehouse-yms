import { ActivityLog, DivisionConfig, DriverData, EntryType, Gate, GateConfig, Priority, QueueStatus, SlotInfo, UserProfile } from '../types';

// --- LOCAL STORAGE KEYS ---
const DB_KEY_DRIVERS = 'yms_drivers_v1';
const DB_KEY_GATES = 'yms_gates_v1';
const DB_KEY_USERS = 'yms_users_v1';
const DB_KEY_DIVISIONS = 'yms_divisions_v1';
const DB_KEY_LOGS = 'yms_logs_v1';
const DB_KEY_CONFIG = 'yms_dev_config';
const DB_KEY_WA_GROUP = 'wa_group_id';

// --- INITIAL DATA SEEDING (Agar tidak kosong saat pertama buka) ---
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

// Jalankan Seeding
seedLocalData();

// --- HELPER: SIMULATE ASYNC DELAY ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: LOCAL STORAGE WRAPPER ---
const getStorage = <T>(key: string, defaultVal: T): T => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
};

const setStorage = (key: string, val: any) => {
    localStorage.setItem(key, JSON.stringify(val));
};

// --- WHATSAPP MOCK (Agar tidak error 404 ke API) ---
export const getWAGroupID = (): string => {
    return localStorage.getItem(DB_KEY_WA_GROUP) || '120363423657558569@g.us';
};

export const saveWAGroupID = (id: string) => {
    localStorage.setItem(DB_KEY_WA_GROUP, id);
};

const formatPhone = (phone: string): string => {
    return phone.replace(/\D/g, '').replace(/^0/, '62');
};

const formatWADate = (timestamp: number) => new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const formatWATime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const sendWANotification = async (target: string, message: string) => {
    // MOCK: Hanya log ke console karena API tidak ada di local
    console.log(`%c[MOCK WA SENT] To: ${target}`, 'color: #25D366; font-weight: bold;');
    console.log(message);
    // Kita return success fake
    return true;
};

// --- DRIVER SERVICES (LOCAL STORAGE) ---

export const getDrivers = async (): Promise<DriverData[]> => {
    await delay(200); // Simulasi loading sedikit agar UI tidak kedip terlalu cepat
    return getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
};

export const getDriverById = async (id: string): Promise<DriverData | null> => {
    await delay(100);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    return drivers.find(d => d.id === id) || null;
};

export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData> => {
    await delay(500);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);

    // Generate ID Unik
    const newId = `DRV-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const bookingCode = `SOC-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;

    const newDriver: DriverData = {
        ...data as DriverData,
        id: newId,
        bookingCode: bookingCode,
        status: QueueStatus.BOOKED,
        checkInTime: Date.now(),
        documentFile: docFile, // Simpan Base64 langsung di LocalStorage (Hati-hati size limit 5MB)
        gate: Gate.NONE,
        queueNumber: '-',
    };

    drivers.push(newDriver);
    setStorage(DB_KEY_DRIVERS, drivers);

    // Kirim WA Mock
    if (newDriver.phone) {
        const msg = `*KONFIRMASI BOOKING (LOCAL)* ✅\nBooking: ${bookingCode}`;
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

export const verifyDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);

    if (idx === -1) return false;

    // Hitung Antrian
    const verifiedCount = drivers.filter(d => d.status === QueueStatus.VERIFIED).length;
    const queueNumber = `Q-${(verifiedCount + 1).toString().padStart(3, '0')}`;

    const updatedDriver = {
        ...drivers[idx],
        status: QueueStatus.VERIFIED,
        verifiedBy: verifier,
        verifiedTime: Date.now(),
        securityNotes: notes,
        queueNumber: queueNumber,
        photoBeforeURLs: photos // Simpan base64 foto
    };

    drivers[idx] = updatedDriver;
    setStorage(DB_KEY_DRIVERS, drivers);

    // WA Notifications
    if (updatedDriver.phone) {
        sendWANotification(updatedDriver.phone, `*TIKET ANTRIAN* 🎫\nNo: ${queueNumber}`);
    }
    const groupID = getWAGroupID();
    sendWANotification(groupID, `*OPS REPORT* 📦\nUnit Masuk: ${updatedDriver.licensePlate}`);

    return true;
};

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
        sendWANotification(drivers[idx].phone, `*DITOLAK* ❌\nAlasan: ${reason}`);
    }
    return true;
};

export const callDriver = async (id: string, caller: string, gate: string): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = QueueStatus.CALLED;
    drivers[idx].gate = gate as Gate; // Simplifikasi tipe
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

export const checkoutDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    await delay(300);
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return false;

    drivers[idx].status = QueueStatus.EXITED; // Atau QueueStatus.COMPLETED jika itu status akhirnya
    drivers[idx].exitVerifiedBy = verifier;
    drivers[idx].exitTime = Date.now();
    drivers[idx].notes = notes;
    drivers[idx].photoAfterURLs = photos;

    setStorage(DB_KEY_DRIVERS, drivers);

    if (drivers[idx].phone) {
        sendWANotification(drivers[idx].phone, `*CHECKOUT BERHASIL* ✅`);
    }
    return true;
};

// --- LOOKUP UTILS ---

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
    if (!driver) {
        // Coba cari by booking code
        driver = await findBookingByCode(id);
    }
    return driver;
};

export const getAvailableSlots = async (date: string): Promise<SlotInfo[]> => {
    const times = ["08:00 - 10:00", "10:00 - 12:00", "13:00 - 15:00", "15:00 - 17:00"];
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);

    return times.map(t => {
        const booked = drivers.filter(d => d.slotDate === date && d.slotTime === t && d.status !== QueueStatus.CANCELLED).length;
        const capacity = 10;
        return {
            id: t,
            timeLabel: t,
            capacity,
            booked,
            isAvailable: booked < capacity
        };
    });
};

// --- MASTER DATA MANAGEMENT ---

export const getGateConfigs = async (): Promise<GateConfig[]> => {
    await delay(100);
    return getStorage<GateConfig[]>(DB_KEY_GATES, []);
};

export const saveGateConfig = async (gate: GateConfig): Promise<boolean> => {
    const gates = getStorage<GateConfig[]>(DB_KEY_GATES, []);
    const idx = gates.findIndex(g => g.id === gate.id);
    if (idx >= 0) gates[idx] = gate;
    else gates.push(gate);
    setStorage(DB_KEY_GATES, gates);
    return true;
};

export const deleteSystemSetting = async (id: string): Promise<boolean> => {
    let gates = getStorage<GateConfig[]>(DB_KEY_GATES, []);
    gates = gates.filter(g => g.id !== id);
    setStorage(DB_KEY_GATES, gates);
    return true;
};

export const getProfiles = async (): Promise<UserProfile[]> => {
    await delay(100);
    return getStorage<UserProfile[]>(DB_KEY_USERS, []);
};

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

export const getDivisions = async (): Promise<DivisionConfig[]> => {
    await delay(100);
    return getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
};

export const saveDivision = async (div: DivisionConfig): Promise<boolean> => {
    const divs = getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
    const idx = divs.findIndex(d => d.id === div.id);
    if (idx >= 0) divs[idx] = div;
    else divs.push(div);
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
    const user = users.find(u => (u.id === id || u.name === id) && u.pin_code === pass); // Flexible login
    if (!user) throw new Error("User atau PIN salah");
    return user;
};

export const verifyDivisionCredential = async (id: string, pass: string): Promise<DivisionConfig | null> => {
    await delay(500);
    const divs = getStorage<DivisionConfig[]>(DB_KEY_DIVISIONS, []);
    const div = divs.find(d => d.id === id && d.password === pass);
    return div || null;
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
    return getStorage<ActivityLog[]>(DB_KEY_LOGS, []);
};

// --- SYSTEM UTILS ---

export interface DevConfig {
    enableGpsBypass: boolean;
    enableMockOCR: boolean;
}

export const getDevConfig = (): DevConfig => {
    return getStorage<DevConfig>(DB_KEY_CONFIG, { enableGpsBypass: false, enableMockOCR: false });
};

export const saveDevConfig = (cfg: DevConfig) => {
    setStorage(DB_KEY_CONFIG, cfg);
};

export const wipeDatabase = async () => {
    localStorage.clear();
    seedLocalData(); // Reseed basic data
};

export const seedDummyData = async (force?: boolean) => {
    const drivers = getStorage<DriverData[]>(DB_KEY_DRIVERS, []);

    // Create Dummy Drivers
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

export const checkDatabaseConnection = async (): Promise<boolean> => {
    return true; // LocalStorage selalu connected
};

export const exportDatabase = (): string => {
    const dump = {
        drivers: getStorage(DB_KEY_DRIVERS, []),
        users: getStorage(DB_KEY_USERS, []),
        gates: getStorage(DB_KEY_GATES, []),
        config: getStorage(DB_KEY_CONFIG, {})
    };
    return JSON.stringify(dump, null, 2);
};

export const importDatabase = (json: string): boolean => {
    try {
        const data = JSON.parse(json);
        if (data.drivers) setStorage(DB_KEY_DRIVERS, data.drivers);
        if (data.users) setStorage(DB_KEY_USERS, data.users);
        if (data.gates) setStorage(DB_KEY_GATES, data.gates);
        if (data.config) setStorage(DB_KEY_CONFIG, data.config);
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};

// --- LEGACY EXPORTS COMPATIBILITY ---
export const fetchWAGroups = async () => { return []; };
export const sendPersonalNotification = async (target: string, msg: string) => sendWANotification(target, msg);
export const sendGroupNotification = async (msg: string) => sendWANotification('GROUP', msg);
export const sendDailyReportToGroup = async () => true;
