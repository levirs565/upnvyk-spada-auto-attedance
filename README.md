# UPNVYK SPADA AUTO ATTEDANCE

Bot untuk absen spada secara otomatis

## Kebutuhan

- Akun SPADA
- Akun GitHub
- Akun [cron-job.org](https://cron-job.org/en/)
- NodeJS (Disarankan versi LTS terbaru)

## Setup

- Fork repository ini (**wajib**)
- Clone repository **hasil fork**
- Buat folder baru di cron-job.org, namanya bebas
- Pergi ke [Settings Akun Github](https://github.com/settings/profile) -> Developers Settings -> Personal Access Tokens -> Fine-grained tokens. Pilih Generate New Token.

  Isi Token Name dengan `SPADA Auto Attedance Bot`

  Expiration pilih tanggal setelah semester selesai
  
  Repository Access pilih Only select repositories. Pilih repository **hasil fork**

  Pilih Add Permissions, pilih Actions

  Pastikan Access untuk Actions adalah Read and write

  Kemudian Generate Token

  Copy dan simpan token yang dihasilkan

- Buat file `.env` isinya seperti ini:

  ```text
  SPADA_USERNAME=""
  SPADA_PASSWORD=""
  GITHUB_REPOSITORY=""
  GITHUB_TOKEN=""
  CRONJOB_KEY=""
  CRONJOB_FOLDERID=""
  ```

  Isi `SPADA_USERNAME` dengan username SPADA

  Isi `SPADA_PASSWORD` dengan password SPADA

  Isi `GITHUB_REPOSITORY` dengan alamat repository **hasil fork**. Misalkan jika repository anda mempunyai alamat `https://github.com/levirs565/upnvyk-spada-auto-attedance/` maka isi `GITHUB_REPOSITORY` dengan `levirs565/upnvyk-spada-auto-attedance`

  Isi `GITHUB_TOKEN` dengan token yang dihasilkan pada tahap sebelumnya

  Isi `CRONJOB_KEY` dengan API Key dari cron-job.org. API Key bisa dilihat di Settings -> API Keys pada cron-job.org

  Isi `CRONJOB_FOLDERID` dengan ID folder cron-job.org yang baru anda buat. Untuk mendapatkan ID nya, buka folder kemudian cek alamat URL nya. Misalkan alamat URL nya `https://console.cron-job.org/jobs/folders/12323` maka `CRONJOB_FOLDERID` diisi dengan `12323`

- Jalankan perintah ini untuk menginstall dependensi:

  ```sh
  npm install
  ```

- Jalankan perintah ini di folder repository untuk mendapatkan data kursus

  ```sh
  node ./grab-courses.js
  ```
  
- Anda bisa melihat `courses.json` untuk cek apakah waktu untuk absensi sudah benar. Waktu absensi akan berada di field `timeRange`. Bot akan melakukan absensi 1 menit setelah waktu yang ditentukan.
- Jalankan perintah ini di folder repository untuk menjadwalkan waktu absensi di cron-job.org. Skrip ini agak lama karena cron-job.org memberikan batasan kecepatan pemanggilan api dalam 1 menit.

  ```sh
  node ./post-cronjob.js
  ```

- Pergi ke repository **hasil fork**
  
  - Buka Settings -> General, centang Features -> Issues

  - Buka Issues, buat issue baru

    Titlenya: `Issue to Control Attedance (Present)`

    Descriptionya:

    ```md
    State:

    - [x] Present
    - [ ] Late
    - [ ] Excused
    - [ ] Absent
    ```

  - Buka Actions, kemudian aktifkan GitHub Actions. Biasanya bertuliskan `I understand my workflows, go ahead and enable them`

  - Buka Settings -> Secrets and variables -> Actions.

    - Pastikan anda di tab Secrets. Tambahkan Repository Secrets berikut:

      Name `SPADA_USERNAME` dan secretnya username SPADA

      Name `SPADA_PASSWORD` dan secretnya password SPADA

    - Buka tab Variables.

      Buat Repository variabel baru dengan nama `CONTROL_ISSUE_ID` dan valuenya adalah ID dari issue yang anda buat tadi. Anda bisa cek dengan cara melihat URL nya. Misalkan URL-nya adalah `https://github.com/levirs565/upnvyk-spada-auto-attedance/issues/2` maka IDnya adalah 2

## Tips

Untuk memonitor bot anda dapat menginstall aplikasi Github untuk Android atau iOS. Secara default, akan muncul notifikasi saat bot error atau berhaasil.

## FAQ

- Bot tidak berjalan
  
  Ada 2 kemungkinan:

  - Pertama lihat di cron-job.org, cek apakah ada cron job yang error di folder yang anda buat.

    Jika herhubungan dengan permission, maka cek permission Personal Access Token yang anda buat. Jika sudah benar, cek `GITHUB_REPOSITORY` di `.env`

  - Jika cron-job.org baik-baik saja, cek di GitHub actions

- Saya salah mengisi `GITHUB_REPOSITORY` atau `GITHUB_TOKEN`.

  Jika anda sudah menajalankan script `post-cronjob.js`, maka hapus semua cron job di folder yang anda buat. Kemudian jalankan lagi scriptnya

