# Tesla VIN Dekódoló

Egyfájlos, függőség nélküli **Tesla VIN dekódoló**, immár **telepíthető webappként (PWA)** és **kamerás VIN-beolvasással**.

🔗 **Élő app:** https://vrbst.github.io/tesla-vin-decoder/

## Mit tud

- A 17 jegyű Tesla VIN dekódolása: gyártó/régió, modell, karosszéria, üléskonfiguráció, akku/töltés, meghajtás, évjárat, gyár, sorszám.
- **ISO 3779 ellenőrzőszámjegy** valós idejű validálása (érvényes / elgépelt / hamis VIN).
- Felismert felszereltség (trim) megjelenítése (pl. *Model 3 Performance*).
- **HU / EN / DE** nyelv, böngészőnyelv-felismeréssel és megjegyzett választással.
- **📷 Kamerás beolvasás:**
  - **Vonalkód** – az ajtóoszlop-matrica / szélvédő alatti Code 39/128 kódot a böngésző beépített `BarcodeDetector` API-jával olvassa (automatikus).
  - **OCR** – a maratott/nyomtatott VIN szövegét `Tesseract.js`-szel ismeri fel (gombnyomásra).
  - Minden beolvasott jelöltet az **ellenőrzőszámjegy** igazol, mielőtt elfogadná.
- **Offline** működés és **kezdőképernyőre telepíthetőség** (manifest + service worker + ikonok).

## Telepítés telefonra (Android)

1. Nyisd meg az **élő app** linkjét Chrome-ban.
2. Menü (⋮) → **Alkalmazás telepítése** / *Hozzáadás a kezdőképernyőhöz*.
3. Az ikonról indítva teljes képernyős appként fut, internet nélkül is.

> A kamera **HTTPS-t** igényel — `file://`-ből megnyitva nem indul. GitHub Pages-en (https) működik.

## Helyi futtatás / fejlesztés

A kamera miatt HTTPS vagy `localhost` kell. Egyszerű helyi szerver:

```bash
# a tesla_vin mappában
npx serve .          # majd nyisd meg: http://localhost:3000
# vagy
python -m http.server 8000
```

Telefonon való teszthez `localhost` nem elég (a telefon nem azt látja) — vagy telepítsd GitHub Pages-re, vagy használj HTTPS-tunnelt (pl. `ngrok`, Cloudflare Tunnel).

## Ikonok újragenerálása

Az ikonok a Tesla-emblémából, függőség nélkül készülnek:

```bash
node tools/gen_icons.js ./icons
```

## Fájlok

| Fájl | Szerep |
|------|--------|
| `index.html` | A teljes app (UI + dekóder + scanner) |
| `manifest.webmanifest` | PWA-metaadatok |
| `sw.js` | Service worker (offline cache) |
| `icons/` | PWA-ikonok (192, 512, maskable) |
| `tools/gen_icons.js` | Ikon-generátor |
| `tesla_vin_decoder_v3.html` | Eredeti, egyfájlos változat (archív) |

## Megjegyzés

A VIN-dekódolás Tesla-specifikus, nyilvános minták alapján készült, **legjobb tudás szerinti** közelítés — egyes mezők (pl. pontos akkukémia, altípus) a VIN-ből nem mindig egyértelműek. A `carVertical` gomb affiliate-linkre mutat (a `CARVERTICAL_REFERRAL_URL` az `index.html`-ben állítható).
