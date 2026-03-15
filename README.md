# 🎙️ NexzLabs: Professional AI Narration Suite (v1.4)

An enterprise-grade open-source Chrome Extension designed for high-performance AI voice-over generation using the **ElevenLabs** infrastructure via **ai33.pro API**.

## 🚀 Key Features
- **Full Library Access:** Access 485+ voices (personal, community, and workspace).
- **Batch Processing:** v1.4 includes a dedicated batch generation engine with live progress monitoring.
- **Smart Persistence:** Every setting (API Keys, selected voices, custom prefixes) is auto-saved via `chrome.storage.local`.
- **Advanced UI:** Modern, dark-mode ready interface with real-time search, filtering by language/gender, and voice previews.

## 🛠 Technical Architecture
- **Manifest V3:** Fully compliant with modern Chrome security standards.
- **Service Workers:** Uses `background.js` with a keep-alive mechanism for long-running batch processes.
- **API Strategy:** Multi-strategy fetching with smart pagination to handle large voice libraries without lag.

## 📂 Installation
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" and click "Load unpacked".
4. Select the project folder.

## 📈 Open Source Mission
NexzLabs is built to empower content creators and educators by providing professional-grade automation tools for free. We believe in high-fidelity audio accessible to everyone.
