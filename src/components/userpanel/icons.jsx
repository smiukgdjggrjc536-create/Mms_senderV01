// ============================================================================
// V7 P9.5 — Shared icon set (ONE consistent stroke-style icon set)
// ----------------------------------------------------------------------------
// Extracted behavior-preservingly from UserPanel.jsx's inline `Icon` object —
// the SVG paths are byte-identical, so existing components render exactly the
// same. New P9 icons (Command, Sparkline, FuelGauge, Wand, Sliders, Beaker,
// Export, Heart, Megaphone, LifeBuoy, TrendUp, Dot, Rocket2) are added in the
// SAME stroke style (fill="none", stroke="currentColor", strokeWidth=2,
// round caps/joins) so the whole app has one visual language (P9.5).
//
// Mirror of Accounts 1-2 STYLE LOG: ESM only, small modular file, camelCase.
// ============================================================================

const _svg = (children) => (p) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{children}</svg>
);

const Icon = {
  // ── Original set (byte-identical to UserPanel.jsx) ───────────────────────
  Send: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />),
  Dashboard: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 9a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-3a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" />),
  Report: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />),
  Info: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />),
  Sms: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" />),
  Chat: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />),
  Close: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />),
  Send2: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />),
  Eye: _svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>),
  EyeOff: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />),
  User: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />),
  Lock: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />),
  Alert: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />),
  Check: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />),
  Sparkle: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />),
  Phone: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />),
  Mail: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />),
  Whatsapp: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />),
  Logout: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />),
  Refresh: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />),
  Clock: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />),
  Globe: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />),
  Inbox: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />),
  Shield: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />),
  Bolt: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />),
  Activity: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />),
  Upload: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />),
  Trash: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />),
  Plus: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />),
  Menu: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />),
  Target: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />),
  Layers: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />),
  CheckCircle: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />),
  XCircle: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />),
  Pause: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />),
  Calendar: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />),
  Users: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />),
  Tag: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />),
  FilePdf: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />),
  Image: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />),
  Stop: _svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" /></>),
  Copy: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />),
  Download: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />),
  FileCode: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />),
  Palette: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h8a4 4 0 004-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v4m4 12a4 4 0 01-4-4V9m8 12a4 4 0 004-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v4" />),
  RotateCcw: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" transform="scale(-1,1) translate(-24,0)" />),
  Bounce: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-6-6l1.586-1.586a2 2 0 012.828 0L20 14M3 10l3 3m15-3l-3 3M12 20v-6" />),
  List: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />),
  Play: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M14.752 4.036l-8.5 5.5A1 1 0 005.5 10.5v3a1 1 0 001.252.964l8.5-5.5A1 1 0 0015.5 8v-3a1 1 0 00-1.248-.964z" />),
  Rocket: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.84 2.58m-.119-8.54a7.5 7.5 0 01-3.046 5.634L4.042 18.66l.469-3.461A7.5 7.5 0 0110.5 9.75m-2.25 4.5h.008v.008h-.008v-.008z" />),
  Clipboard: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />),
  Save: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />),
  Zap: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />),
  Bell: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />),
  Flag: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />),
  Star: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />),
  Key: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 7v10m-3-7l3 3 3-3" />),
  Link: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />),
  Reply: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />),
  ChevronLeft: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />),
  ChevronRight: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />),
  Gear: _svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>),
  Edit: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />),
  DocText: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />),
  Folder: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />),
  Settings: _svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>),
  Hash: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h16M4 15h16" />),
  Gauge: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1118 0M3 12h2m14 0h2M12 3v2m0 14v2m-6.364-6.364l1.414 1.414m9.9-9.9l1.414 1.414M12 12l3-3" />),
  AlertTriangle: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-7.36 3.45A2 2 0 016.92 20h10.16a2 2 0 001.79-1.05l7.36-13a2 2 0 00-1.79-2.95H4.57a2 2 0 00-1.79 2.95l7.36 13z" transform="translate(0, -1)" />),

  // ── NEW P9 icons (same stroke style) ─────────────────────────────────────
  // Command palette (P9.6) — a terminal/command glyph
  Command: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6 9a3 3 0 11-3-3h15a3 3 0 11-3 3M6 9v6a3 3 0 003 3M18 9a3 3 0 00-3 3v3a3 3 0 003 3M9 21a3 3 0 11-3-3M15 21a3 3 0 113-3" />),
  // Sparkline / send-rate trend (P9.1, P9.2)
  Sparkline: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-6 4 3 5-8 4 5" />),
  // Fuel gauge — AI pool level (P9.2)
  FuelGauge: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 110-18m0 18a9 9 0 009-9H3m9 9c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3 12h18" />),
  // AI wand — Composure Coach rewrite (P9.1)
  Wand: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4m6 6v4m-2-2h4m-6 8l9-9-3-3-9 9 3 3zM15 5l4 4" />),
  // Sliders — throttle / rate dial (P9.3)
  Sliders: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M5 4v3m0 0a1 1 0 001 1h3m-4 0a1 1 0 00-1 1v3m14-5v3m0 0a1 1 0 01-1 1h-3m4 0a1 1 0 011 1v3M5 21v-3m0 0a1 1 0 011-1h3m-4 0a1 1 0 00-1-1v-3" />),
  // Beaker — Body Lab A/B (P9.1)
  Beaker: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.171.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l1.028 1.028c.65.65.19 1.762-.728 1.762H4.9c-.918 0-1.378-1.112-.728-1.762L5 14.5m14.8.8l-1.028-1.028M5 14.5l1.028-1.028M12 21h.008" />),
  // Export / CSV (P9.4)
  Export: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3M12 3v12m0-12l-4 4m4-4l4 4" />),
  // Heart — empty-state personality (P9.5)
  Heart: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />),
  // Megaphone — launch / broadcast (P9.3)
  Megaphone: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.838.21 1.7.33 2.58.33 3.866 0 7-2.243 7-5 0-2.757-3.134-5-7-5-1.08 0-2.12.14-3.08.4m4.58 9.6a8.5 8.5 0 003.08-.4M3 12.5h3.75m3.75 0h.75M3 9.5h.75m.75 0h3.75m-3.75 0L5.25 18m9-8.5h.75M14.25 9.5h3.75M14.25 9.5L16.5 6" />),
  // LifeBuoy — trust / help (P9.7)
  LifeBuoy: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.985c.122.19.214.4.272.622.211.713.5 1.39.86 2.027M19 9c0-3.866-3.134-7-7-7S5 5.134 5 9s3.134 7 7 7 7-3.134 7-7zm-7 3a3 3 0 100-6 3 3 0 000 6z" />),
  // TrendUp — engagement tier (P9.1)
  TrendUp: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18l9-9 3 3 7.5-7.5M21 4.5h-6m6 0v6" />),
  // Dot — status indicator (P9.4)
  Dot: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0" />),
  // Search — command palette search (P9.6)
  Search: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />),
  // Layers2 — sandbox tabs (P9)
  Layers2: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />),
  // Filter — delivery drill-down (P9.4)
  Filter: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18l-7 9v6l-4 2v-8L3 4.5z" />),
  // Database — credential health (P9.4)
  Database: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />),
  // ThumbsUp — verdict badge (P9.3)
  ThumbsUp: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.023 0 1.75.894 1.523 1.885-.295 1.233-.793 2.694-1.523 3.936-.296.495-.66.916-1.016 1.302M6.633 10.5H4.5a2.25 2.25 0 00-2.25 2.25v3.75A2.25 2.25 0 004.5 18.75h2.25m.75-8.25v8.25m0-8.25H9.75" />),
  // LockShield — trust score (P9.7)
  LockShield: _svg(<path strokeLinecap="round" strokeLinejoin="round" d="M11.998 2.5L4.5 5.25v5.5c0 4.5 3 7.5 7.498 9 4.498-1.5 7.498-4.5 7.498-9v-5.5L11.998 2.5zM12 8.25a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-3 0V9.75a1.5 1.5 0 011.5-1.5zm0 0v-1.5" />),
};

export default Icon;
