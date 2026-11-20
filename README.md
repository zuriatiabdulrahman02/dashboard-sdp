# Dashboard Pelaporan Mingguan SDP

Dashboard interaktif pelaporan mingguan Sektor Dokumentasi Pendidikan (SDP), BPPDP, KPM bagi tempoh Ogos hingga Disember 2026.

- Halaman dihos di **GitHub Pages**.
- Data laporan disimpan dalam **Google Sheet** dan dibaca melalui **Google Apps Script**.
- Akses dilindungi dengan **kod akses SDP**. Repo ini tidak mengandungi sebarang data laporan.

## Kandungan repo

| Fail | Fungsi |
|---|---|
| `index.html` | Halaman dashboard dan skrin kod akses |
| `app.js` | Kiraan, carta, peta status, borang dan carian |
| `config.js` | URL Web App Apps Script |

> `Code.gs` dan `laporan_awal.json` **tidak** dimasukkan ke dalam repo. Kedua-dua fail tu hanya diletak dalam Google Sheet dan Google Drive.

## Langkah pemasangan

### 1. Google Sheet dan Apps Script
1. Muat naik `laporan_awal.json` ke Google Drive.
2. Cipta Google Sheet baharu, contohnya **Pelaporan Mingguan SDP 2026**.
3. Pergi ke **Extensions > Apps Script**, padam kod sedia ada, dan tampal isi `Code.gs`.
4. Tukar `KOD_AKSES` di baris atas kepada kod yang akan dikongsi dengan warga SDP. Kemudian simpan.
5. Pilih fungsi `pasangData`, klik **Run**, dan benarkan akses apabila diminta. Sheet **Laporan** akan diisi dengan 440 baris.
6. Pergi ke **Deploy > New deployment > Web app**, dan tetapkan:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Klik **Deploy**, kemudian salin **Web app URL**.

### 2. GitHub Pages
1. Buka `config.js` dan tampal URL tadi pada `SCRIPT_URL`.
2. Muat naik `index.html`, `app.js`, `config.js` dan `README.md` ke repo.
3. Pergi ke **Settings > Pages**. Pada Source, pilih **Deploy from a branch**, kemudian pilih **main** dan **/ (root)**.
4. Kongsi pautan GitHub Pages dan kod akses dengan warga SDP.

## Penggunaan
- Masukkan kod akses sekali sahaja. Pelayar akan mengingatnya sehingga pengguna klik **Keluar / tukar kod akses**.
- Klik **↻ Muat semula data** untuk melihat laporan terbaru yang dihantar oleh pegawai lain.
- Laporan yang disimpan melalui borang terus dicatat dalam Google Sheet, dalam lajur `teks`, dan `sumber` ditanda sebagai `Borang`.

## Mengemas kini kod Apps Script
Setiap kali `Code.gs` diubah, termasuk apabila kod akses ditukar, pergi ke **Deploy > Manage deployments**, klik ✏️, pilih **Version: New version**, kemudian klik **Deploy**. URL kekal sama.
