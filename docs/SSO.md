# Dokumentasi SSO FAST USTEDI

Situs FAST USTEDI menggunakan satu sesi login (Single Sign-On) untuk portal, berita, blog, PMB, academy, dan panel admin.

## Provider yang tersedia

| Provider | Status | Konfigurasi |
|---|---|---|
| Google Identity Services | opsional | `sso.googleClientId` di `assets/js/config.js` |
| GitHub OAuth | opsional | `sso.githubClientId` + Netlify Function |
| Mode demo | aktif saat pengembangan | `sso.allowDemo` |

Jika `googleClientId` dan `githubClientId` kosong, situs berjalan dalam **mode demo**. Login demo memakai email yang terdaftar di `data/users.json`.

## Peran pengguna

| Peran | Akses |
|---|---|
| `admin` | Seluruh modul, termasuk panel admin |
| `berita` | Berita dan blog |
| `pmb` | PMB |
| `academy` | Academy |
| `viewer` | Portal |

Peran disimpan di `data/users.json` dengan kunci alamat email:

```json
{
  "admin@ustedi.ac.id": ["admin"],
  "editor@ustedi.ac.id": ["berita", "blog"]
}
```

> Berkas ini hanya memuat alamat email dan peran. Jangan pernah menaruh kata sandi atau token di `data/users.json`.

## Menambahkan Google SSO

1. Buka Google Cloud Console → **APIs & Services → Credentials**.
2. Buat **OAuth client ID** tipe *Web application*.
3. Tambahkan authorized JavaScript origin: `https://fastustedi.web.id` (dan `http://localhost:8080` untuk pengembangan).
4. Salin Client ID ke `assets/js/config.js`:

```js
sso: {
  googleClientId: "1234567890-abc.apps.googleusercontent.com",
  ...
}
```

## Menambahkan GitHub OAuth

1. Buat GitHub OAuth App.
2. Callback URL: `https://fastustedi.web.id/auth/callback.html`.
3. Isi `sso.githubClientId` di `config.js`.
4. Deploy Netlify Function `/.netlify/functions/oauth` dengan `GITHUB_CLIENT_ID` dan `GITHUB_CLIENT_SECRET`.

## Catatan keamanan

- Sesi disimpan di `localStorage` dengan masa berlaku sesuai `sso.sessionMinutes`.
- Panel admin memiliki lapisan login tersendiri (username + password) dan sesi terpisah selama 2 jam.
- Autentikasi panel admin berjalan di sisi klien karena situs ini statis. Untuk keamanan tingkat produksi yang lebih kuat, gunakan backend autentikasi (Netlify Identity, Auth0, atau serverless function) dan simpan konten di basis data.
