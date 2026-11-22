# CMS REPORT Login Analyzer

## Overview
Self-contained web app that analyzes the login flow of the Indian Railways CMS Report system.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Web app - login form, captcha display, OpenRouter solver code |
| `api_info.txt` | Complete API/form/credential analysis from Playwright MCP |
| `README.md` | This file |

## How to Run

### Option 1: Preview in AndroPI
1. Open AndroPI app
2. Navigate to: `/workspace/cmsReport/`
3. Open `index.html`
4. Tap **Preview**

### Option 2: Run on Any Device
1. Copy the `cmsReport` folder to your device
2. Open `index.html` in any web browser
3. **Works offline** - no deployment needed

## Web App Features

1. **Login Form**: Username (BHC1748) + Password (Am@1989)
2. **Captcha Image**: Auto-loaded from cms site (refresh button available)
3. **OpenRouter Solve**: AI captcha solving code included (needs your API key)
4. **Login**: Submit credentials → proceed to OTP verification

## Captcha Loading

The captcha image loads via `` tag directly from the railway server:

```
https://cms.indianrail.gov.in/CMSREPORT/JSP/rpt/LoginAction.do?hmode=getCaptch&rand_number=<N>&random=<N>
```

If the image is blocked by CORS in your browser:
- Click the captcha image to reload
- Or open the source site in a new tab to view manually:
  https://cms.indianrail.gov.in/CMSREPORT/JSPRWD/rpt/ReportLogin.jsp

## OpenRouter AI Solver (Optional)

The code includes OpenRouter integration with **free model**:

- Model: `openrouter/free` (auto-picks free models at $0 cost)
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`

**To enable:**
1. Add your OpenRouter API key to index.html where it says `YOUR_OPENROUTER_API_KEY_HERE`
2. Click "Solve via OpenRouter" button

**Why not enabled by default?** API keys should not be exposed in client-side HTML files.

## User Credentials
- Username: BHC1748
- Password: Am@1989

## Design
- Mobile-first, fluid layouts, touch targets ≥44px
- Self-contained HTML (no external dependencies)
- Light/Dark mode support

## Generated On
2026-11-21