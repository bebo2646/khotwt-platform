# Bunny Stream Setup Instructions

To complete the Bunny Stream integration, you must configure your credentials in both the backend and frontend environment files. Follow these steps to configure your credentials:

---

## 1. Backend Environment Setup (`backend/.env`)

Locate the `# Video Configurations` section in `backend/.env` (and optionally `backend/.env.example`) and fill in the values:

```env
# Video Configurations
DEVELOPMENT_MODE=false
BUNNY_STREAM_LIBRARY_ID=your_library_id_here
BUNNY_STREAM_API_KEY=your_read_write_api_key_here
BUNNY_STREAM_CDN_HOSTNAME=your_pull_zone_hostname_here (e.g. video.yourdomain.com or b-xxx.bunnycdn.ru)
BUNNY_STREAM_PULL_ZONE=your_custom_pull_zone_domain_here (if separate, or same as CDN Hostname)
BUNNY_STREAM_WEBHOOK_SECRET=your_webhook_signing_key_here
```

### Where to find each credential in Bunny Dashboard:
* **Library ID**: Go to Stream ➡️ Select your Video Library ➡️ Go to **API & Webhooks** (or look at the URL `https://panel.bunny.net/stream/library/{LIBRARY_ID}/details`).
* **API Key**: Under the same **API & Webhooks** tab of your Video Library, look for the read/write API key.
* **CDN Hostname / Pull Zone**: Under the Stream Video Library dashboard, look at the hostname listed under **Pull Zones** or delivery configuration.
* **Webhook Secret**: Scroll down to the bottom of the **API & Webhooks** tab under your Video Library. Locate the **Webhook signing key**.

---

## 2. Webhook Setup on Bunny Dashboard

You need to register the webhook URL on Bunny Stream to receive video encoding updates:
1. Log in to the Bunny Panel.
2. Go to **Stream** ➡️ Click on your **Video Library** ➡️ Go to **API & Webhooks**.
3. Under **Webhooks**, click **Add Webhook**.
4. In the URL field, paste your production webhook endpoint:
   `https://yourplatform.com/api/bunny/webhook`
5. In the **Webhook signing key** field, copy the secret key and paste it as `BUNNY_STREAM_WEBHOOK_SECRET` in your `backend/.env` file.
6. Check the events you want to subscribe to (specifically **Video Finished**, **Video Encoding Failed**, etc.).

---

## 3. Frontend Environment Setup (`frontend/.env`)

Locate the end of `frontend/.env` (and optionally `frontend/.env.example`) and fill in the values:

```env
VITE_BUNNY_CDN_HOSTNAME=your_pull_zone_hostname_here (matching the backend CDN hostname/pull zone)
VITE_BUNNY_LIBRARY_ID=your_library_id_here
```

Once configured, the frontend will automatically use these variables to load the embedded video player and display dynamic thumbnails securely.
