# Comment Bot Cookie Connector (MV3)

This extension captures your `rumble.com` cookies from **your own browser** and sends them to your Comment Bot app using the **Connect Token** generated in the app UI.

## Install (Chrome / Edge)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `comment-bot-mvp/browser-extension/`

## Use

1. In the app: **Account Management → Connect Rumble (Auto)** → **Generate Token**
2. In the extension popup:
   - Set **App URL** (example: `https://your-app-domain.com`)
   - Paste **Connect Token**
   - (Optional) set **Account Name**
   - Pick the correct **Cookie Store**
   - Click **Capture & Send**

If you are not logged into Rumble yet, click **Open Rumble login** from the extension popup and sign in.

## Multiple accounts (important)

If you want to connect multiple different Rumble accounts, you must ensure the extension is reading cookies from the correct browser session:

- **Best**: Use separate **Chrome Profiles** per Rumble account.
- Or: Use **Incognito**, but you must:
  1. Enable the extension in incognito (`chrome://extensions` → extension → **Allow in Incognito**)
  2. Open the extension popup from the **incognito window**
  3. Choose the incognito **Cookie Store** in the dropdown

If you don’t do this, you will likely capture the same cookies (and therefore post as the same user).

## Security notes

- The connect token is short-lived and single-use.
- Cookies are sensitive credentials. Treat them like passwords.
- For production hardening, we can encrypt cookies at rest server-side.

