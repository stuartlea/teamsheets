# Rugby Team Sheet Sidecar - Technical Specification

## 1. Project Overview

The Rugby Team Sheet Sidecar is a focused web application designed to transform raw selection data from Google Sheets into professional, social-media-ready team sheet graphics. It acts as a "visual layer" over the existing club management spreadsheet, allowing coaches to generate high-fidelity SVG graphics with minimal manual data entry.

## 2. Core Objectives

- **Automation**: Reduce time spent creating graphics by pulling directly from existing match sheets
- **Visual Excellence**: Provide high-definition rugby pitch background with player avatars and modern typography
- **Flexibility**: Support multiple match templates (Thirds, Quarters, Halves) as defined in the master spreadsheet
- **Engagement**: Feature "Random Player" highlight to increase social media variety

## 3. Functional Requirements

### 3.1 Data Integration (Sidecar Logic)

**Source**: Google Sheets API via Service Account

**Template Detection**:
- Read cell B1 of selected match tab to determine data range:
  - Single Match - Thirds: Extract Starters/Subs from Column AB
  - Single Match - Quarters: Extract Starters/Subs from Column H  
  - Single Match - Halves: Extract Starters/Subs from Column U

**Selection Logic**:
- Starters: Rows 5–19 (15 players) - ordered by jersey number (top to bottom)
- Finishers (Subs): Rows 20–34 (Up to 15 players) - ordered by jersey number (top to bottom)
- Player names stored in individual cells (one name per cell)

### 3.2 Visual Engine (SVG Implementation)

**Field Markings**: Accurate Rugby Union pitch markings (10m, 22m, 5m/15m dashes)

**Layering System**:
- Layer 1 (Base): Dark emerald gradient pitch texture
- Layer 2 (Avatars): Circular clipping masks for player headshots
- Layer 3 (Data): Dynamic text overlays for names and match info

**Asset Mapping**: Automated mapping of player names to local images (e.g., "Aidan Humphreys" -> aidan-humphreys.png). Fallback: Player silhouette avatar when image not available.

### 3.3 User Controls

- **Match Selector**: Dropdown populated by tab names in Google Workbook
- **Metadata Overrides**: Manual input fields for Kick-off, Meet Time, Location, Custom Title
- **Featured Player**: Manual selection by coaches from starting 15 for hero-sized highlight

## 4. Technical Architecture

### 4.1 Technology Stack

**Backend (Python)**:
- Runtime: Python 3.11+
- Web Framework: Flask (preferred for simplicity with internal tools)
- Google Integration: gspread library + google-auth for Service Account credentials
- Image Management: Pillow (PIL) for optional server-side resizing

**Frontend (Modern Interactive UI)**:
- Framework: React 18+
- Styling: Tailwind CSS for rapid UI building and responsive layout
- Icons: Lucide-React for consistent interface iconography
- State Management: React Hooks (useState, useEffect) for match metadata and live preview

**Graphics & Export**:
- Rendering: Native SVG (Scalable Vector Graphics)
- Export Library: html-to-image (client-side) for instant PNG download
- Output: High-resolution PNG optimized for social media

### 4.2 Data Flow & Authentication

**Authentication**:
- Uses .json credentials file from Google Cloud Console
- Google Sheet must be shared with Service Account email

**Fetch Cycle**:
1. App requests list of worksheets (tabs)
2. User selects tab; App fetches cell B1
3. App applies logic to fetch specific column (H, U, or AB)
4. Asset lookup in static/players/ for slugified player names

### 4.3 Infrastructure & Deployment

**Environment**: Containerized using Docker for local development and production deployment

**Web Server**: Gunicorn (Python WSGI) behind Nginx reverse proxy

**Storage**:
- Primary Data: Google Sheets (no local database required)
- Assets: Local directory mount for /static/players

## 5. Directory Structure

```
/rugby-sidecar
├── app.py                  # Main Flask entry point
├── services/
│   └── sheets_service.py   # gspread logic & B1 template mapping
├── credentials.json        # Google Cloud Service Account Key
├── /static
│   ├── /players            # Headshots (aidan-humphreys.png)
│   ├── /pitch-assets       # Textures & SVG base templates
│   └── /css                # Compiled Tailwind styles
└── /templates
    └── index.html          # React entry point & SVG Container
```

## 6. Design Specifications

### 6.1 Color Palette
- Primary Green: #064e3b (Deep Emerald)
- Accent Green: #10b981 (Vibrant Mint)
- Text: #FFFFFF (White) / #94a3b8 (Slate Gray)
- Pitch Lines: rgba(255, 255, 255, 0.25)

### 6.2 Image Specifications
- Output: 4:5 Aspect Ratio (1080px x 1350px) - Instagram/WhatsApp optimized, high-resolution PNG
- Player Avatars: 1:1 Square (circular clip via SVG)
- Fallback: Player silhouette for missing headshots

## 7. Development Roadmap

### V1.1
- Add "Player of the Match" badge to specific players

### V1.2
- Integration with "Player Image Upload" portal

### V2.0
- Multi-match support (generating 1st, 2nd, 3rd team sheets simultaneously)

### V2.1
- Automated "Meet" location link via Google Maps API

## 8. Key Implementation Notes

- **Template Detection Logic**: Critical for correct column mapping based on B1 cell content
- **Asset Naming Convention**: Player images must follow slugified naming pattern
- **Fallback Assets**: Player silhouette must be included for missing headshots
- **SVG Layering**: Proper z-index management for pitch, avatars, and text overlays
- **Export Performance**: Client-side PNG export recommended to reduce server load
- **Authentication Security**: Service account credentials must be properly secured
- **Docker Deployment**: Container-based deployment for consistent environments

## 9. Success Metrics

- Reduction in graphic creation time (target: <2 minutes per sheet)
- Increase in social media posting frequency
- User adoption rate among coaching staff
- Graphic quality consistency across matches
