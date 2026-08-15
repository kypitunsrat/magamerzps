import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://naspibprbcyocgodhfhi.supabase.co';
const supabaseKey = 'sb_publishable_9LLVWyRnLRKXU2ysA5R_gA_4MJPx7IK';
const supabase = createClient(supabaseUrl, supabaseKey);

let daftarPaket = [], daftarMakanan = [], dataTVGlobal = [], dataTransaksi = [];
let tvTerpilih = null;
let filterAktif = 'harian';
let tanggalTerpilihKalender = null; 

let kalenderTahunAktif = new Date().getFullYear();
let kalenderBulanAktif = new Date().getMonth();
let offsetMingguan = 0; 

let tvSedangDiprosesOtomatis = {}; 
let blokirAutoCheckout = {}; 
let intervalTimerApp = null; 
let myChartInstance = null;

// ==========================================
// FUNGSI HELPER (REFACTORING UTILITY)
// ==========================================

function formatJam(isoString) {
    if(!isoString) return "";
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar', hour12: false });
}

function getWaktuAsli() {
    return new Date();
}

function generatePaketDropdownHTML(defaultText, includePromo = false) {
    let optWaktu = [], optStik = [];
    daftarPaket.forEach(p => {
        const optHtml = `<option value="${p.id}" data-durasi="${p.duration_minutes}" data-harga="${p.price}" data-nama="${p.name} (Rp ${p.price.toLocaleString('id-ID')})">${p.name} - Rp ${p.price.toLocaleString('id-ID')}</option>`;
        if (p.duration_minutes === 0 || p.name.toLowerCase().includes('stick') || p.name.toLowerCase().includes('stik')) {
            optStik.push(optHtml);
        } else {
            optWaktu.push(optHtml);
        }
    });

    let html = `<option value="">-- ${defaultText} --</option>`;
    if (optWaktu.length > 0) html += `<optgroup label="⏱️ Paket Waktu">${optWaktu.join('')}</optgroup>`;
    if (optStik.length > 0) html += `<optgroup label="🎮 Tambahan Stick">${optStik.join('')}</optgroup>`;

    if (includePromo) {
        html += `<optgroup label="🔥 Promo Spesial">
            <option value="PROMO_1JAM_3JAM" data-durasi="120" data-harga="10000" data-nama="Tambah 1 Jam (Jadi Paket 3 Jam) (Rp 10.000)">🔥 Tambah 1 Jam (Jadi Paket 3 Jam) - Rp 10.000</option>
            <option value="PROMO_30MNT_3JAM" data-durasi="90" data-harga="5000" data-nama="Tambah 30 Menit (Jadi Paket 3 Jam) (Rp 5.000)">🔥 Tambah 30 Menit (Jadi Paket 3 Jam) - Rp 5.000</option>
            <option value="KLAIM_BONUS_1JAM" data-durasi="60" data-harga="0" data-nama="🎁 Klaim Bonus 1 Jam (Rp 0)">🎁 Klaim Bonus 1 Jam - Rp 0</option>
        </optgroup>`;
    }
    return html;
}

function generateMakananDropdownHTML() {
    let html = '<option value="">-- Pilih Menu Makanan --</option>';
    let grupMinuman = [], grupGoreng = [], grupSoto = [], grupLainnya = [];

    daftarMakanan.forEach(m => {
        let namaLower = m.name.toLowerCase();
        let opt = `<option value="${m.price}" data-nama="${m.name}">${m.name} (Rp ${m.price.toLocaleString('id-ID')})</option>`;
        if (namaLower.includes('indomie goreng') || namaLower.includes('mie goreng')) grupGoreng.push(opt);
        else if (namaLower.includes('indomie soto') || namaLower.includes('mie soto')) grupSoto.push(opt);
        else if (namaLower.includes('air') || namaLower.includes('teh') || namaLower.includes('floridina') || namaLower.includes('kopi') || namaLower.includes('es') || namaLower.includes('minum')) grupMinuman.push(opt);
        else grupLainnya.push(opt);
    });

    if (grupMinuman.length) html += `<optgroup label="🥤 Kelompok Minuman">${grupMinuman.join('')}</optgroup>`;
    if (grupGoreng.length) html += `<optgroup label="🍝 Kelompok Indomie Goreng">${grupGoreng.join('')}</optgroup>`;
    if (grupSoto.length) html += `<optgroup label="🍜 Kelompok Indomie Soto">${grupSoto.join('')}</optgroup>`;
    if (grupLainnya.length) html += `<optgroup label="🍔 Kelompok Lainnya">${grupLainnya.join('')}</optgroup>`;
    
    return html;
}

function hitungRekapKeuangan(transaksiList) {
    let rekap = { kotor: 0, rental: 0, makan: 0, pem: 0, peng: 0, bersih: 0 };
    transaksiList.forEach(t => {
        if (t.total_price >= 0) {
            let ren = t.rental_price || 0;
            let mak = t.food_price || 0;
            let pem = t.total_price - ren - mak;
            rekap.rental += ren;
            rekap.makan += mak;
            rekap.pem += pem;
            rekap.kotor += t.total_price;
        } else {
            rekap.peng += t.total_price;
        }
    });
    rekap.bersih = rekap.kotor + rekap.peng;
    return rekap;
}

function updateUIRekapKeuangan(rekap) {
    document.getElementById('lap-total-kotor').innerText = `Rp ${rekap.kotor.toLocaleString('id-ID')}`;
    document.getElementById('lap-total-bersih').innerText = `Rp ${rekap.bersih.toLocaleString('id-ID')}`;
    document.getElementById('lap-rental').innerText = `Rp ${rekap.rental.toLocaleString('id-ID')}`;
    document.getElementById('lap-makanan').innerText = `Rp ${rekap.makan.toLocaleString('id-ID')}`;
    document.getElementById('lap-pemasukan').innerText = `+ Rp ${rekap.pem.toLocaleString('id-ID')}`;
    document.getElementById('lap-pengeluaran').innerText = `- Rp ${Math.abs(rekap.peng).toLocaleString('id-ID')}`;
}

// ==========================================
// CORE SYSTEM & AUTH
// ==========================================

function cekTemaAwal() {
    const temaSimpanan = localStorage.getItem('theme');
    if (temaSimpanan === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('btn-theme').innerText = '🌙';
    }
}
cekTemaAwal();

window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('btn-theme').innerText = isDark ? '🌙' : '☀️';
    if(myChartInstance) muatDataLaporan(); 
};

function putarBunyiAlarm() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
        console.log("Audio API dicegah oleh browser.");
    }
}

window.prosesLogin = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if(!email || !password) return alert("Harap isi Email dan Password!");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Login Gagal: " + error.message);
};

window.prosesLogout = async function() {
    if(!confirm("Anda yakin ingin keluar dari aplikasi?")) return;
    await supabase.auth.signOut();
};

window.bukaModalUbahPassword = function() {
    document.getElementById('input-pass-baru').value = '';
    document.getElementById('input-pass-konfirm').value = '';
    document.getElementById('modal-ubah-password').style.display = 'flex';
};

window.tutupModalUbahPassword = function() {
    document.getElementById('modal-ubah-password').style.display = 'none';
};

window.simpanPasswordBaru = async function() {
    const baru = document.getElementById('input-pass-baru').value;
    const konfirm = document.getElementById('input-pass-konfirm').value;
    if(!baru || !konfirm) return alert("Semua kolom harus diisi!");
    if(baru !== konfirm) return alert("Password baru dan konfirmasi tidak cocok!");
    if(baru.length < 6) return alert("Password minimal 6 karakter!");
    const { data, error } = await supabase.auth.updateUser({ password: baru });
    if (error) {
        alert("Gagal merubah password: " + error.message);
    } else {
        alert("Password berhasil diubah secara permanen!");
        window.tutupModalUbahPassword();
    }
};

supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        const mainApp = document.getElementById('main-app-container');
        if (mainApp.style.display !== 'block') {
            document.getElementById('page-login').classList.remove('active');
            mainApp.style.display = 'block';
            window.pindahTab('dashboard');
            mulaiAplikasiUtama();
        }
    } else {
        hentikanAplikasiUtama();
        document.getElementById('main-app-container').style.display = 'none';
        document.getElementById('page-login').classList.add('active');
    }
});

async function mulaiAplikasiUtama() {
    updateWaktuHeader();
    if(!intervalTimerApp) intervalTimerApp = setInterval(rutinitasSistem, 1000);
    jalankanAplikasi(); 
}

function hentikanAplikasiUtama() {
    if(intervalTimerApp) {
        clearInterval(intervalTimerApp);
        intervalTimerApp = null;
    }
}

function updateWaktuHeader() {
    const opsi = { timeZone: 'Asia/Makassar', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const el = document.getElementById('header-waktu');
    if(el) el.innerText = getWaktuAsli().toLocaleDateString('id-ID', opsi) + ' WITA';
}

function rutinitasSistem() {
    updateWaktuHeader(); 
    if (dataTVGlobal.length > 0) {
        let adaYangHabis = false;
        dataTVGlobal.forEach(tv => {
            if (tv.is_active && tv.end_time && new Date(tv.end_time).getTime() <= getWaktuAsli().getTime()) {
                if (blokirAutoCheckout[tv.id]) return; 

                if (tvTerpilih === tv.id && document.getElementById('modal-aktif').style.display === 'flex') {
                    return; 
                }

                adaYangHabis = true;
                prosesCheckout(tv, true);
            }
        });
        if(!adaYangHabis) renderTampilan(dataTVGlobal); 
    } 
}

window.pindahTab = function(tabName) {
    document.querySelectorAll('.page, .nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + tabName).classList.add('active');
    document.getElementById('nav-' + tabName).classList.add('active');
    if (tabName === 'laporan') muatDataLaporan();
    if (tabName === 'pengaturan') muatDataPengaturan();
};

async function jalankanAplikasi() {
    try {
        const { data: paket } = await supabase.from('packages').select('*').order('price', { ascending: true });
        if (paket) daftarPaket = paket;
        const { data: makanan } = await supabase.from('foods').select('*').order('price', { ascending: true });
        if (makanan) daftarMakanan = makanan;
        const { data: tvs } = await supabase.from('tvs').select('*').order('id', { ascending: true });
        if (tvs) dataTVGlobal = tvs;
        renderTampilan(tvs);
    } catch (err) { console.error(err); }
}

function hitungSisaWaktu(endTime) {
    if (!endTime) return "";
    const ms = new Date(endTime).getTime() - getWaktuAsli().getTime();
    if (ms <= 0) return "Selesai..."; 
    const d = Math.floor(ms / 1000);
    const j = Math.floor(d / 3600);
    const m = Math.floor((d % 3600) / 60);
    const s = d % 60;
    return j > 0 ? `${j}j ${m}m` : `${m}m ${s}s`;
}

// ==========================================
// RENDER TAMPILAN DOM DIFFING
// ==========================================
function renderTampilan(tvData) {
    if(!document.getElementById('app')) return;

    let aktifCount = 0, tersediaCount = 0;
    tvData.forEach(tv => { if(tv.is_active) aktifCount++; else tersediaCount++; });

    let statsContainer = document.getElementById('header-stats-container');
    let htmlStatsBaru = `
        <div class="h-stat merah"><span style="font-size:14px;">🎮</span> ${aktifCount} Main</div>
        <div class="h-stat hijau"><span style="font-size:14px;">✅</span> ${tersediaCount} Kosong</div>
        <div class="h-stat biru"><span style="font-size:14px;">📺</span> ${tvData.length} Total</div>
    `;

    if (statsContainer.innerHTML.trim() !== htmlStatsBaru.trim()) {
        statsContainer.innerHTML = htmlStatsBaru;
    }

    let appContainer = document.getElementById('app');
    let gridContainer = document.getElementById('tv-grid-container');

    if (!gridContainer) {
        appContainer.innerHTML = '<div class="grid-container" id="tv-grid-container"></div>';
        gridContainer = document.getElementById('tv-grid-container');
        
        let htmlBoxes = '';
        tvData.forEach(tv => {
            htmlBoxes += `
                <div class="tv-box bg-green" id="tv-box-${tv.id}" onclick="window.klikTV(${tv.id})">
                    <h3>TV ${tv.id}</h3>
                    <p style="margin:0; opacity: 0.9;" id="tv-status-teks-${tv.id}">Tersedia</p>
                    <span class="jam-main" id="tv-jam-${tv.id}"></span>
                    <div class="countdown" id="tv-countdown-${tv.id}"></div>
                    <div class="rincian" id="tv-rincian-${tv.id}"></div>
                </div>`;
        });
        gridContainer.innerHTML = htmlBoxes;
    }

    tvData.forEach(tv => {
        const box = document.getElementById(`tv-box-${tv.id}`);
        const statusTeks = document.getElementById(`tv-status-teks-${tv.id}`);
        const jamMain = document.getElementById(`tv-jam-${tv.id}`);
        const countdown = document.getElementById(`tv-countdown-${tv.id}`);
        const rincian = document.getElementById(`tv-rincian-${tv.id}`);

        if (!tv.is_active) {
            if (!box.classList.contains('bg-green')) {
                box.className = 'tv-box bg-green';
                box.onclick = () => window.klikTV(tv.id);
            }
        } else {
            if (!box.classList.contains('bg-red')) {
                box.className = 'tv-box bg-red';
                box.onclick = () => window.klikTVAktif(tv.id);
            }
            
            let sisa = hitungSisaWaktu(tv.end_time);
            let jamRange = `⏰ ${formatJam(tv.start_time)} - ${formatJam(tv.end_time)}`;
            
            if(jamMain.innerText !== jamRange) jamMain.innerText = jamRange;
            if(countdown.innerText !== sisa) countdown.innerText = sisa;
            
            let htmlRincianBaru = `
                <span>Rental: Rp ${Number(tv.rental_price).toLocaleString('id-ID')}</span>
                <span>Makanan: Rp ${Number(tv.food_price || 0).toLocaleString('id-ID')}</span>
            `;
            
            if (rincian.innerHTML !== htmlRincianBaru) {
                rincian.innerHTML = htmlRincianBaru;
            }
        }
    });
}

// ==========================================
// TRANSAKSI & MODAL
// ==========================================

window.klikTV = function(id) {
    tvTerpilih = id; document.getElementById('modal-tv-id').innerText = id;
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('input-jam-mulai').value = formatter.format(getWaktuAsli()); 

    document.getElementById('pilihan-paket').innerHTML = generatePaketDropdownHTML('Pilih Paket Rental', false);
    document.getElementById('modal-rental').style.display = 'flex';
};

window.klikTVAktif = function(id) {
    tvTerpilih = id; const tv = dataTVGlobal.find(t => t.id === id);
    document.getElementById('aktif-tv-id').innerText = id;
    document.getElementById('info-status-main').innerHTML = `Status: <b>Sedang Berjalan</b>`;
    
    const paketList = tv.current_package_name ? tv.current_package_name.split('+').map(p => `<li>${p.trim()}</li>`).join('') : '<li>-</li>';
    document.getElementById('list-history-paket').innerHTML = paketList;

    const makananList = tv.food_details && tv.food_details.trim() !== "" ? tv.food_details.split('<br>').map(m => `<li>${m.replace('• ', '')}</li>`).join('') : '<li>Belum ada pesanan</li>';
    document.getElementById('list-history-makanan').innerHTML = makananList;

    document.getElementById('teks-total-aktif').innerText = `Rp ${( (tv.rental_price || 0) + (tv.food_price || 0) ).toLocaleString('id-ID')}`;

    document.getElementById('pilihan-makanan').innerHTML = generateMakananDropdownHTML();
    document.getElementById('pilihan-tambah-waktu').innerHTML = generatePaketDropdownHTML('Pilih Durasi / Tambahan', true);
    
    document.getElementById('input-qty-makanan').value = 1;
    document.getElementById('modal-aktif').style.display = 'flex';
};

window.tutupModal = () => document.getElementById('modal-rental').style.display = 'none';
window.tutupModalAktif = () => document.getElementById('modal-aktif').style.display = 'none';

window.ubahKategoriPemasukan = function() {
    const val = document.getElementById('pilihan-kategori-pemasukan').value;
    let html = '';
    if (val === 'Tukar DANA') {
        html = `
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(3000, this)">3.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(4000, this)">4.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(5000, this)">5.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(6000, this)">6.000</button>
        `;
    } else {
        html = `
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(50000, this)">50.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(100000, this)">100.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(150000, this)">150.000</button>
            <button type="button" class="btn-nominal" onclick="window.pilihNominalPemasukan(200000, this)">200.000</button>
        `;
    }
    document.getElementById('grid-nominal-pemasukan').innerHTML = html;
    document.getElementById('input-nominal-pemasukan').value = '';
};

window.bukaModalPemasukan = function() {
    const witaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('input-tgl-pemasukan').value = witaDateStr;
    document.getElementById('input-jam-pemasukan').value = formatter.format(getWaktuAsli());
    document.getElementById('pilihan-kategori-pemasukan').value = 'Tukar DANA';
    window.ubahKategoriPemasukan(); 
    document.getElementById('modal-pemasukan').style.display = 'flex';
};

window.tutupModalPemasukan = function() {
    document.getElementById('modal-pemasukan').style.display = 'none';
};

window.pilihNominalPemasukan = function(nilai, btn) {
    document.querySelectorAll('#modal-pemasukan .btn-nominal').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('input-nominal-pemasukan').value = nilai;
};

window.prosesSimpanPemasukan = async function() {
    const tgl = document.getElementById('input-tgl-pemasukan').value;
    const jam = document.getElementById('input-jam-pemasukan').value;
    const kategori = document.getElementById('pilihan-kategori-pemasukan').value;
    const nominal = parseInt(document.getElementById('input-nominal-pemasukan').value);
    if(!tgl || !jam || isNaN(nominal)) return alert("Isi nominal dengan benar!");

    const waktuTrxIso = new Date(`${tgl}T${jam}:00+08:00`).toISOString();

    try {
        await supabase.from('transactions').insert([{ 
            tv_id: 0, rental_price: 0, food_price: 0, total_price: nominal, 
            food_details: `🟢 Pemasukan Lain: ${kategori}`, start_time: null, created_at: waktuTrxIso 
        }]);
        window.tutupModalPemasukan();
        jalankanAplikasi();
        alert("Pemasukan berhasil dicatat!");
    } catch(e) {
        alert("Gagal menyimpan transaksi."); console.error(e);
    }
};

window.ubahKategoriPengeluaran = function() {
    const val = document.getElementById('pilihan-kategori-pengeluaran').value;
    const inputKet = document.getElementById('input-ket-pengeluaran');
    if(val === 'Lainnya') {
        inputKet.style.display = 'block';
        inputKet.value = '';
        inputKet.focus();
    } else {
        inputKet.style.display = 'none';
        inputKet.value = val;
    }
};

window.bukaModalPengeluaran = function() {
    const witaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('input-tgl-pengeluaran').value = witaDateStr;
    document.getElementById('input-jam-pengeluaran').value = formatter.format(getWaktuAsli());
    document.getElementById('pilihan-kategori-pengeluaran').value = 'Operasional Rental';
    window.ubahKategoriPengeluaran();
    document.getElementById('input-nominal-pengeluaran').value = '';
    document.querySelectorAll('#modal-pengeluaran .btn-nominal').forEach(b => b.classList.remove('selected'));
    document.getElementById('modal-pengeluaran').style.display = 'flex';
};

window.tutupModalPengeluaran = function() {
    document.getElementById('modal-pengeluaran').style.display = 'none';
};

window.pilihNominalPengeluaran = function(nilai, btn) {
    document.querySelectorAll('#modal-pengeluaran .btn-nominal').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('input-nominal-pengeluaran').value = nilai;
};

window.prosesSimpanPengeluaran = async function() {
    const tgl = document.getElementById('input-tgl-pengeluaran').value;
    const jam = document.getElementById('input-jam-pengeluaran').value;
    const kategori = document.getElementById('pilihan-kategori-pengeluaran').value;
    const ketManual = document.getElementById('input-ket-pengeluaran').value;
    const nominal = parseInt(document.getElementById('input-nominal-pengeluaran').value);
    
    if(!tgl || !jam || isNaN(nominal)) return alert("Isi nominal dengan benar!");
    
    let finalKet = kategori === 'Lainnya' ? ketManual : kategori;
    if(!finalKet) return alert("Harap isi keterangan pengeluaran!");

    const nominalMinus = -Math.abs(nominal); 
    const waktuTrxIso = new Date(`${tgl}T${jam}:00+08:00`).toISOString();

    try {
        await supabase.from('transactions').insert([{ 
            tv_id: 0, rental_price: 0, food_price: 0, total_price: nominalMinus, 
            food_details: `🔴 Pengeluaran: ${finalKet}`, start_time: null, created_at: waktuTrxIso 
        }]);
        window.tutupModalPengeluaran();
        jalankanAplikasi();
        alert("Pengeluaran berhasil dicatat!");
    } catch(e) {
        alert("Gagal menyimpan pengeluaran."); console.error(e);
    }
};

window.prosesRental = async function() {
    const sel = document.getElementById('pilihan-paket'); 
    const opt = sel.options[sel.selectedIndex];
    const jamInput = document.getElementById('input-jam-mulai').value;
    if (!opt.value) return alert("Pilih paket dulu!");

    const [jam, menit] = jamInput.split(':');
    const witaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const dMulai = new Date(`${witaDateStr}T${jam}:${menit}:00+08:00`);
    const mulaiIso = dMulai.toISOString(); 
    
    const durasiMenit = parseInt(opt.getAttribute('data-durasi'));
    let dSelesai = new Date(dMulai.getTime() + durasiMenit * 60000);

    const dBatasMalam = new Date(`${witaDateStr}T23:59:59+08:00`);
    if (dSelesai > dBatasMalam) dSelesai = dBatasMalam;

    const selesaiIso = dSelesai.toISOString();
    let namaPaketFormatted = opt.getAttribute('data-nama');

    delete blokirAutoCheckout[tvTerpilih];

    await supabase.from('tvs').update({ 
        is_active: true, start_time: mulaiIso, end_time: selesaiIso, 
        current_package_name: namaPaketFormatted, rental_price: parseInt(opt.getAttribute('data-harga')), 
        food_price: 0, food_details: '' 
    }).eq('id', tvTerpilih);
    
    window.tutupModal(); 
    jalankanAplikasi();
};

window.tambahWaktu = async function() {
    const tv = dataTVGlobal.find(t => t.id === tvTerpilih);
    
    if (!tv || !tv.is_active || blokirAutoCheckout[tv.id]) {
        alert("Sesi TV ini sudah berakhir dan sedang diproses sistem. Silakan mulai sesi baru.");
        return window.tutupModalAktif();
    }

    const sel = document.getElementById('pilihan-tambah-waktu');
    const opt = sel.options[sel.selectedIndex];
    if (!opt.value) return alert("Pilih paket tambahan dulu!");

    const durasiTambahMenit = parseInt(opt.getAttribute('data-durasi')); 
    const hargaTambah = parseInt(opt.getAttribute('data-harga')); 
    const namaPaketTambah = opt.getAttribute('data-nama');
    
    const hargaRentalBaru = (tv.rental_price || 0) + hargaTambah;
    const namaPaketBaru = tv.current_package_name + " + " + namaPaketTambah;

    let waktuSelesaiLama = new Date(tv.end_time);
    let waktuSekarang = getWaktuAsli(); 
    let waktuSelesaiBaru = waktuSelesaiLama > waktuSekarang ? new Date(waktuSelesaiLama.getTime() + durasiTambahMenit * 60000) : new Date(waktuSekarang.getTime() + durasiTambahMenit * 60000);

    const witaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const dBatasMalam = new Date(`${witaDateStr}T23:59:59+08:00`);
    if (waktuSelesaiBaru > dBatasMalam) waktuSelesaiBaru = dBatasMalam;

    const selesaiIsoBaru = waktuSelesaiBaru.toISOString();

    await supabase.from('tvs').update({ 
        is_active: true, end_time: selesaiIsoBaru, current_package_name: namaPaketBaru, rental_price: hargaRentalBaru 
    }).eq('id', tvTerpilih);
    
    tv.is_active = true;
    tv.end_time = selesaiIsoBaru;
    tv.current_package_name = namaPaketBaru;
    tv.rental_price = hargaRentalBaru;

    document.getElementById('list-history-paket').innerHTML = namaPaketBaru.split('+').map(p => `<li>${p.trim()}</li>`).join('');
    document.getElementById('teks-total-aktif').innerText = `Rp ${(hargaRentalBaru + (tv.food_price || 0)).toLocaleString('id-ID')}`;

    sel.selectedIndex = 0; 
    jalankanAplikasi();
};

window.tambahMakanan = async function() {
    const tv = dataTVGlobal.find(t => t.id === tvTerpilih);
    
    if (!tv || !tv.is_active || blokirAutoCheckout[tv.id]) {
        alert("Sesi TV ini sudah berakhir dan sedang diproses sistem.");
        return window.tutupModalAktif();
    }

    const sel = document.getElementById('pilihan-makanan');
    const opt = sel.options[sel.selectedIndex];
    const hrgSatuan = parseInt(opt.value);
    
    const qty = parseInt(document.getElementById('input-qty-makanan').value) || 1;
    
    if (!hrgSatuan) return alert("Pilih makanan!");
    if (qty < 1) return alert("Jumlah minimal 1!");
    
    const hrgTotalItem = hrgSatuan * qty; 
    const hargaBaru = (tv.food_price || 0) + hrgTotalItem;
    
    let formatItem = `${qty}x ${opt.getAttribute('data-nama')} (Rp ${hrgTotalItem.toLocaleString('id-ID')})`;
    let detailBaru = (tv.food_details && tv.food_details.trim() !== "") ? tv.food_details + "<br>• " + formatItem : "• " + formatItem;

    await supabase.from('tvs').update({ 
        is_active: true, food_price: hargaBaru, food_details: detailBaru 
    }).eq('id', tvTerpilih);
    
    tv.is_active = true;
    tv.food_price = hargaBaru;
    tv.food_details = detailBaru;

    document.getElementById('list-history-makanan').innerHTML = detailBaru.split('<br>').map(m => `<li>${m.replace('• ', '')}</li>`).join('');
    document.getElementById('teks-total-aktif').innerText = `Rp ${(tv.rental_price + hargaBaru).toLocaleString('id-ID')}`;

    sel.selectedIndex = 0; 
    document.getElementById('input-qty-makanan').value = 1; 
    jalankanAplikasi();
};

window.selesaiRental = async function() {
    const tv = dataTVGlobal.find(t => t.id === tvTerpilih);
    if (!tv || !tv.is_active || blokirAutoCheckout[tv.id]) return window.tutupModalAktif();
    
    if (!confirm(`Selesaikan sesi TV ${tv.id} lebih cepat dari waktu?`)) return;
    prosesCheckout(tv, false);
    window.tutupModalAktif();
};

async function prosesCheckout(tv, isAutoAlarm = false) {
    if (tvSedangDiprosesOtomatis[tv.id]) return; 
    tvSedangDiprosesOtomatis[tv.id] = true;

    blokirAutoCheckout[tv.id] = true; 
    tv.is_active = false; 

    if (isAutoAlarm) putarBunyiAlarm();

    const tot = (tv.rental_price || 0) + (tv.food_price || 0);
    try {
        // PERBAIKAN: Menangkal Efek PC Sleep / Minimize
        let waktuSelesaiIso = getWaktuAsli().toISOString();
        
        // Cek jika eksekusi ini ternyata SUDAH MELEWATI jadwal end_time (biasanya karna laptop tertidur),
        // maka paksa gunakan jadwal end_time yang seharusnya agar tidak nyasar ke jam atau hari berikutnya.
        if (tv.end_time && new Date(waktuSelesaiIso).getTime() > new Date(tv.end_time).getTime()) {
            waktuSelesaiIso = tv.end_time;
        }

        let rincianPaket = tv.current_package_name ? `<span style="color: #0284c7; font-style: normal; font-weight: 600;">🎮 ${tv.current_package_name}</span>` : '';
        let rincianMakanan = tv.food_details || '';
        let rincianGabungan = rincianPaket;
        
        if (rincianPaket && rincianMakanan) {
            rincianGabungan += '<br>' + rincianMakanan;
        } else if (!rincianPaket) {
            rincianGabungan = rincianMakanan;
        }

        const { error: errInsert } = await supabase.from('transactions').insert([{ 
            tv_id: tv.id, rental_price: tv.rental_price, food_price: tv.food_price, 
            total_price: tot, food_details: rincianGabungan, start_time: tv.start_time, created_at: waktuSelesaiIso 
        }]);

        if (errInsert) throw errInsert;
        
        await supabase.from('tvs').update({ 
            is_active: false, start_time: null, end_time: null, current_package_name: null, rental_price: 0, food_price: 0, food_details: '' 
        }).eq('id', tv.id);
    } catch(e) {
        console.error("Gagal memproses TV:", e);
        
        tv.is_active = true; 
        delete blokirAutoCheckout[tv.id]; 
    } finally {
        setTimeout(() => {
            delete tvSedangDiprosesOtomatis[tv.id];
        }, 2000);
        
        jalankanAplikasi();
        if(document.getElementById('page-laporan').classList.contains('active')){
            muatDataLaporan();
        }
    }
}

window.hapusRiwayat = async function(idTransaksi) {
    if (!confirm("Apakah Anda yakin ingin menghapus riwayat transaksi ini? Pendapatan akan otomatis berubah.")) return;
    try {
        const { error } = await supabase.from('transactions').delete().eq('id', idTransaksi);
        if (error) {
            alert("Gagal menghapus: " + error.message);
        } else {
            alert("Transaksi berhasil dihapus.");
            muatDataLaporan(); 
        }
    } catch (err) {
        alert("Terjadi kesalahan sistem saat menghapus.");
    }
};

// ==========================================
// PENGATURAN & MASTER DATA
// ==========================================

async function muatDataPengaturan() {
    const { data: paket } = await supabase.from('packages').select('*').order('price', { ascending: true });
    if (paket) {
        daftarPaket = paket;
        let htmlPaketWaktu = '';
        let htmlPaketStik = '';

        paket.forEach(p => {
            const itemHtml = `
                <div class="setting-item">
                    <span><b>${p.name}</b> (${p.duration_minutes} Mnt) - Rp ${p.price.toLocaleString('id-ID')}</span>
                    <div class="setting-aksi">
                        <button type="button" class="btn-edit btn-edit-paket" data-id="${p.id}" data-name="${p.name}" data-duration="${p.duration_minutes}" data-price="${p.price}">Edit</button>
                        <button type="button" class="btn-hapus btn-hapus-paket" data-id="${p.id}">Hapus</button>
                    </div>
                </div>`;
            
            if (p.duration_minutes === 0 || p.name.toLowerCase().includes('stick') || p.name.toLowerCase().includes('stik')) {
                htmlPaketStik += itemHtml;
            } else {
                htmlPaketWaktu += itemHtml;
            }
        });

        let finalHtmlPaket = '';
        if(htmlPaketWaktu) finalHtmlPaket += `<div style="font-weight:bold; color:#1877f2; margin-top:10px; margin-bottom:5px;">⏱️ Paket Waktu</div>${htmlPaketWaktu}`;
        if(htmlPaketStik) finalHtmlPaket += `<div style="font-weight:bold; color:#1877f2; margin-top:20px; margin-bottom:5px;">🎮 Tambahan Stick</div>${htmlPaketStik}`;

        document.getElementById('list-pengaturan-paket').innerHTML = finalHtmlPaket || '<p>Belum ada paket.</p>';
    }

    const { data: makanan } = await supabase.from('foods').select('*').order('price', { ascending: true });
    if (makanan) {
        daftarMakanan = makanan;
        let grupMinuman = [], grupGoreng = [], grupSoto = [], grupLainnya = [];
        makanan.forEach(m => {
            let namaLower = m.name.toLowerCase();
            let itemHtml = `
                <div class="setting-item">
                    <span><b>${m.name}</b> - Rp ${m.price.toLocaleString('id-ID')}</span>
                    <div class="setting-aksi">
                        <button type="button" class="btn-edit btn-edit-makanan" data-id="${m.id}" data-name="${m.name}" data-price="${m.price}">Edit</button>
                        <button type="button" class="btn-hapus btn-hapus-makanan" data-id="${m.id}">Hapus</button>
                    </div>
                </div>`;
            if (namaLower.includes('indomie goreng') || namaLower.includes('mie goreng')) grupGoreng.push(itemHtml);
            else if (namaLower.includes('indomie soto') || namaLower.includes('mie soto')) grupSoto.push(itemHtml);
            else if (namaLower.includes('air') || namaLower.includes('teh') || namaLower.includes('floridina') || namaLower.includes('kopi') || namaLower.includes('es') || namaLower.includes('minum')) grupMinuman.push(itemHtml);
            else grupLainnya.push(itemHtml);
        });

        let htmlMakananGroup = '';
        if (grupMinuman.length) htmlMakananGroup += `<div style="font-weight:bold; color:#1877f2; margin-top:10px;">🥤 Kelompok Minuman</div>` + grupMinuman.join('');
        if (grupGoreng.length) htmlMakananGroup += `<div style="font-weight:bold; color:#1877f2; margin-top:10px;">🍝 Kelompok Indomie Goreng</div>` + grupGoreng.join('');
        if (grupSoto.length) htmlMakananGroup += `<div style="font-weight:bold; color:#1877f2; margin-top:10px;">🍜 Kelompok Indomie Soto</div>` + grupSoto.join('');
        if (grupLainnya.length) htmlMakananGroup += `<div style="font-weight:bold; color:#1877f2; margin-top:10px;">🍔 Kelompok Lainnya</div>` + grupLainnya.join('');

        document.getElementById('list-pengaturan-makanan').innerHTML = htmlMakananGroup || '<p>Belum ada menu makanan.</p>';
    }

    pasangListenerPengaturan();
}

function pasangListenerPengaturan() {
    document.querySelectorAll('.btn-edit-paket').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget;
            document.getElementById('judul-modal-paket').innerText = "Edit Paket Rental";
            document.getElementById('edit-paket-id').value = b.getAttribute('data-id');
            document.getElementById('add-paket-nama').value = b.getAttribute('data-name');
            document.getElementById('add-paket-durasi').value = b.getAttribute('data-duration');
            document.getElementById('add-paket-harga').value = b.getAttribute('data-price');
            document.getElementById('modal-tambah-paket').style.display = 'flex';
        });
    });

    document.querySelectorAll('.btn-hapus-paket').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if(!confirm("Yakin ingin menghapus paket ini?")) return;
            await supabase.from('packages').delete().eq('id', id);
            muatDataPengaturan(); jalankanAplikasi();
        });
    });

    document.querySelectorAll('.btn-edit-makanan').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget;
            document.getElementById('judul-modal-makanan').innerText = "Edit Menu Makanan";
            document.getElementById('edit-makanan-id').value = b.getAttribute('data-id');
            document.getElementById('add-makanan-nama').value = b.getAttribute('data-name');
            document.getElementById('add-makanan-harga').value = b.getAttribute('data-price');
            document.getElementById('modal-tambah-makanan').style.display = 'flex';
        });
    });

    document.querySelectorAll('.btn-hapus-makanan').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if(!confirm("Yakin ingin menghapus menu makanan ini?")) return;
            await supabase.from('foods').delete().eq('id', id);
            muatDataPengaturan(); jalankanAplikasi();
        });
    });
}

document.getElementById('btn-tambah-paket-baru').addEventListener('click', () => {
    document.getElementById('judul-modal-paket').innerText = "Tambah Paket Rental";
    document.getElementById('edit-paket-id').value = "";
    document.getElementById('add-paket-nama').value = "";
    document.getElementById('add-paket-durasi').value = "";
    document.getElementById('add-paket-harga').value = "";
    document.getElementById('modal-tambah-paket').style.display = 'flex';
});

document.getElementById('btn-batal-paket').addEventListener('click', () => document.getElementById('modal-tambah-paket').style.display = 'none');
document.getElementById('btn-simpan-paket').addEventListener('click', async () => {
    const id = document.getElementById('edit-paket-id').value;
    const name = document.getElementById('add-paket-nama').value;
    const duration_minutes = parseInt(document.getElementById('add-paket-durasi').value);
    const price = parseInt(document.getElementById('add-paket-harga').value);
    if(!name || isNaN(duration_minutes) || isNaN(price)) return alert("Semua kolom harus diisi!");

    if (id) await supabase.from('packages').update({ name, duration_minutes, price }).eq('id', id);
    else await supabase.from('packages').insert([{ name, duration_minutes, price }]);

    document.getElementById('modal-tambah-paket').style.display = 'none';
    muatDataPengaturan(); jalankanAplikasi();
});

document.getElementById('btn-tambah-makanan-baru').addEventListener('click', () => {
    document.getElementById('judul-modal-makanan').innerText = "Tambah Menu Makanan";
    document.getElementById('edit-makanan-id').value = "";
    document.getElementById('add-makanan-nama').value = "";
    document.getElementById('add-makanan-harga').value = "";
    document.getElementById('modal-tambah-makanan').style.display = 'flex';
});

document.getElementById('btn-batal-makanan').addEventListener('click', () => document.getElementById('modal-tambah-makanan').style.display = 'none');
document.getElementById('btn-simpan-makanan').addEventListener('click', async () => {
    const id = document.getElementById('edit-makanan-id').value;
    const name = document.getElementById('add-makanan-nama').value;
    const price = parseInt(document.getElementById('add-makanan-harga').value);
    if(!name || isNaN(price)) return alert("Semua kolom harus diisi!");

    if (id) await supabase.from('foods').update({ name, price }).eq('id', id);
    else await supabase.from('foods').insert([{ name, price }]);

    document.getElementById('modal-tambah-makanan').style.display = 'none';
    muatDataPengaturan(); jalankanAplikasi();
});

// ==========================================
// LAPORAN & GRAFIK
// ==========================================

function renderGrafik(labelData, pointData) {
    const ctx = document.getElementById('laporanChart').getContext('2d');
    document.getElementById('box-grafik').style.display = 'block';
    if (myChartInstance) myChartInstance.destroy();
    
    const isDark = document.body.classList.contains('dark-mode');
    const fontColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelData,
            datasets: [{
                label: 'Pendapatan Bersih (Rp)',
                data: pointData,
                borderColor: '#10b981', 
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10b981',
                pointRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: fontColor }, grid: { color: gridColor } },
                y: { ticks: { color: fontColor }, grid: { color: gridColor } }
            }
        }
    });
}

async function muatDataLaporan() {
    document.getElementById('lap-total-kotor').innerText = "Memuat...";
    document.getElementById('lap-total-bersih').innerText = "Memuat...";
    document.getElementById('list-riwayat').innerHTML = '<p style="color: var(--text-muted); text-align:center;">Memuat riwayat...</p>';
    document.getElementById('box-grafik').style.display = 'none'; 
    
    if (filterAktif === 'semua') {
        const { data, error } = await supabase.rpc('get_rekap_bulanan');
        if (data) {
            renderRekapBulanan(data);
        } else if (error) {
            document.getElementById('list-riwayat').innerHTML = '<p style="color:#ef4444; text-align:center;">Gagal memuat rekap.</p>';
        }

        const { data: rawData } = await supabase.from('transactions').select('tv_id, total_price, rental_price, food_price');
        if (rawData) {
            const rekap = hitungRekapKeuangan(rawData);
            updateUIRekapKeuangan(rekap);
        }

    } else {
        let tglMulai = new Date();
        let tglAkhir = new Date();
        
        if (filterAktif === 'harian') {
            tglMulai.setHours(0,0,0,0);
            tglAkhir.setHours(23,59,59,999);
        } else if (filterAktif === 'kemarin') {
            tglMulai.setDate(tglMulai.getDate() - 1);
            tglMulai.setHours(0,0,0,0);
            tglAkhir.setDate(tglAkhir.getDate() - 1);
            tglAkhir.setHours(23,59,59,999);
        } else if (filterAktif === 'mingguan') {
            const hariIni = tglMulai.getDay(); 
            const selisihKeSabtu = (hariIni === 6) ? 0 : hariIni + 1;
            
            tglMulai.setDate(tglMulai.getDate() - selisihKeSabtu);
            tglMulai.setDate(tglMulai.getDate() + (offsetMingguan * 7));
            tglMulai.setHours(0,0,0,0);
            
            tglAkhir = new Date(tglMulai);
            tglAkhir.setDate(tglAkhir.getDate() + 6);
            tglAkhir.setHours(23,59,59,999);

            const opsiTgl = { day: 'numeric', month: 'short', year: 'numeric' };
            const labelMulai = tglMulai.toLocaleDateString('id-ID', opsiTgl);
            const labelAkhir = tglAkhir.toLocaleDateString('id-ID', opsiTgl);
            document.getElementById('label-rentang-minggu').innerText = `${labelMulai} - ${labelAkhir}`;
        } else if (filterAktif === 'bulanan') {
            tglMulai = new Date(kalenderTahunAktif, kalenderBulanAktif, 1);
            tglMulai.setHours(0,0,0,0);
            tglAkhir = new Date(kalenderTahunAktif, kalenderBulanAktif + 1, 0);
            tglAkhir.setHours(23,59,59,999);
        }

        const isoMulai = tglMulai.toISOString();
        const isoAkhir = tglAkhir.toISOString();

        const { data } = await supabase.from('transactions')
            .select('*')
            .gte('created_at', isoMulai)
            .lte('created_at', isoAkhir)
            .order('created_at', { ascending: false });

        if(data) { 
            dataTransaksi = data; 
            terapkanFilterLaporan(); 
        }
    }
}

window.ubahFilterLaporan = function(filter, btnElement) {
    filterAktif = filter;
    tanggalTerpilihKalender = null; 
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    
    const labelMap = { 
        'harian': 'Hari Ini', 
        'kemarin': 'Kemarin', 
        'mingguan': 'Mingguan', 
        'bulanan': 'Bulan & Kalender', 
        'semua': 'Semua Waktu' 
    };
    document.getElementById('label-laporan').innerText = `Total Pendapatan ${labelMap[filter]} (Bruto)`;
    
    if (filter === 'bulanan') {
        document.getElementById('box-kalender').style.display = 'block';
        document.getElementById('box-nav-mingguan').style.display = 'none';
        document.getElementById('judul-riwayat').innerText = "Pilih Tanggal di Kalender untuk Rincian";
    } else if (filter === 'mingguan') {
        document.getElementById('box-kalender').style.display = 'none';
        document.getElementById('box-nav-mingguan').style.display = 'block';
        document.getElementById('judul-riwayat').innerText = "Daftar Riwayat Transaksi";
        offsetMingguan = 0; 
    } else {
        document.getElementById('box-kalender').style.display = 'none';
        document.getElementById('box-nav-mingguan').style.display = 'none';
        document.getElementById('judul-riwayat').innerText = filter === 'semua' ? "Rekapitulasi Bulanan" : "Daftar Riwayat Transaksi";
    }

    muatDataLaporan(); 
};

window.geserMinggu = function(arah) { offsetMingguan += arah; muatDataLaporan(); };
window.geserBulan = function(arah) {
    kalenderBulanAktif += arah;
    if (kalenderBulanAktif > 11) { kalenderBulanAktif = 0; kalenderTahunAktif++; } 
    else if (kalenderBulanAktif < 0) { kalenderBulanAktif = 11; kalenderTahunAktif--; }
    tanggalTerpilihKalender = null; 
    muatDataLaporan(); 
};
window.pilihTanggalKalender = function(tanggalStr) {
    tanggalTerpilihKalender = tanggalStr; renderKalenderBulanan(); terapkanFilterLaporan(); 
};

function renderRekapBulanan(rekapData) {
    let htmlRiwayat = '';
    let chartLabels = [];
    let chartDataPoints = [];
    
    if (!rekapData || rekapData.length === 0) {
        htmlRiwayat = '<p style="color: var(--text-muted); text-align:center; margin-top:20px;">Belum ada riwayat transaksi.</p>';
    } else {
        rekapData.forEach((dataBulan, index) => {
            const [thn, blnAngka] = dataBulan.bulan.split('-');
            const namaBulanArr = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
            const namaBulanStr = `${namaBulanArr[parseInt(blnAngka)-1]} ${thn}`;

            if (index < 13) {
                chartLabels.unshift(namaBulanStr); 
                chartDataPoints.unshift(dataBulan.total_pendapatan);
            }

            htmlRiwayat += `
                <div class="item-riwayat" style="border-left: 4px solid #1877f2; background: var(--bg-card);">
                    <div class="header-riwayat" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                        <span><strong style="color: var(--text-heading); font-size: 14px;">📅 Rekap ${namaBulanArr[parseInt(blnAngka)-1]} ${thn}</strong></span>
                        <span style="color:#10b981; font-size: 14px;">Rp ${dataBulan.total_pendapatan.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="jam-riwayat" style="margin-top: 8px; color: var(--text-muted);">Total: <strong>${dataBulan.jumlah_transaksi} Transaksi</strong></div>
                    <div class="detail-uang">
                        <span>Sewa Rental: Rp ${dataBulan.total_rental.toLocaleString('id-ID')}</span>
                        <span>Makanan: Rp ${dataBulan.total_makanan.toLocaleString('id-ID')}</span>
                    </div>
                </div>`;
        });
        renderGrafik(chartLabels, chartDataPoints);
    }
    document.getElementById('list-riwayat').innerHTML = htmlRiwayat;
}

function terapkanFilterLaporan() {
    let dataDikelompokkan = {};
    let dataValidUntukDihitung = [];

    dataTransaksi.forEach(t => {
        const tglTrx = new Date(t.created_at);
        const tglTrxWITA = tglTrx.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
        
        let masukFilter = true;
        if (filterAktif === 'bulanan' && tanggalTerpilihKalender) { 
            masukFilter = (tglTrxWITA === tanggalTerpilihKalender);
        }

        if (masukFilter) {
            dataValidUntukDihitung.push(t);
            if (!dataDikelompokkan[tglTrxWITA]) dataDikelompokkan[tglTrxWITA] = [];
            dataDikelompokkan[tglTrxWITA].push(t);
        }
    });

    const rekap = hitungRekapKeuangan(dataValidUntukDihitung);
    updateUIRekapKeuangan(rekap);
    
    if (filterAktif === 'bulanan') renderKalenderBulanan();

    let htmlRiwayat = '';
    const tanggalTersortir = Object.keys(dataDikelompokkan).sort((a, b) => new Date(b) - new Date(a));

    let chartLabels = [];
    let chartDataPoints = [];

    if (tanggalTersortir.length === 0) {
        htmlRiwayat = '<p style="color: var(--text-muted); text-align:center; margin-top:20px;">Belum ada transaksi di rentang waktu/tanggal ini.</p>';
        if(myChartInstance) { myChartInstance.destroy(); document.getElementById('box-grafik').style.display = 'none'; }
    } else {
        const tanggalUntukGrafik = [...tanggalTersortir].reverse();
        tanggalUntukGrafik.forEach(tgl => {
            const d = new Date(tgl);
            chartLabels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            const totalHariIni = dataDikelompokkan[tgl].reduce((sum, item) => sum + item.total_price, 0);
            chartDataPoints.push(totalHariIni);
        });

        if(filterAktif === 'mingguan' || (filterAktif === 'bulanan' && !tanggalTerpilihKalender)) {
            renderGrafik(chartLabels, chartDataPoints);
        } else {
            if(myChartInstance) myChartInstance.destroy(); document.getElementById('box-grafik').style.display = 'none';
        }

        tanggalTersortir.forEach(tanggal => {
            const dateObj = new Date(tanggal);
            const namaHari = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Makassar' });
            
            if (filterAktif !== 'harian' && filterAktif !== 'kemarin') {
                htmlRiwayat += `<div style="background: var(--bg-hover); padding: 6px 12px; border-radius: 6px; margin: 15px 0 8px 0; font-size: 12px; font-weight: 700; color: var(--text-heading); display: inline-block;">📅 ${namaHari}</div>`;
            }

            const transaksiHariIni = dataDikelompokkan[tanggal];
            const totalTrxHariIni = transaksiHariIni.length;

            transaksiHariIni.forEach((t, index) => {
                const nomorUrut = totalTrxHariIni - index; 
                const jamSelesai = formatJam(t.created_at);
                const detailMkn = t.food_details ? `<div class="detail-makanan">${t.food_details}</div>` : '';
                
                let infoWaktuHtml = '';
                let headerLabel = '';
                let angkaWarna = '#10b981';
                let symbolUang = 'Rp';

                if (t.tv_id === 0) {
                    if (t.total_price < 0) {
                        headerLabel = `<strong style="color: #ef4444;">🔴 Kas Keluar / Pengeluaran</strong>`;
                        angkaWarna = '#ef4444';
                        symbolUang = '- Rp';
                    } else {
                        headerLabel = `<strong style="color: #10b981;">➕ Kas Masuk / Lainnya</strong>`;
                    }
                    infoWaktuHtml = `Waktu: ${jamSelesai} WITA`;
                } else {
                    const jamMulai = t.start_time ? formatJam(t.start_time) : '(Tidak tercatat)';
                    headerLabel = `📺 TV ${t.tv_id}`;
                    infoWaktuHtml = `Mulai: ${jamMulai} | Selesai: ${jamSelesai} WITA`;
                }
                
                htmlRiwayat += `
                    <div class="item-riwayat">
                        <div class="header-riwayat">
                            <span><strong style="color: #3b82f6;">#${nomorUrut}</strong> | ${headerLabel}</span>
                            <span style="color:${angkaWarna};">${symbolUang} ${Math.abs(t.total_price).toLocaleString('id-ID')}</span>
                        </div>
                        <div class="jam-riwayat">${infoWaktuHtml}</div>
                        <div class="detail-uang">
                            <span>Nominal / Rental: Rp ${t.rental_price.toLocaleString('id-ID')}</span>
                            <span>Makanan: Rp ${t.food_price.toLocaleString('id-ID')}</span>
                        </div>
                        ${detailMkn}
                        <div class="action-riwayat">
                            <button class="btn-hapus-riwayat" onclick="window.hapusRiwayat('${t.id}')">🗑️ Hapus Transaksi</button>
                        </div>
                    </div>`;
            });
        });
    }
    document.getElementById('list-riwayat').innerHTML = htmlRiwayat;
}

function renderKalenderBulanan() {
    const tahun = kalenderTahunAktif;
    const bulan = kalenderBulanAktif; 
    const namaBulanArr = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    document.getElementById('label-bulan-tahun').innerText = `${namaBulanArr[bulan]} ${tahun}`;

    let pendapatanPerHari = {};
    dataTransaksi.forEach(t => {
        let d = new Date(t.created_at);
        if (d.getFullYear() === tahun && d.getMonth() === bulan) {
            let tglKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
            pendapatanPerHari[tglKey] = (pendapatanPerHari[tglKey] || 0) + t.total_price;
        }
    });

    const hariPertama = new Date(tahun, bulan, 1).getDay();
    const jumlahHari = new Date(tahun, bulan + 1, 0).getDate();

    let kalenderHitunganHtml = '';
    for (let i = 0; i < hariPertama; i++) kalenderHitunganHtml += `<div class="kalender-sel kosong"></div>`;

    for (let hari = 1; hari <= jumlahHari; hari++) {
        let bulanStr = String(bulan + 1).padStart(2, '0');
        let hariStr = String(hari).padStart(2, '0');
        let tglFormat = `${tahun}-${bulanStr}-${hariStr}`;

        let totalHariIni = pendapatanPerHari[tglFormat] || 0;
        let adaTrxClass = totalHariIni !== 0 ? 'ada-transaksi' : '';
        let aktifClass = (tanggalTerpilihKalender === tglFormat) ? 'aktif' : '';
        let nominalFormatted = totalHariIni !== 0 ? `${(totalHariIni/1000).toFixed(0)}rb` : '';
        if(totalHariIni < 0) nominalFormatted = `<span style="color:#ef4444;">${nominalFormatted}</span>`;

        kalenderHitunganHtml += `
            <div class="kalender-sel ${adaTrxClass} ${aktifClass}" onclick="window.pilihTanggalKalender('${tglFormat}')">
                <span class="kalender-tgl">${hari}</span>
                <span class="kalender-nominal">${nominalFormatted}</span>
            </div>`;
    }
    document.getElementById('grid-tanggal-kalender').innerHTML = kalenderHitunganHtml;
}

// ==========================================
// REGISTRASI SERVICE WORKER UNTUK PWA
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Mantap bro! Service Worker berhasil didaftarkan:', registration.scope);
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Ada update aplikasi baru! Auto-refresh...');
                            window.location.reload(); 
                        }
                    });
                });
            })
            .catch(err => {
                console.log('Waduh, Service Worker gagal:', err);
            });
    });
}
