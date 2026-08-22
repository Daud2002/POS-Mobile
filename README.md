# TapnTrade Mobile

React Native (Expo) POS app for TapnTrade — the mobile counterpart to `Frontend/`,
talking to the same NestJS API in `Backend/`.

Covers the **cashier** (`employee`) and **store owner** (`store_owner`) roles.
The super-admin panel is intentionally **not** part of this app.

---

## Quick start

```bash
cp .env.example .env       # point EXPO_PUBLIC_API_URL at your API
npm install
npx expo prebuild --clean  # generates android/ and ios/
npx expo run:android       # or: npx expo run:ios
```

> **Expo Go will not work.** The Bluetooth printer transports are native modules,
> so this app needs a **Dev Client** build. After the first `run:android`, day-to-day
> development is just `npm start`.

### API base URL

`EXPO_PUBLIC_API_URL` must include the API's `/api` prefix.

| Where you run | Value |
|---|---|
| Android emulator | `http://10.0.2.2:3000/api` |
| iOS simulator | `http://localhost:3000/api` |
| Physical device | `http://<your-lan-ip>:3000/api` |
| Production | `https://<your-host>/api` |

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server (Dev Client) |
| `npm run android` / `npm run ios` | Launch on a device or emulator |
| `npm test` | Jest — receipt layout and order maths |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prebuild` | Regenerate the native projects |

---

## Receipt printing

The web app prints through **QZ Tray**, a Java daemon that runs on the same
Windows PC as the browser and forwards raw bytes to a named OS printer. None of
that exists on a phone — no daemon, no localhost service, no print spooler for
thermal printers.

What QZ was actually doing, though, was just piping bytes. On mobile the phone
opens a Bluetooth socket to the printer and writes the same ESC/POS bytes
directly, so **only the transport changed**; the receipt layout logic is the
same idea, done properly.

### Architecture

```
Order / Invoice from the API
        │
        ▼
receipt.template.ts          pure, no native deps, unit tested
        │  EscPosBuilder + PrinterProfile { charsPerLine, codepage, … }
        ▼
   Uint8Array (ESC/POS bytes)
        │
        ▼
  PrinterTransport           interface — src/features/printing/transports/
   ├── BluetoothClassicTransport   Android only (SPP / RFCOMM)
   ├── BleTransport                Android + iOS (GATT)
   └── MockTransport               dev — logs the receipt to the console
```

Everything above the transport is pure TypeScript, which is why the receipt can
be developed and tested with no hardware at all.

### Transport support

| Transport | Android | iOS | Typical printers |
|---|:---:|:---:|---|
| Bluetooth Classic (SPP) | ✅ | ❌ | Most cheap 58/80 mm printers — Xprinter, Goojprt, BP-80 clones |
| Bluetooth LE (GATT) | ✅ | ✅ | Newer / dual-mode printers |
| System print / PDF | ✅ | ✅ | AirPrint, Save to Files, share sheet |

**Why Classic is Android-only:** iOS cannot open an SPP socket to a non-MFi
accessory. Apple requires the printer to be MFi-certified and the app to declare
its protocol string in `UISupportedExternalAccessoryProtocols`. Generic ESC/POS
printers are not certified. The Printer Setup screen hides the option on iOS and
explains why, rather than offering a scan that cannot succeed.

On iOS with a Classic-only printer, use **Share as PDF** (`expo-print` +
`expo-sharing`) from the Order Complete screen — that reaches AirPrint and any
share target.

### Setting up a printer

1. **Bluetooth Classic:** pair the printer in the phone's system Bluetooth
   settings first — an app cannot open an SPP socket to an unpaired device.
2. In the app: **More → Settings → Printer Setup**.
3. Pick a connection type, **Scan for printers**, tap yours to connect.
4. Set **paper width** (58 mm = 32 columns, 80 mm = 48). The live preview shows
   exactly what will print.
5. **Test Print** to confirm.

The printer binding is stored **per device** in MMKV, not on the server.
`store.printerConfig` in the database holds a Windows printer name for QZ Tray
and says nothing about which physical printer a given phone is paired with.

### Testing without hardware

In development the Printer Setup screen offers a **Simulated printer**. Connect
to it and print — the full byte stream and the decoded receipt go to the console.
The **Receipt preview** panel renders the same builder output in a monospace
column at the selected width, so layout can be iterated entirely on a simulator.

```bash
npm test   # 35 tests: column alignment at 32 and 48 cols, wrapping,
           # encoding, ESC/POS command bytes, and order totals
```

### Adding a transport

Implement `PrinterTransport` (`src/features/printing/transports/types.ts`) and
register it in that folder's `index.ts`. Nothing else changes — the builder and
template never learn about it. A network transport (TCP port 9100) is the
obvious next one.

> Chunking matters. Cheap printers have small receive buffers and **silently
> drop characters** if a whole receipt is written at once. BLE writes in
> `mtu - 3` byte chunks with a 20 ms pause; Classic uses 512 bytes with 10 ms.
> Short test receipts hide this bug — always test with a 30-item sale.

---

## Project structure

```
src/
├── app/
│   ├── navigation/       RootNavigator, MainTabs (role-based), route types
│   └── providers/        AppProviders, AuthProvider, FontGate
├── api/
│   ├── client.ts         fetch wrapper: bearer token, 401 handling, timeouts
│   ├── queryKeys.ts      React Query key registry
│   ├── types.ts          DTOs mirroring the NestJS entities
│   └── services/         auth · products · categories · orders · customers …
├── features/             one folder per domain: screens/ components/ hooks/
│   ├── auth  pos  orders  products  categories  inventory
│   ├── customers  employees  dashboard  reports  settings
│   └── printing/         escpos/ templates/ transports/ pdf/ store/
├── components/
│   ├── ui/               Button Card Input Sheet Select Toast FilterPill …
│   ├── layout/           Screen, SectionHeader
│   ├── data/             StatCard, StatusPill, SectionCard, KeyValueRow
│   └── charts/           AreaChart, BarChart, DonutChart (react-native-svg)
├── theme/                color tokens, typography, spacing, ThemeProvider
├── hooks/  lib/  constants/
```

**Conventions**

- Screens compose feature components; they don't hold layout or data logic.
- `components/ui` never imports from `features/`.
- Server state is React Query; client state (cart, printer profile) is Zustand.
- All colors, spacing and type come from `useTheme()` — no hardcoded hex.
- Money from the API is `Decimal` (`number | string`) — always read it through
  `toNumber()`, because TypeORM returns Postgres decimals as strings on `/orders`.

---

## Notes on the API

- **`storeId` is not in the JWT.** It is grafted on by `GET /auth/me`, so the app
  must complete that round-trip at boot before any store-scoped screen renders.
- **`total` is client-authoritative** on `POST /orders` — the server recomputes
  `subtotal` but trusts whatever `total` it is sent. `src/lib/orderMath.ts`
  reproduces the web POS's arithmetic exactly so the two clients cannot drift;
  it is covered by tests.
- **A print failure never fails a sale.** The order is saved before the receipt
  is attempted, and a failed receipt stays reprintable from Order History.
- **Receipts are built from the invoice, not the cart**, so printed totals always
  match the database and any past order can be reprinted.

---

## Theme

Ported from the web app's CSS variables. Primary `#10B77F` (emerald), accent
`#6D54D4` (violet), 12 px radius, Space Grotesk headings over DM Sans body.

The tab bar stays dark in both themes — on web the sidebar is `#0F172A` even in
light mode, a fixed dark rail rather than a theme-following surface.

Dark mode ships from day one (Light / Dark / System in Settings). The web app has
a complete dark palette defined but never activated — nothing there ever adds the
`dark` class.
