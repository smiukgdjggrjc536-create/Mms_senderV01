'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { COUNTRY_SUPPORT, getCountryStats } from '@/lib/countrySupport';

// ================================================================
// Icon set (professional SVG, NO emoji in chrome — emoji only for flags)
// ================================================================
const Icon = {
  Send: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Dashboard: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 9a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-3a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" /></svg>,
  Report: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Info: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Chat: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  Close: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  Send2: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Eye: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  User: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Lock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Alert: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  Sparkle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Phone: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Mail: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Whatsapp: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Logout: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Refresh: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Clock: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Globe: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Inbox: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" /></svg>,
  Shield: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Bolt: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Activity: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Upload: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Trash: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  Menu: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Target: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Layers: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  CheckCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  XCircle: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Pause: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Calendar: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Users: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Tag: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  FilePdf: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Image: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Stop: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" /></svg>,
  Copy: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Download: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  FileCode: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Palette: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h8a4 4 0 004-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v4m4 12a4 4 0 01-4-4V9m8 12a4 4 0 004-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v4" /></svg>,
  RotateCcw: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" transform="scale(-1,1) translate(-24,0)" /></svg>,
  Bounce: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-6-6l1.586-1.586a2 2 0 012.828 0L20 14M3 10l3 3m15-3l-3 3M12 20v-6" /></svg>,
  List: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Play: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 4.036l-8.5 5.5A1 1 0 005.5 10.5v3a1 1 0 001.252.964l8.5-5.5A1 1 0 0015.5 8v-3a1 1 0 00-1.248-.964z" /></svg>,
  Save: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Zap: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Bell: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Flag: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
  Star: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  Key: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM12 7v10m-3-7l3 3 3-3" /></svg>,
  Link: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Reply: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  ChevronLeft: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>,
  ChevronRight: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>,
};

// ================================================================
// Main export
// ================================================================
export default function UserPanel({ mode, user, onLoginSuccess, onLogout, onRefresh }) {
  if (mode === 'login') {
    return <UserLogin onLoginSuccess={onLoginSuccess} />;
  }
  return <UserDashboard user={user} onLogout={onLogout} onRefresh={onRefresh} />;
}

// ================================================================
// Spinner / Loading
// ================================================================
function Spinner({ size = 16 }) {
  return (
    <div
      className="border-2 border-white/30 border-t-white rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// ================================================================
// USER LOGIN — 5x enterprise polish: animated gradient, glass card, branding
// ================================================================
function UserLogin({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getAppSettings' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) setSettings(data.settings);
        }
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanId = loginId.trim();
    if (!cleanId || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', loginId: cleanId, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Login failed. Check your credentials.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const platformName = settings?.platformName || 'Gmail Mailer';
  const countryStats = getCountryStats();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-purple-900/30">
          {/* Logo + branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30 mb-4 overflow-hidden">
              {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-10 h-10 text-white" />}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{platformName}</h1>
            <p className="text-sm text-gray-400 mt-1">{settings?.description || 'Enterprise Gmail Email Sending Module'}</p>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mb-6 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Icon.Shield className="w-3.5 h-3.5 text-green-400" /> Spam-Free</span>
            <span className="flex items-center gap-1"><Icon.Mail className="w-3.5 h-3.5 text-blue-400" /> Any Email Domain</span>
            <span className="flex items-center gap-1"><Icon.Bolt className="w-3.5 h-3.5 text-purple-400" /> AI-Powered</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <Icon.User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Icon.Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <Icon.EyeOff className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                <Icon.Alert className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
            >
              {loading ? <><Spinner /> Signing in…</> : <><Icon.Lock className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          {/* Contact footer */}
          {(settings?.whatsapp || settings?.email || settings?.phone) && (
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-4 text-xs">
              {settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-green-400 hover:text-green-300"><Icon.Whatsapp className="w-4 h-4" /> WhatsApp</a>}
              {settings?.email && <a href={`mailto:${settings.email}`} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"><Icon.Mail className="w-4 h-4" /> Email</a>}
              {settings?.phone && <span className="flex items-center gap-1 text-blue-400"><Icon.Phone className="w-4 h-4" /> {settings.phone}</span>}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">© {new Date().getFullYear()} {platformName}. All rights reserved.</p>
      </div>
    </div>
  );
}

// ================================================================
// Toast hook
// ================================================================
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ================================================================
// Reusable UI: StatCard, ProgressBar, TabBtn
// ================================================================
function StatCard({ icon: I, label, value, sub, color = 'purple', trend }) {
  const colors = {
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-300',
    green: 'from-green-500/20 to-green-600/5 border-green-500/20 text-green-300',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-300',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-300',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-300',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 transition hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center`}>
          <I className={`w-5 h-5 ${colors[color].split(' ').pop()}`} />
        </div>
        {trend && <span className="text-xs text-gray-500">{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = 'green' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colors = { green: 'from-green-500 to-emerald-500', purple: 'from-purple-500 to-indigo-500', blue: 'from-blue-500 to-cyan-500', red: 'from-red-500 to-orange-500', amber: 'from-amber-500 to-yellow-500' };
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div className={`bg-gradient-to-r ${colors[color]} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TabBtn({ icon: I, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full relative ${
        active
          ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 text-white shadow-lg border border-purple-500/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <I className={`w-5 h-5 flex-shrink-0 ${active ? 'text-purple-300' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{badge}</span>}
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-r-full" />}
    </button>
  );
}

// ================================================================
// USER DASHBOARD — 5x polished shell: glass sidebar, live header, theme
// ================================================================
function UserDashboard({ user, onLogout, onRefresh }) {
  const { toast, show } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [deliveryReports, setDeliveryReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Live clock
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, campRes, tmplRes, setRes] = await Promise.all([
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getUserDashboard' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getUserCampaigns' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getTemplates' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getAppSettings' }) }),
      ]);
      const dash = await dashRes.json();
      if (dash.success) setStats(dash);
      const camp = await campRes.json();
      if (camp.campaigns) setCampaigns(camp.campaigns);
      const tmpl = await tmplRes.json();
      if (tmpl.templates) setTemplates(tmpl.templates.filter(t => t.isActive));
      const set = await setRes.json();
      if (set.settings) setSettings(set.settings);
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const fetchDeliveryReports = useCallback(async (campaignId) => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'getDeliveryReports', campaignId }),
      });
      const data = await res.json();
      if (data.reports) setDeliveryReports(data.reports);
    } catch {}
  }, []);

  const platformName = settings?.platformName || 'Gmail Mailer';
  const logoUrl = settings?.logoUrl || '';
  const language = settings?.language || 'en';

  const tabs = [
    { k: 'dashboard', l: 'Dashboard', I: Icon.Dashboard },
    { k: 'send', l: 'Send Email', I: Icon.Send },
    { k: 'countries', l: 'Deliverability', I: Icon.Shield },
    { k: 'inbox', l: 'Inbox & Auto-Reply', I: Icon.Inbox },
    { k: 'reports', l: 'Reports', I: Icon.Report },
    { k: 'info', l: 'App Info', I: Icon.Info },
  ];

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[150px]" />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2.5 backdrop-blur-xl border animate-[slideDown_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-green-600/90 border-green-400/30 text-white' :
          toast.type === 'error' ? 'bg-red-600/90 border-red-400/30 text-white' :
          'bg-indigo-600/90 border-indigo-400/30 text-white'
        }`}>
          {toast.type === 'success' ? <Icon.CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <Icon.XCircle className="w-5 h-5" /> : <Icon.Info className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      <div className="flex relative z-10">
        {/* Sidebar — desktop (collapsible) */}
        <aside className={`bg-slate-900/60 backdrop-blur-xl border-r border-white/5 p-4 hidden lg:flex flex-col gap-1.5 fixed top-0 left-0 bottom-0 transition-all duration-300 z-30 ${sidebarCollapsed ? 'w-0 p-0 overflow-hidden border-r-0' : 'w-64'}`}>
          <div className={`flex items-center gap-3 px-2 py-4 mb-2 ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20 flex-shrink-0">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-6 h-6 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{platformName}</div>
              <div className="text-[10px] text-purple-400/70 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> User Panel</div>
            </div>
          </div>

          {tabs.map(({ k, l, I }) => (
            <TabBtn key={k} icon={I} label={l} active={activeTab === k} onClick={() => setActiveTab(k)} />
          ))}

          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1.5">
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh Data
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
            >
              <Icon.Logout className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Sidebar collapse/expand toggle button (desktop) */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 w-6 h-12 items-center justify-center bg-slate-800/90 hover:bg-violet-600 border border-white/10 text-gray-300 hover:text-white rounded-r-lg transition-all duration-300 shadow-lg ${sidebarCollapsed ? 'left-0' : 'left-64'}`}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <Icon.ChevronRight className="w-4 h-4" /> : <Icon.ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 p-4 z-50 lg:hidden flex flex-col gap-1.5 animate-[slideIn_0.2s_ease-out]">
              <div className="flex items-center justify-between px-2 py-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                    {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-5 h-5 text-white" />}
                  </div>
                  <span className="text-sm font-bold text-white truncate">{platformName}</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400"><Icon.Close className="w-5 h-5" /></button>
              </div>
              {tabs.map(({ k, l, I }) => (
                <TabBtn key={k} icon={I} label={l} active={activeTab === k} onClick={() => { setActiveTab(k); setSidebarOpen(false); }} />
              ))}
              <div className="mt-auto pt-4 border-t border-white/5">
                <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition w-full">
                  <Icon.Logout className="w-4 h-4" /> Logout
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-300"><Icon.Menu className="w-6 h-6" /></button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-4 h-4 text-white" />}
              </div>
              <span className="text-sm font-bold text-white truncate max-w-[140px]">{platformName}</span>
            </div>
          </div>
          <button onClick={onLogout} className="text-red-400"><Icon.Logout className="w-5 h-5" /></button>
        </div>

        {/* Main content */}
        <main className={`flex-1 p-4 sm:p-5 lg:p-6 mt-16 lg:mt-0 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-64'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'send' && 'Send Email Campaign'}
                {activeTab === 'countries' && 'Deliverability'}
                {activeTab === 'inbox' && 'Inbox & Auto-Reply'}
                {activeTab === 'reports' && 'Delivery Reports'}
                {activeTab === 'info' && 'App Information'}
              </h1>
              <p className="text-gray-400 text-xs mt-1">
                Welcome, <span className="text-purple-300 font-medium">{stats?.loginId || user?.loginId || stats?.email || user?.email}</span> · <span className="text-gray-500">{new Date(now).toLocaleString()}</span>
              </p>
            </div>
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition text-xs"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh
            </button>
          </div>

          {/* Mobile tab bar */}
          <div className="lg:hidden flex gap-1.5 mb-4 overflow-x-auto pb-2">
            {tabs.map(({ k, l, I }) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  activeTab === k ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white/5 text-gray-400'
                }`}
              >
                <I className="w-4 h-4" /> {l}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={loadingStats} now={now} language={language} />}
            {activeTab === 'send' && (
              <>
                <SendTab
                  stats={stats}
                  templates={templates}
                  campaigns={campaigns}
                  onSent={(msg, type) => { show(msg, type); fetchAll(); }}
                  onCampaignClick={fetchDeliveryReports}
                  language={language}
                />
                <ScheduledSection language={language} onToast={show} />
              </>
            )}
            {activeTab === 'countries' && <CountrySupportTab />}
            {activeTab === 'reports' && <ReportsTab campaigns={campaigns} deliveryReports={deliveryReports} onCampaignClick={fetchDeliveryReports} />}
            {activeTab === 'inbox' && <InboxAutoReplyTab language={language} onToast={show} loginId={stats?.loginId || user?.loginId} />}
            {activeTab === 'info' && <InfoTab settings={settings} />}
          </div>
        </main>
      </div>

      <AIChatPopup language={language} />

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ================================================================
// DASHBOARD TAB — live stats, quota ring, country showcase
// ================================================================
function DashboardTab({ stats, loading, now, language }) {
  const countryStats = getCountryStats();

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  const sent = stats.sent || 0;
  const limit = stats.limit || 0;
  const remaining = Math.max(limit - sent, 0);
  const usagePct = limit > 0 ? Math.round((sent / limit) * 100) : 0;
  const expiry = stats.expiry;
  const expiryMs = expiry ? new Date(expiry).getTime() - now : null;
  const expired = expiryMs !== null && expiryMs <= 0;
  const daysLeft = expiryMs !== null ? Math.floor(expiryMs / (1000 * 60 * 60 * 24)) : null;
  const hoursLeft = expiryMs !== null ? Math.floor(expiryMs / (1000 * 60 * 60)) : null;
  const todaySent = stats.todaySent || 0;
  const todayDelivered = stats.todayDelivered || 0;
  const deliveryRate = todaySent > 0 ? Math.round((todayDelivered / todaySent) * 100) : 0;

  // Quota ring (SVG circular gauge)
  const RingSize = 140;
  const ringR = (RingSize - 16) / 2;
  const ringC = 2 * Math.PI * ringR;
  const ringDash = (usagePct / 100) * ringC;
  const ringColor = usagePct > 80 ? '#ef4444' : usagePct > 50 ? '#eab308' : '#22c55e';

  return (
    <div className="space-y-6">
      {/* Top row: quota ring + key stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quota ring card */}
        <div className="bg-gradient-to-br from-purple-900/20 to-slate-900/40 border border-purple-500/20 rounded-2xl p-6 flex flex-col items-center justify-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Sending Quota</p>
          <div className="relative" style={{ width: RingSize, height: RingSize }}>
            <svg width={RingSize} height={RingSize}>
              <circle cx={RingSize / 2} cy={RingSize / 2} r={ringR} fill="none" stroke="#1e293b" strokeWidth="10" />
              <circle
                cx={RingSize / 2} cy={RingSize / 2} r={ringR} fill="none" stroke={ringColor} strokeWidth="10"
                strokeDasharray={`${ringDash} ${ringC}`} strokeLinecap="round"
                transform={`rotate(-90 ${RingSize / 2} ${RingSize / 2})`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{remaining}</span>
              <span className="text-xs text-gray-400">remaining</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-300"><span className="font-bold text-white">{sent}</span> / {limit} used</p>
            <p className="text-xs text-gray-500 mt-0.5">{usagePct}% used</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard icon={Icon.Send} label="Total Sent" value={sent} sub={`Limit: ${limit}`} color="purple" />
          <StatCard icon={Icon.CheckCircle} label="Today Delivered" value={todayDelivered} sub={`${deliveryRate}% delivery rate`} color="green" />
          <StatCard icon={Icon.Activity} label="Today Sent" value={todaySent} sub="Last 24 hours" color="blue" />
          <StatCard icon={Icon.Clock} label="Account Status" value={expired ? 'Expired' : (daysLeft !== null ? `${daysLeft}d left` : 'Active')} sub={expiry ? `Expires ${new Date(expiry).toLocaleDateString()}` : 'No expiry'} color={expired ? 'red' : 'green'} />
        </div>
      </div>

      {/* Expiry countdown — if less than 7 days */}
      {expiry && !expired && daysLeft !== null && daysLeft <= 7 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Icon.Alert className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Account expiring soon!</p>
            <p className="text-xs text-amber-300/70">Your account will expire in {daysLeft} days ({hoursLeft} hours). Contact your administrator to extend.</p>
          </div>
        </div>
      )}

      {/* Country support showcase */}
      <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Icon.Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Global Coverage</h3>
              <p className="text-xs text-gray-500">Global email deliverability — any email domain, worldwide</p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div><div className="text-xl font-bold text-blue-400">Any</div><div className="text-[10px] text-gray-500">Domain</div></div>
            <div><div className="text-xl font-bold text-purple-400">∞</div><div className="text-[10px] text-gray-500">Recipients</div></div>
            <div><div className="text-xl font-bold text-green-400">24/7</div><div className="text-[10px] text-gray-500">Sending</div></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'proton.me', 'zoho.com', 'mail.ru', 'qq.com', 'yahoo.co.jp', 'rediffmail.com'].map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs text-cyan-300 font-mono hover:bg-white/10 transition">
              @{d}
            </span>
          ))}
        </div>
      </div>

      {/* Recent campaigns */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Layers className="w-4 h-4 text-purple-400" /> Recent Campaigns
        </h3>
        {stats.recentCampaigns && stats.recentCampaigns.length > 0 ? (
          <div className="space-y-2">
            {stats.recentCampaigns.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{c.message?.substring(0, 50) || 'Campaign'}…</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(c.createdAt).toLocaleDateString()} · {c.totalSent || 0} sent</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                  c.status === 'sent' ? 'bg-green-500/20 text-green-300' :
                  c.status === 'partial' ? 'bg-amber-500/20 text-amber-300' :
                  c.status === 'blocked_spam' ? 'bg-red-500/20 text-red-300' :
                  c.status === 'running' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                  'bg-gray-500/20 text-gray-300'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Icon.Send className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No campaigns yet. Head to the Send Email tab to start your first campaign.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// SPAM METER — circular gauge
// ================================================================
function SpamMeter({ score, level }) {
  const size = 120;
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color = level === 'high' ? '#ef4444' : level === 'moderate' ? '#eab308' : '#22c55e';
  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-500 uppercase">{level}</span>
      </div>
    </div>
  );
}

// ================================================================
// STEP INDICATOR
// ================================================================
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current ? 'bg-green-500 text-white' :
              i === current ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-4 ring-purple-500/20' :
              'bg-slate-800 text-gray-500 border border-slate-700'
            }`}>
              {i < current ? <Icon.Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[10px] mt-1.5 ${i <= current ? 'text-white' : 'text-gray-600'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i < current ? 'bg-green-500' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ================================================================
// SEND TAB — ENTERPRISE anti-spam sending configuration
// ================================================================
function SendTab({ stats, templates, campaigns, onSent, onCampaignClick, language }) {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [sendType, setSendType] = useState('manual');
  const [templateUsed, setTemplateUsed] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [spamPreview, setSpamPreview] = useState(null);
  const [spamChecking, setSpamChecking] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [delayMs, setDelayMs] = useState(1200);
  const [jitterPct, setJitterPct] = useState(30);
  const [humanize, setHumanize] = useState(true);
  const [polymorph, setPolymorph] = useState(true);
  const [dripMode, setDripMode] = useState(false);

  // ═══ BM2 Ultra — ALL options (A-to-Z, exact screenshot labels) ═══
  const [topTab, setTopTab] = useState('addTask');
  const [senderMail, setSenderMail] = useState('');
  const [senderUsed, setSenderUsed] = useState(false);
  const [checkBounce, setCheckBounce] = useState(true);
  const [checkResult, setCheckResult] = useState(false);
  const [checkReply, setCheckReply] = useState(false);
  const [contentMode, setContentMode] = useState('html');
  const [pageColor, setPageColor] = useState('24spi');
  const [eachEvery, setEachEvery] = useState(50);
  const [colorSec, setColorSec] = useState(0);
  const [bodyMode, setBodyMode] = useState('html');
  const [mailMode, setMailMode] = useState('new');
  const [autoReply, setAutoReply] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [importFlag, setImportFlag] = useState(false);
  const [randomText, setRandomText] = useState(false);
  const [randomHtml, setRandomHtml] = useState(false);
  const [randomTest, setRandomTest] = useState(false);
  const [testMail, setTestMail] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [senderRotate, setSenderRotate] = useState(true);
  const [speedMode, setSpeedMode] = useState('ALL');
  const [changeAfterStart, setChangeAfterStart] = useState(1);
  const [useName, setUseName] = useState(false);
  const [sendQuestion, setSendQuestion] = useState(true);
  const [confirmedShipping, setConfirmedShipping] = useState(false);
  const [prioritySend, setPrioritySend] = useState(false);
  const [scheduledTask, setScheduledTask] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagTarget, setTagTarget] = useState('subject');
  const [imageUrls, setImageUrls] = useState([]);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [progressTimer, setProgressTimer] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [taskLog, setTaskLog] = useState([]);
  const [senderAccounts, setSenderAccounts] = useState([]);
  const [activeSenderIdx, setActiveSenderIdx] = useState(0);

  const remaining = stats ? Math.max((stats.limit || 0) - (stats.sent || 0), 0) : 0;
  const parsedEmails = numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);

  // ── All Tag definitions (the tag picker panel) ──
  const allTags = [
    { tag: '#RANDOM#', desc: 'Unique random string per email', sample: 'aB3xK9' },
    { tag: '#RandomJunk#', desc: 'Random junk text (anti-fingerprint)', sample: 'JHKHJdsk09' },
    { tag: '#DATE#', desc: 'Current date (auto)', sample: '25-Aug-2026' },
    { tag: '#TIME#', desc: 'Current time (auto)', sample: '14:32' },
    { tag: '#DATETIME#', desc: 'Full date + time', sample: '25-Aug-2026 14:32' },
    { tag: '#RANDOM_NUMBER#', desc: 'Random number 1-9999', sample: '4827' },
    { tag: '#RANDOM_STRING#', desc: 'Random alphanumeric (8 chars)', sample: 'xK7mP2qN' },
    { tag: '#NAME#', desc: 'Random first name', sample: 'Sarah' },
    { tag: '#GREETING#', desc: 'Time-based greeting', sample: 'Good afternoon' },
    { tag: '#CITY#', desc: 'Random city name', sample: 'Chicago' },
    { tag: '#SUBJECT_RANDOM#', desc: 'Random subject prefix', sample: 'Update' },
    { tag: '#YEAR#', desc: 'Current year', sample: '2026' },
    { tag: '#WEEKDAY#', desc: 'Day of week', sample: 'Monday' },
    { tag: '#RANDOM_LETTERS#', desc: 'Random letters (6)', sample: 'QmXpLz' },
    { tag: '#UNSUB_LINK#', desc: 'Unsubscribe placeholder', sample: '[unsubscribe]' },
    { tag: '#SENDER_NAME#', desc: 'Sender display name', sample: 'Support Team' },
  ];

  const insertTag = (tagStr) => {
    if (tagTarget === 'subject') {
      setSubject(prev => prev + tagStr);
    } else {
      setMessage(prev => prev + tagStr);
    }
  };

  // ── Fetch connected sender accounts (credentials.json rotation list) ──
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'listSenders' }),
        });
        const data = await res.json();
        if (active && data.success && Array.isArray(data.senders)) {
          setSenderAccounts(data.senders);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const handleTemplateSelect = (tmpl) => {
    setSelectedTemplate(tmpl);
    setMessage(tmpl.content);
    setSendType('template');
    setTemplateUsed(tmpl.name);
  };

  const handleSpamCheck = async () => {
    if (!message.trim()) return;
    setSpamChecking(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'spamCheck', message }),
      });
      const data = await res.json();
      if (data.success) {
        setSpamPreview({ score: data.spamScore, level: data.spamLevel, reasons: data.spamReasons, aiReview: data.aiReview });
      }
    } catch {}
    setSpamChecking(false);
  };

  useEffect(() => {
    if (!message.trim() || message.length < 10) { setSpamPreview(null); return; }
    const t = setTimeout(handleSpamCheck, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const handleAiSuggest = async () => {
    setAiLoading(true); setAiSuggestion('');
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'aiChat', language,
          message: `I need an effective, spam-free email marketing message in ${language === 'bn' ? 'Bengali' : 'English'}. ${message ? 'Improve this draft: ' + message : 'Create a new one'}. Keep the subject under 60 chars and body under 500 chars. Return as: SUBJECT|||BODY format.`,
        }),
      });
      const data = await res.json();
      if (data.success) setAiSuggestion(data.reply);
      else onSent(data.error || 'AI suggestion failed', 'error');
    } catch { onSent('Network error', 'error'); }
    setAiLoading(false);
  };

  const handleApplyAi = () => {
    if (aiSuggestion) {
      const parts = aiSuggestion.split('|||');
      if (parts.length >= 2) { setSubject(parts[0].trim()); setMessage(parts.slice(1).join('|||').trim()); }
      else { setMessage(aiSuggestion); }
      setSendType('ai'); setAiSuggestion('');
    }
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'bulkImport', csvData: text }),
      });
      const data = await res.json();
      if (data.success) { setNumbersText(data.numbers.join('\n')); setImportFlag(true); onSent(`Imported ${data.count} emails`, 'success'); }
      else onSent(data.error || 'Import failed', 'error');
    } catch { onSent('Import error', 'error'); }
    e.target.value = '';
  };

  const pollProgress = (campaignId) => {
    if (progressTimer) clearInterval(progressTimer);
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'getCampaignProgress', campaignId }),
        });
        const data = await res.json();
        if (data.success) {
          setProgress(data.campaign);
          if (data.campaign.senderApiName) {
            const idx = senderAccounts.findIndex(s => s.email === data.campaign.senderApiName);
            if (idx >= 0) setActiveSenderIdx(idx);
          }
          if (['sent', 'partial', 'failed', 'blocked_spam'].includes(data.campaign.status)) {
            clearInterval(timer);
            setProgressTimer(null);
            setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Campaign ${data.campaign.status}: ${data.campaign.totalSent}/${data.campaign.totalSent + data.campaign.totalUndelivered} sent` }]);
          } else {
            setTaskLog(prev => [...prev.slice(-20), { time: new Date().toLocaleTimeString(), msg: `Progress: ${data.campaign.totalSent || 0}/${(data.campaign.totalSent || 0) + (data.campaign.totalUndelivered || 0)} sent` }]);
          }
        }
      } catch {}
    }, 2000);
    setProgressTimer(timer);
  };

  useEffect(() => () => { if (progressTimer) clearInterval(progressTimer); }, [progressTimer]);

  const handleStop = () => {
    if (progressTimer) { clearInterval(progressTimer); setProgressTimer(null); }
    setLoading(false);
    setPaused(false);
    setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'Campaign STOPPED by user' }]);
    onSent('Campaign stopped', 'error');
  };

  const handlePause = () => {
    setPaused(p => !p);
    setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: paused ? 'Campaign RESUMED' : 'Campaign PAUSED' }]);
  };

  const handleTestMail = async () => {
    if (!message.trim()) { onSent('Enter email body first', 'error'); return; }
    if (!testRecipient.trim()) { onSent('Enter a test recipient email', 'error'); return; }
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message, subject, numbers: [testRecipient.trim()], sendType: 'test',
          options: { testMail: true, testRecipient: testRecipient.trim(), contentMode, batchSize: 1, delayMs: 0, checkBounce, bodyMode, mailMode, pageColor, eachEvery },
        }),
      });
      const data = await res.json();
      if (data.success && data.testMail) {
        setTestResult({ ok: true, recipient: data.recipient, sender: data.senderApiUsed });
        setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Test mail sent to ${data.recipient} via ${data.senderApiUsed || 'auto'}` }]);
        onSent(`Test email sent to ${data.recipient}`, 'success');
      } else if (data.blocked) {
        setTestResult({ ok: false, blocked: true, score: data.spamScore, reasons: data.spamReasons });
        onSent('Test blocked by spam filter', 'error');
      } else {
        setTestResult({ ok: false, error: data.error });
        onSent(data.error || 'Test failed', 'error');
      }
    } catch { onSent('Network error', 'error'); }
    setTesting(false);
  };

  const handleSend = async () => {
    if (!message.trim()) { onSent('Please enter an email body', 'error'); return; }
    if (parsedEmails.length === 0) { onSent('No valid email addresses', 'error'); return; }
    const nums = parsedEmails.slice(0, remaining);
    setLoading(true); setResult(null); setProgress(null); setPaused(false);
    setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Launching campaign: ${nums.length} recipients, mode=${contentMode}, content=${bodyMode}, batch=${batchSize}, speed=${speedMode}` }]);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message, subject, numbers: nums, sendType, templateUsed,
          options: {
            batchSize, delayMs, jitterPct, humanize, polymorph, dripMode,
            contentMode, changeAfterSent: polymorph, randomText, pageFormat: pageColor, senderRotate,
            checkBounce, checkResult, checkReply, bodyMode, mailMode, pageColor, eachEvery, colorSec,
            autoSave, autoReply, autoSend, importFlag, randomHtml, randomTest,
            speedMode, changeAfterStart, useName, sendQuestion, confirmedShipping, prioritySend,
            scheduledTask, senderMail,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invalidInfo = data.totalInvalid > 0 ? ` | ${data.totalInvalid} invalid` : '';
        onSent(`Sent ${data.totalSent} via ${data.senderApiUsed} — ${data.totalDelivered} delivered, ${data.totalUndelivered} undelivered${invalidInfo}`, 'success');
        setResult(data);
        if (data.senderApiUsed && data.senderApiUsed.includes('used')) setSenderUsed(true);
        if (data.campaignId) pollProgress(data.campaignId);
      } else if (data.blocked) {
        onSent('⚠ Message blocked by spam protection. Rewrite your content.', 'error');
        setResult({ blocked: true, spamScore: data.spamScore, spamReasons: data.spamReasons });
        setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `BLOCKED by spam filter (score ${data.spamScore})` }]);
      } else {
        onSent(data.error || 'Failed to send', 'error');
        if (data.invalidNumbers) setResult({ invalidNumbers: data.invalidNumbers });
      }
    } catch { onSent('Network error', 'error'); }
    setLoading(false);
  };

  const handleAddTask = () => {
    setMessage(''); setSubject(''); setNumbersText(''); setResult(null); setProgress(null);
    setSpamPreview(null); setTestResult(null); setPaused(false);
    setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'New task created — fields cleared' }]);
    onSent('New task ready', 'success');
  };

  const handleReuseSender = () => {
    setSenderUsed(false);
    setSenderRotate(true);
    setTaskLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'Sender reused — rotation re-enabled' }]);
    onSent('Sender reused, rotation active', 'success');
  };

  const templateTypes = [
    { key: 'payment', label: 'Payment' }, { key: 'marketing', label: 'Marketing' },
    { key: 'promo', label: 'Promo' }, { key: 'order', label: 'Order' },
    { key: 'crypto', label: 'Crypto' }, { key: 'custom', label: 'Custom' },
  ];

  // Content Type — ALL options from BM2 Ultra screenshot
  const contentTypes = [
    { key: 'pdf', label: 'To PDF', icon: 'FilePdf' },
    { key: 'image', label: 'To Image', icon: 'Image' },
    { key: 'inline', label: 'Inline Image', icon: 'Image' },
    { key: 'htmlfile', label: 'To HTML', icon: 'FileCode' },
    { key: 'ppt', label: 'PPT', icon: 'Layers' },
    { key: 'randomcolor', label: 'Random Color', icon: 'Palette' },
  ];

  const pageColors = [
    { key: '24spi', label: 'Color: 24 Spi' },
    { key: '8spi', label: 'Color: 8 Spi' },
    { key: 'mono', label: 'Monochrome' },
  ];

  const speedModes = [
    { key: 'ALL', label: 'Speed ALL' },
    { key: 'SLOW', label: 'Speed SLOW' },
    { key: 'SAFE', label: 'Speed SAFE' },
  ];

  const totalTarget = Math.min(parsedEmails.length, remaining);
  const estMinutes = Math.ceil(totalTarget / batchSize) * (delayMs / 1000 / 60);

  // Top tab bar items (BM2 Ultra exact)
  const topTabs = [
    { key: 'addTask', label: 'Add Task', icon: 'Plus' },
    { key: 'taskStatus', label: 'Task Status', icon: 'Activity' },
    { key: 'taskLog', label: 'Task Log', icon: 'List' },
    { key: 'taskReport', label: 'Task Report', icon: 'Report' },
    { key: 'open', label: 'Open', icon: 'FileCode' },
    { key: 'openTask', label: 'Open Task', icon: 'Inbox' },
  ];

  // ── helper: small toggle (checkbox-like) matching BM2 "Send?" "Name?" style ──
  // Uses a static class lookup so Tailwind can detect/generate all classes at build time.
  const miniToggleStyles = {
    yellow: { on: 'bg-amber-500/15 text-amber-300 border-amber-500/30', chk: 'bg-amber-500 border-amber-500' },
    green:  { on: 'bg-green-500/15 text-green-300 border-green-500/30', chk: 'bg-green-500 border-green-500' },
    cyan:   { on: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',    chk: 'bg-cyan-500 border-cyan-500' },
    red:    { on: 'bg-red-500/15 text-red-300 border-red-500/30',       chk: 'bg-red-500 border-red-500' },
    violet: { on: 'bg-violet-500/15 text-violet-300 border-violet-500/30', chk: 'bg-violet-500 border-violet-500' },
  };
  const MiniToggle = ({ label, value, onChange, icon, accent = 'yellow' }) => {
    const st = miniToggleStyles[accent] || miniToggleStyles.yellow;
    return (
      <button type="button" onClick={() => onChange(!value)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition border ${value ? st.on : 'bg-white/[0.02] text-gray-500 border-white/5 hover:text-gray-300'}`}>
        {icon && (() => { const Ic = Icon[icon] || Icon.Check; return <Ic className="w-3.5 h-3.5" />; })()}
        <span>{label}</span>
        <span className={`ml-auto w-3.5 h-3.5 rounded border flex items-center justify-center transition ${value ? st.chk : 'border-gray-600'}`}>
          {value && <Icon.Check className="w-2.5 h-2.5 text-white" />}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══════ Top Tab Bar — Add Task | Task Status | Task Log | Task Report | Open | Open Task ══════ */}
      <div className="flex items-center gap-1 overflow-x-auto bg-slate-900/60 rounded-xl border border-white/10 p-1.5">
        {topTabs.map(tt => {
          const Ic = Icon[tt.icon] || Icon.Plus;
          return (
            <button key={tt.key} onClick={() => setTopTab(tt.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${topTab === tt.key ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Ic className="w-3.5 h-3.5" /> {tt.label}
            </button>
          );
        })}
      </div>

      {/* ══════ "Your email is already used" red banner + Reuse ══════ */}
      {senderUsed && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Icon.Alert className="w-5 h-5 text-red-400" />
            <p className="text-sm font-semibold text-red-300">Your email is already used — sender rate-limited or flagged</p>
          </div>
          <button onClick={handleReuseSender} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition">
            <Icon.RotateCcw className="w-3.5 h-3.5" /> Reuse
          </button>
        </div>
      )}

      {/* ══════ Scheduled task Check banner ══════ */}
      {scheduledTask && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
          <Icon.Clock className="w-4 h-4 text-blue-400" />
          <p className="text-xs font-medium text-blue-300">Scheduled task Check — campaign will auto-start when scheduler triggers</p>
        </div>
      )}

      {/* ══════ TASK LOG tab ══════ */}
      {topTab === 'taskLog' && (
        <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-5 max-h-[500px] overflow-y-auto">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Icon.List className="w-3.5 h-3.5" /> Task Log</p>
          {taskLog.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">No log entries yet. Send a campaign to see activity.</p>
          ) : (
            <div className="space-y-1.5 font-mono text-[11px]">
              {taskLog.slice().reverse().map((l, i) => (
                <div key={i} className="flex gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-gray-600 flex-shrink-0">{l.time}</span>
                  <span className="text-gray-300">{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ TASK STATUS tab ══════ */}
      {topTab === 'taskStatus' && (
        <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Icon.Activity className="w-3.5 h-3.5" /> Task Status</p>
          {progress ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-violet-600/15 to-indigo-600/10 border border-violet-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-violet-300 uppercase tracking-wider font-semibold">Total Sent</span>
                  <span className="text-lg font-black text-white tabular-nums">
                    {progress.totalSent || 0} <span className="text-gray-500 text-sm font-normal">of {(progress.totalSent || 0) + (progress.totalUndelivered || 0)}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress.totalSent > 0 ? Math.round((progress.totalSent / Math.max(progress.totalSent + progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-white">{progress.totalSent || 0}</div><div className="text-xs text-gray-500 mt-0.5">Sent</div></div>
                <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-400">{progress.totalDelivered || 0}</div><div className="text-xs text-gray-500 mt-0.5">Delivered</div></div>
                <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-400">{progress.totalUndelivered || 0}</div><div className="text-xs text-gray-500 mt-0.5">Undelivered</div></div>
                <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-amber-400">{progress.totalInvalid || 0}</div><div className="text-xs text-gray-500 mt-0.5">Invalid</div></div>
              </div>
              {progress.senderApiName && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon.Refresh className="w-3.5 h-3.5 text-violet-400" />
                  Sender API: <span className="text-cyan-400">{progress.senderApiName}</span> · Batch: {progress.batchSize} · Delay: {(progress.delayMs / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-8">No active task. Create a task from the Add Task tab.</p>
          )}
        </div>
      )}

      {/* ══════ TASK REPORT tab ══════ */}
      {topTab === 'taskReport' && (
        <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Icon.Report className="w-3.5 h-3.5" /> Task Report</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-white">{progress?.totalSent || 0}</div><div className="text-xs text-gray-500 mt-0.5">Total Sent</div></div>
            <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-400">{progress?.totalDelivered || 0}</div><div className="text-xs text-gray-500 mt-0.5">Delivered</div></div>
            <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-400">{progress?.totalUndelivered || 0}</div><div className="text-xs text-gray-500 mt-0.5">Undelivered</div></div>
            <div className="bg-white/5 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-amber-400">{progress?.totalInvalid || 0}</div><div className="text-xs text-gray-500 mt-0.5">Invalid</div></div>
          </div>
          <div className="mt-4 p-4 bg-slate-900/50 rounded-xl">
            <p className="text-xs text-gray-500 mb-2">Success Status</p>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${progress?.status === 'sent' ? 'bg-green-500/20 text-green-300' : progress?.status === 'partial' ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-500/20 text-gray-400'}`}>
                {progress?.status === 'sent' ? '✓ Success — Sent: ALL' : progress?.status === 'partial' ? 'Partial' : 'Pending'}
              </span>
              <span className="text-xs text-gray-400">Sent: {progress?.totalSent || 0} of {(progress?.totalSent || 0) + (progress?.totalUndelivered || 0) || totalTarget}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════ OPEN / OPEN TASK tab ══════ */}
      {(topTab === 'open' || topTab === 'openTask') && (
        <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-6 text-center">
          <Icon.Inbox className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{topTab === 'open' ? 'Open a saved task file from your computer' : 'Open a previously created task'}</p>
          <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-violet-600/20 text-violet-300 rounded-lg text-xs font-medium cursor-pointer hover:bg-violet-600/30 transition">
            <Icon.Upload className="w-4 h-4" /> Choose File
            <input type="file" accept=".json,.csv,.txt" onChange={handleBulkImport} className="hidden" />
          </label>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════
          ADD TASK — SINGLE PAGE (no steps, all options visible at once, BM2 Ultra style)
      ════════════════════════════════════════════════════════════════════════════ */}
      {topTab === 'addTask' && (
        <div className="flex flex-col gap-2.5 h-[calc(100vh-130px)] lg:h-[calc(100vh-150px)]">
          {/* ── Compact status bar (fixed) ── */}
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-indigo-600/10 to-transparent p-2.5 flex-shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_60%)]" />
            <div className="relative flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
                  <Icon.Bolt className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-violet-300/80 uppercase tracking-widest font-semibold leading-none">Sending Quota</p>
                  <p className="text-sm text-white leading-tight mt-0.5"><span className="text-xl font-black text-white">{remaining}</span> <span className="text-gray-400 text-xs">emails remaining</span></p>
                </div>
              </div>
              <div className="h-7 w-px bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-[11px] text-green-300 font-medium">Anti-Spam Engine</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${loading || progress ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-pulse' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>{loading || progress ? 'Sending…' : 'Ready to Send'}</span>
                {senderAccounts.length > 0 && <span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 flex items-center gap-1"><Icon.Refresh className="w-2.5 h-2.5" /> {senderAccounts.length} sender{senderAccounts.length > 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>

          {/* ── THREE-COLUMN (fills height, each column scrolls internally) ── */}
          <div className="grid lg:grid-cols-[190px_1fr_170px] gap-2.5 flex-1 min-h-0 overflow-hidden">
            {/* ── LEFT: Recipient List ── */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5 flex flex-col min-h-0 overflow-hidden order-2 lg:order-1">
              <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 font-semibold flex-shrink-0"><Icon.Users className="w-3 h-3" /> Recipient List</p>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {parsedEmails.length === 0 ? (
                  <p className="text-[11px] text-gray-600 text-center py-6">No emails yet</p>
                ) : parsedEmails.slice(0, 100).map((em, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${i === activeSenderIdx ? 'bg-violet-500/15 border-violet-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                    <span className="w-5 h-5 rounded-md bg-violet-500/15 text-violet-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-[11px] text-gray-300 truncate font-mono">{em}</span>
                  </div>
                ))}
                {parsedEmails.length > 100 && <p className="text-[10px] text-gray-600 text-center pt-1">+{parsedEmails.length - 100} more…</p>}
              </div>
              {parsedEmails.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 flex-shrink-0">
                  <p className="text-[10px] text-green-400 flex items-center gap-1"><Icon.CheckCircle className="w-3 h-3" /> {parsedEmails.length} loaded</p>
                </div>
              )}
            </div>

            {/* ── CENTER: All config (scrollable, compact) ── */}
            <div className="flex flex-col min-h-0 overflow-hidden order-1 lg:order-2">
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                {/* Sender Mail + Render Mail */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1 flex items-center gap-1"><Icon.Mail className="w-3 h-3 text-cyan-400" /> Sender Mail</label>
                      <input value={senderMail} onChange={(e) => setSenderMail(e.target.value)}
                        placeholder="sender@gmail.com (empty = auto)"
                        className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[11px] font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1 flex items-center gap-1"><Icon.Key className="w-3 h-3 text-violet-400" /> Render Mail (credentials.json)</label>
                      <div className="flex items-center gap-2">
                        <select value={activeSenderIdx} onChange={(e) => setActiveSenderIdx(Number(e.target.value))}
                          className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px] font-mono">
                          {senderAccounts.length === 0 && <option value={0}>No accounts connected</option>}
                          {senderAccounts.map((s, i) => (
                            <option key={i} value={i}>{s.email} ({s.provider})</option>
                          ))}
                        </select>
                        {senderRotate && (
                          <span className="text-[9px] text-violet-300 flex items-center gap-0.5 flex-shrink-0">
                            <Icon.Refresh className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} /> Rotate
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speed ALL + Change After.start + Name? + Send? */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Icon.Zap className="w-2.5 h-2.5 text-amber-400" /> Speed</p>
                      <div className="flex gap-0.5">
                        {speedModes.map(sp => (
                          <button key={sp.key} onClick={() => setSpeedMode(sp.key)}
                            className={`flex-1 px-1.5 py-1 rounded-md text-[9px] font-medium transition ${speedMode === sp.key ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{sp.label.replace('Speed ', '')}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Icon.Refresh className="w-2.5 h-2.5 text-violet-400" /> Change After.start</p>
                      <input type="number" min="1" max="999" value={changeAfterStart} onChange={(e) => setChangeAfterStart(Number(e.target.value))}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    </div>
                    <MiniToggle label="Name ?" value={useName} onChange={setUseName} icon="User" accent="yellow" />
                    <MiniToggle label="Send ?" value={sendQuestion} onChange={setSendQuestion} icon="Send" accent="green" />
                  </div>
                </div>

                {/* Tags + Import + AI */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                      <Icon.Tag className="w-3 h-3 text-amber-400" />
                      <span className="text-[11px] font-mono text-amber-300">#RANDOM#</span>
                    </div>
                    <button onClick={() => { setTagPickerOpen(true); setTagTarget('subject'); }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-md text-[11px] font-medium transition border border-amber-500/20">
                      <Icon.Tag className="w-3 h-3" /> All Tags
                    </button>
                    <label className="flex items-center gap-1 px-2 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-md text-[11px] font-medium cursor-pointer transition border border-white/5">
                      <Icon.Upload className="w-3 h-3" /> Import
                      <input type="file" accept=".csv,.txt" onChange={handleBulkImport} className="hidden" />
                    </label>
                    <button onClick={handleAiSuggest} disabled={aiLoading}
                      className="flex items-center gap-1 px-2 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-md text-[11px] font-medium transition">
                      {aiLoading ? <Spinner size={10} /> : <Icon.Sparkle className="w-3 h-3" />} AI
                    </button>
                  </div>
                  {aiSuggestion && (
                    <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <p className="text-[11px] text-gray-200 mb-1.5">{aiSuggestion}</p>
                      <button onClick={handleApplyAi} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-medium">Use this</button>
                    </div>
                  )}
                </div>

                {/* Templates (compact, inline) */}
                {templates.length > 0 && (
                  <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Icon.Sparkle className="w-2.5 h-2.5 text-violet-400" /> Templates</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templateTypes.map(tt => templates.filter(t => t.type === tt.key).map(t => (
                        <button key={t._id} onClick={() => handleTemplateSelect(t)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition ${selectedTemplate?._id === t._id ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'}`}>
                          {tt.label}: {t.name}
                        </button>
                      )))}
                    </div>
                  </div>
                )}

                {/* Subject + Body */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5 space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-gray-300">Subject Line <span className="text-violet-400 text-[9px]">(supports #RANDOM# etc.)</span></label>
                      <button onClick={() => { setTagTarget('subject'); setTagPickerOpen(true); }}
                        className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Tag className="w-2.5 h-2.5" /> Insert Tag</button>
                    </div>
                    <input value={subject} onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter subject… use #RANDOM# for unique subjects"
                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px]"
                      maxLength={120} />
                    <p className="text-[9px] text-gray-500 mt-0.5">{subject.length}/120 {subject.includes('#') && <span className="text-violet-300">· tag detected</span>}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-gray-300">Content (html) <span className="text-gray-600 text-[9px]">— body</span></label>
                      <div className="flex items-center gap-2">
                        {spamChecking && <p className="text-[9px] text-gray-500 animate-pulse flex items-center gap-0.5"><Spinner size={8} /> AI…</p>}
                        {spamPreview && !spamChecking && (
                          <p className={`text-[9px] font-semibold flex items-center gap-0.5 ${spamPreview.level === 'high' ? 'text-red-400' : spamPreview.level === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                            Spam: {spamPreview.score}/100 · {spamPreview.level}
                          </p>
                        )}
                        <button onClick={() => { setTagTarget('body'); setTagPickerOpen(true); }}
                          className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Tag className="w-2.5 h-2.5" /> Insert Tag</button>
                      </div>
                    </div>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                      placeholder="Type HTML content… use tags like #RANDOM#, #RandomJunk#…"
                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none text-[11px] font-mono"
                      maxLength={2000} />
                    <p className="text-[9px] text-gray-500 mt-0.5">{message.length}/2000</p>
                  </div>
                </div>

                {/* Content Type */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Icon.Layers className="w-3 h-3 text-violet-400" /> Content Type</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {contentTypes.map(ct => {
                      const Ic = Icon[ct.icon] || Icon.Layers;
                      return (
                        <button key={ct.key} onClick={() => setContentMode(ct.key)}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md border transition ${contentMode === ct.key ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}>
                          <Ic className={`w-3.5 h-3.5 ${contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`} />
                          <span className={`text-[9px] font-medium ${contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`}>{ct.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Page Format */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Page Format</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-gray-500 mb-1">Color / Spi</p>
                      <div className="flex flex-wrap gap-1">
                        {pageColors.map(pc => (
                          <button key={pc.key} onClick={() => setPageColor(pc.key)}
                            className={`px-2 py-1 rounded-md text-[9px] font-medium transition ${pageColor === pc.key ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}>
                            {pc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 mb-1">Each Every</p>
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" max="500" value={eachEvery} onChange={(e) => setEachEvery(Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                        <span className="text-[9px] text-gray-500">Every</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 mb-1">Color: 05 Sec</p>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="60" value={colorSec} onChange={(e) => setColorSec(Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                        <span className="text-[9px] text-gray-500">sec</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Options & Flags grid */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Options & Flags</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                    <div className="flex gap-0.5">
                      <button onClick={() => setBodyMode('html')}
                        className={`flex-1 px-1 py-1.5 rounded-md text-[9px] font-medium transition ${bodyMode === 'html' ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>Html Body?</button>
                      <button onClick={() => setBodyMode('hint')}
                        className={`flex-1 px-1 py-1.5 rounded-md text-[9px] font-medium transition ${bodyMode === 'hint' ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>Hint Body?</button>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => setMailMode('new')}
                        className={`flex-1 px-1 py-1.5 rounded-md text-[9px] font-medium transition ${mailMode === 'new' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>New Mail</button>
                      <button onClick={() => setMailMode('auto')}
                        className={`flex-1 px-1 py-1.5 rounded-md text-[9px] font-medium transition ${mailMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>Auto-body</button>
                    </div>
                    <MiniToggle label="Auto Reply" value={autoReply} onChange={setAutoReply} icon="Reply" accent="yellow" />
                    <MiniToggle label="Auto Send" value={autoSend} onChange={setAutoSend} icon="Send" accent="green" />
                    <MiniToggle label="Import" value={importFlag} onChange={setImportFlag} icon="Upload" accent="cyan" />
                    <MiniToggle label="Auto-save" value={autoSave} onChange={setAutoSave} icon="Save" accent="cyan" />
                    <MiniToggle label="Check Bounce" value={checkBounce} onChange={setCheckBounce} icon="Bounce" accent="green" />
                    <MiniToggle label="Check Result?" value={checkResult} onChange={setCheckResult} icon="CheckCircle" accent="green" />
                    <MiniToggle label="Check Reply?" value={checkReply} onChange={setCheckReply} icon="Reply" accent="yellow" />
                    <MiniToggle label="Random text" value={randomText} onChange={setRandomText} icon="Sparkle" accent="yellow" />
                    <MiniToggle label="Random HTML" value={randomHtml} onChange={setRandomHtml} icon="Palette" accent="violet" />
                    <MiniToggle label="Random Test" value={randomTest} onChange={setRandomTest} icon="Zap" accent="yellow" />
                    <MiniToggle label="Confirmed Ship" value={confirmedShipping} onChange={setConfirmedShipping} icon="Check" accent="green" />
                    <MiniToggle label="Priority Send" value={prioritySend} onChange={setPrioritySend} icon="Star" accent="yellow" />
                    <MiniToggle label="Scheduled task" value={scheduledTask} onChange={setScheduledTask} icon="Clock" accent="cyan" />
                  </div>
                </div>

                {/* Recipient textarea */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-300">Recipient Emails <span className="text-gray-600 text-[9px]">(comma/newline/space)</span></label>
                    <label className="flex items-center gap-1 text-[9px] text-violet-300 cursor-pointer hover:text-violet-200 bg-violet-500/10 px-2 py-1 rounded-md transition">
                      <Icon.Upload className="w-3 h-3" /> Import
                      <input type="file" accept=".csv,.txt" onChange={handleBulkImport} className="hidden" />
                    </label>
                  </div>
                  <textarea value={numbersText} onChange={(e) => setNumbersText(e.target.value)} rows={3}
                    placeholder={"user1@gmail.com\nuser2@yahoo.com\n…"}
                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none text-[11px] font-mono" />
                  <p className="text-[9px] text-gray-500 mt-0.5">{parsedEmails.length} emails · {Math.min(parsedEmails.length, remaining)} will be sent (quota: {remaining})</p>
                </div>

                {/* Anti-spam config (compact) */}
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Icon.Shield className="w-3 h-3 text-green-400" /> Anti-Spam Config</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-300 flex justify-between"><span>Batch</span><span className="text-violet-300 font-medium">{batchSize}</span></label>
                      <input type="range" min="1" max="20" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-full accent-violet-500 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-300 flex justify-between"><span>Delay</span><span className="text-violet-300 font-medium">{(delayMs / 1000).toFixed(1)}s</span></label>
                      <input type="range" min="500" max="5000" step="100" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className="w-full accent-violet-500 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-300 flex justify-between"><span>Jitter ±</span><span className="text-violet-300 font-medium">{jitterPct}%</span></label>
                      <input type="range" min="0" max="100" value={jitterPct} onChange={(e) => setJitterPct(Number(e.target.value))} className="w-full accent-violet-500 mt-0.5" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-1.5 mt-2">
                    <ToggleRow label="Humanize" desc="Mimics human" value={humanize} onChange={setHumanize} />
                    <ToggleRow label="Drip Mode" desc="Spread over time" value={dripMode} onChange={setDripMode} />
                    <ToggleRow label="Change/each send" desc="Rewrite per recipient" value={polymorph} onChange={setPolymorph} />
                  </div>
                </div>

                {/* Test Mail? + Auto-rotate sender */}
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div className={`rounded-xl p-2.5 border transition ${testMail ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-slate-900/50'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] text-gray-300 font-semibold flex items-center gap-1"><Icon.Eye className="w-3 h-3 text-cyan-400" /> Test Mail ?</p>
                      <button onClick={() => setTestMail(!testMail)}
                        className={`relative w-10 h-5 rounded-full transition ${testMail ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${testMail ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {testMail && (
                      <div className="space-y-1.5">
                        <input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)}
                          placeholder="test@example.com"
                          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[11px] font-mono" />
                        <button onClick={handleTestMail} disabled={testing || !testRecipient.trim()}
                          className="w-full px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md text-[11px] font-medium transition flex items-center justify-center gap-1.5">
                          {testing ? <Spinner size={10} /> : <Icon.Send className="w-3 h-3" />} Send Test
                        </button>
                        {testResult && (
                          <p className={`text-[10px] px-2 py-1 rounded-md ${testResult.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
                            {testResult.ok ? `✓ ${testResult.recipient} via ${testResult.sender || 'auto'}` : testResult.blocked ? `✗ Blocked (${testResult.score})` : `✗ ${testResult.error || 'Failed'}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl p-2.5 border transition ${senderRotate ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/5 bg-slate-900/50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-gray-300 font-semibold flex items-center gap-1"><Icon.Refresh className="w-3 h-3 text-violet-400" /> Auto-rotate sender</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">Cycles credentials.json accounts</p>
                      </div>
                      <button onClick={() => setSenderRotate(!senderRotate)}
                        className={`relative w-10 h-5 rounded-full transition ${senderRotate ? 'bg-violet-500' : 'bg-slate-700'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${senderRotate ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {senderAccounts.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] text-violet-300/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        {senderAccounts.length} account{senderAccounts.length > 1 ? 's' : ''} · round-robin
                      </div>
                    )}
                  </div>
                </div>

                {/* Live progress (inside scroll area) */}
                {progress && (
                  <div className="bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-white flex items-center gap-1.5"><Icon.Activity className="w-3.5 h-3.5 text-violet-400" /> Sending HTML</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${progress.status === 'sent' ? 'bg-green-500/20 text-green-300' : progress.status === 'partial' ? 'bg-amber-500/20 text-amber-300' : progress.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300 animate-pulse'}`}>{progress.status === 'pending' ? 'Ready' : progress.status === 'running' ? 'Sending…' : progress.status === 'sent' ? 'Success' : progress.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-violet-300 uppercase tracking-wider font-semibold">Total Sent</span>
                      <span className="text-base font-black text-white tabular-nums">{progress.totalSent || 0} <span className="text-gray-500 text-xs font-normal">of {(progress.totalSent || 0) + (progress.totalUndelivered || 0) || totalTarget}</span></span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress.totalSent > 0 ? Math.round((progress.totalSent / Math.max(progress.totalSent + progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="bg-white/5 rounded-md p-1.5 text-center"><div className="text-sm font-bold text-white">{progress.totalSent || 0}</div><div className="text-[9px] text-gray-500">Sent</div></div>
                      <div className="bg-white/5 rounded-md p-1.5 text-center"><div className="text-sm font-bold text-green-400">{progress.totalDelivered || 0}</div><div className="text-[9px] text-gray-500">Delivered</div></div>
                      <div className="bg-white/5 rounded-md p-1.5 text-center"><div className="text-sm font-bold text-red-400">{progress.totalUndelivered || 0}</div><div className="text-[9px] text-gray-500">Undel.</div></div>
                      <div className="bg-white/5 rounded-md p-1.5 text-center"><div className="text-sm font-bold text-amber-400">{progress.totalInvalid || 0}</div><div className="text-[9px] text-gray-500">Invalid</div></div>
                    </div>
                    {progress.senderApiName && (
                      <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                        <Icon.Refresh className="w-3 h-3 text-violet-400" />
                        Sender: <span className="text-cyan-400">{progress.senderApiName}</span> · Batch: {progress.batchSize} · Delay: {(progress.delayMs / 1000).toFixed(1)}s{senderRotate && <span className="text-violet-300"> · auto-rotating</span>}
                      </div>
                    )}
                    {progress.status === 'sent' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-green-300"><Icon.CheckCircle className="w-3.5 h-3.5" /> Success! Sent: ALL — {progress.totalSent} of {(progress.totalSent || 0) + (progress.totalUndelivered || 0)}</div>
                    )}
                  </div>
                )}

                {/* Blocked / invalid results */}
                {result && result.blocked && !progress && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-[11px] font-bold text-red-300 mb-1">⚠ Message Blocked — Spam Protection</p>
                    <p className="text-[10px] text-red-400 mb-1.5">Score: {result.spamScore}/100</p>
                    {result.spamReasons && (
                      <div className="flex flex-wrap gap-1">
                        {result.spamReasons.map((r, i) => <span key={i} className="text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded text-red-300">{r}</span>)}
                      </div>
                    )}
                  </div>
                )}
                {result && result.invalidNumbers && result.invalidNumbers.length > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-2.5 border border-white/5">
                    <p className="text-[10px] text-red-400 font-medium mb-1">Invalid emails rejected:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.invalidNumbers.map((inv, i) => (
                        <span key={i} className="text-[10px] bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded text-red-300">{inv.number || inv} {inv.reason ? `(${inv.reason})` : ''}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky bottom action bar */}
              <div className="mt-2 pt-2 border-t border-white/10 bg-slate-950/80 backdrop-blur rounded-b-xl flex-shrink-0">
                {/* Config chips (compact) */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">{contentTypes.find(c => c.key === contentMode)?.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{pageColors.find(p => p.key === pageColor)?.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">Speed {speedMode}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{bodyMode === 'html' ? 'HTML Body' : 'Hint Body'}</span>
                  {checkBounce && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20">Check Bounce</span>}
                  {checkResult && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20">Check Result</span>}
                  {autoReply && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">Auto Reply</span>}
                  {autoSend && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20">Auto Send</span>}
                  {randomHtml && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">Random HTML</span>}
                  {confirmedShipping && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20">Confirmed Ship</span>}
                  {prioritySend && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">Priority</span>}
                  {polymorph && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">Change/sent</span>}
                  {useName && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">Name?</span>}
                  {senderRotate && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 flex items-center gap-0.5"><Icon.Refresh className="w-2.5 h-2.5" /> Rotate</span>}
                  {humanize && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/20 flex items-center gap-0.5"><Icon.Shield className="w-2.5 h-2.5" /> Humanized</span>}
                  {dripMode && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-0.5"><Icon.Clock className="w-2.5 h-2.5" /> Drip</span>}
                </div>
                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={handleSend}
                    disabled={loading || remaining <= 0 || (spamPreview && spamPreview.level === 'high')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-lg shadow-violet-600/30">
                    {loading ? <Spinner size={12} /> : <Icon.Send className="w-3.5 h-3.5" />} Sending HTML
                  </button>
                  {loading && (
                    <button onClick={handlePause}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition ${paused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                      {paused ? <><Icon.Play className="w-3.5 h-3.5" /> Resume</> : <><Icon.Pause className="w-3.5 h-3.5" /> Pause</>}
                    </button>
                  )}
                  {(loading || progress) && (
                    <button onClick={handleStop}
                      className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-red-600/30">
                      <Icon.Stop className="w-3.5 h-3.5" /> Stop
                    </button>
                  )}
                  <button onClick={handleAddTask}
                    className="flex items-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium transition">
                    <Icon.Plus className="w-3.5 h-3.5" /> Add Task
                  </button>
                  <button onClick={() => { setTestMail(true); }}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition ${testMail ? 'bg-cyan-600 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}>
                    <Icon.Eye className="w-3.5 h-3.5" /> Test Mail?
                  </button>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-500">
                    Est: <span className="text-violet-300 font-medium">{estMinutes.toFixed(1)}m</span> · Targets: <span className="text-white font-bold">{totalTarget}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Image preview grid ── */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5 flex flex-col min-h-0 overflow-hidden order-3">
              <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 font-semibold flex-shrink-0"><Icon.Image className="w-3 h-3" /> Image Preview</p>
              <div className="flex-1 overflow-y-auto min-h-0">
                {contentMode === 'inline' || contentMode === 'image' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[1,2,3,4,5,6].map(n => (
                      <div key={n} className="aspect-square rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-white/5 flex items-center justify-center">
                        <Icon.Image className="w-4 h-4 text-gray-600" />
                      </div>
                    ))}
                    <p className="col-span-2 text-[9px] text-gray-600 text-center pt-1">Inline images embed here</p>
                  </div>
                ) : contentMode === 'pdf' ? (
                  <div className="space-y-1.5">
                    {[1,2,3].map(n => (
                      <div key={n} className="aspect-[3/4] rounded-lg bg-gradient-to-b from-slate-700 to-slate-800 border border-white/5 flex items-center justify-center">
                        <Icon.FilePdf className="w-5 h-5 text-gray-600" />
                      </div>
                    ))}
                    <p className="text-[9px] text-gray-600 text-center pt-1">PDF pages preview</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 text-center py-8">Select Inline/Image/PDF to preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══════ All Tag Picker Modal ══════ */}
      {tagPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTagPickerOpen(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Tag className="w-4 h-4 text-amber-400" /> All Tags</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Click any tag to insert into the <span className="text-amber-300 font-medium">{tagTarget === 'subject' ? 'Subject' : 'Body'}</span> field</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                  <button onClick={() => setTagTarget('subject')} className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${tagTarget === 'subject' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>Subject</button>
                  <button onClick={() => setTagTarget('body')} className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${tagTarget === 'body' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>Body</button>
                </div>
                <button onClick={() => setTagPickerOpen(false)} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {allTags.map((t, i) => (
                <button key={i} onClick={() => insertTag(t.tag)}
                  className="flex items-start gap-3 p-3 bg-white/[0.03] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-xl text-left transition group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center">
                    <Icon.Tag className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-amber-300">{t.tag}</p>
                    <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{t.desc}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">e.g. {t.sample}</p>
                  </div>
                  <Icon.Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-slate-800/50 rounded-xl">
              <p className="text-[10px] text-gray-500 mb-1">Current {tagTarget === 'subject' ? 'Subject' : 'Body'}:</p>
              <p className="text-xs text-gray-300 font-mono break-all">{(tagTarget === 'subject' ? subject : message).slice(0, 150) || '(empty)'}{(tagTarget === 'subject' ? subject : message).length > 150 ? '…' : ''}</p>
            </div>
            <button onClick={() => setTagPickerOpen(false)}
              className="mt-4 w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-200 font-medium">{label}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${value ? 'bg-green-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ================================================================
// EMAIL DELIVERABILITY TAB — recipient domains, tips, best practices
// ================================================================
function CountrySupportTab() {
  const [search, setSearch] = useState('');
  const [expandedRegion, setExpandedRegion] = useState(null);

  const MAILBOX_PROVIDERS = [
    { region: 'North America', flag: '🌎', providers: [
      { name: 'Gmail', domain: 'gmail.com', note: 'Largest provider — 1.5B+ users', volume: '~27%' },
      { name: 'Google Workspace', domain: 'yourcompany.com (Google)', note: 'Business Gmail', volume: '—' },
      { name: 'Outlook.com', domain: 'outlook.com', note: 'Microsoft consumer', volume: '~7%' },
      { name: 'Yahoo Mail', domain: 'yahoo.com', note: 'Aggressive spam filter', volume: '~5%' },
      { name: 'AOL Mail', domain: 'aol.com', note: 'Legacy (Yahoo-owned)', volume: '~1%' },
      { name: 'iCloud Mail', domain: 'icloud.com', note: 'Apple — strict DKIM', volume: '~4%' },
    ]},
    { region: 'Asia Pacific', flag: '🌏', providers: [
      { name: 'Yahoo Japan', domain: 'yahoo.co.jp', note: 'Japan #1 — very strict', volume: '~15% JP' },
      { name: 'Naver', domain: 'naver.com', note: 'South Korea — strict auth', volume: '~10% KR' },
      { name: 'QQ Mail', domain: 'qq.com', note: 'China — Tencent', volume: '~20% CN' },
      { name: '163 Mail', domain: '163.com', note: 'China — NetEase', volume: '~15% CN' },
      { name: 'Rediffmail', domain: 'rediffmail.com', note: 'India legacy', volume: '~2% IN' },
      { name: 'Zoho Mail', domain: 'zoho.com', note: 'India-based business', volume: '—' },
    ]},
    { region: 'Europe & MENA', flag: '🌍', providers: [
      { name: 'Mail.ru', domain: 'mail.ru', note: 'Russia/CIS — strict filtering', volume: '~15% RU' },
      { name: 'Yandex Mail', domain: 'yandex.com', note: 'Russia — strict DKIM/SPF', volume: '~10% RU' },
      { name: 'GMX', domain: 'gmx.com', note: 'Germany/EU', volume: '~2% EU' },
      { name: 'Web.de', domain: 'web.de', note: 'Germany — 1&1', volume: '~2% DE' },
      { name: 'ProtonMail', domain: 'proton.me', note: 'Privacy-focused, very strict', volume: '—' },
      { name: 'Orange', domain: 'orange.fr', note: 'France telecom', volume: '~5% FR' },
    ]},
  ];

  const DELIVERABILITY_TIPS = [
    { icon: '🔐', priority: 'CRITICAL', title: 'DNS Authentication (SPF + DKIM + DMARC)', desc: 'Set all three DNS records for your sending domain. Without these, most providers will mark your emails as spam or reject them entirely.' },
    { icon: '📈', priority: 'CRITICAL', title: 'Warm Up New Accounts', desc: 'Start with 20-50 emails/day per account and gradually increase over 2 weeks. Sudden bulk sends from new accounts trigger immediate spam flags.' },
    { icon: '🎲', priority: 'HIGH', title: 'Use #RANDOM# in Subject Lines', desc: 'The #RANDOM# token generates a unique string per email, preventing exact-match spam detection across bulk sends. Essential for high-volume campaigns.' },
    { icon: '✨', priority: 'HIGH', title: 'Enable AI Polymorph', desc: 'AI rewrites each email body uniquely, so no two emails are identical. This dramatically reduces spam-filter triggering from duplicate content.' },
    { icon: '⏱️', priority: 'HIGH', title: 'Batch + Delay Strategy', desc: 'Keep batch size ≤50 per account. Add 60-120 second random delays between batches. Use Jitter to randomize timing and avoid pattern detection.' },
    { icon: '👤', priority: 'MEDIUM', title: 'Personalize Content', desc: 'Use recipient name and relevant context. Avoid generic "Dear Customer" — personalization improves open rates and reduces spam scoring.' },
    { icon: '📝', priority: 'MEDIUM', title: 'Include Plain-Text Alternative', desc: 'Always provide a text/plain version alongside HTML. Many spam filters penalize HTML-only emails as suspicious.' },
    { icon: '🚫', priority: 'MEDIUM', title: 'Avoid Spam Trigger Words', desc: 'Avoid: FREE, GUARANTEE, ACT NOW, LIMITED TIME, ALL CAPS, excessive exclamation marks (!!), and red text. These are classic spam signals.' },
    { icon: '📤', priority: 'MEDIUM', title: 'Always Include Unsubscribe Link', desc: 'CAN-SPAM (US) and GDPR (EU) require a visible, working unsubscribe link. Compliance improves sender reputation.' },
    { icon: '📊', priority: 'LOW', title: 'Monitor Bounce Rate', desc: 'Keep bounce rate under 3%. Suspend accounts exceeding 5% bounces. High bounce rates damage domain reputation permanently.' },
  ];

  const filtered = MAILBOX_PROVIDERS.map(region => ({
    ...region,
    providers: region.providers.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domain.toLowerCase().includes(search.toLowerCase()) ||
      p.note.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(r => r.providers.length > 0);

  const filteredTips = DELIVERABILITY_TIPS.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Icon.Mail} label="Mailbox Providers" value="18+" color="blue" />
        <StatCard icon={Icon.Globe} label="Regions" value={MAILBOX_PROVIDERS.length} color="purple" />
        <StatCard icon={Icon.Shield} label="Deliverability Tips" value={DELIVERABILITY_TIPS.length} color="cyan" />
        <StatCard icon={Icon.Send} label="Coverage" value="Global" sub="Any email domain" color="green" />
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Icon.Mail className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Email Deliverability — Global Mailbox Providers</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Our Gmail Mailer sends directly to any email address worldwide. Below are the major mailbox providers and their filtering behavior.
            Unlike MMS gateways (which required carrier-specific domains), email sending works universally — just enter recipient email addresses.
            Follow the deliverability tips below to maximize inbox placement and avoid spam folders.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon.Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by provider name, domain, or tip…"
          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Mailbox provider cards */}
      <div className="space-y-4">
        {filtered.map((region, ri) => (
          <div key={ri} className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedRegion(expandedRegion === ri ? null : ri)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{region.flag}</span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-white">{region.region}</h3>
                  <p className="text-xs text-gray-500">{region.providers.length} mailbox providers</p>
                </div>
              </div>
              <Icon.Plus className={`w-5 h-5 text-gray-500 transition-transform ${expandedRegion === ri ? 'rotate-45' : ''}`} />
            </button>

            {expandedRegion === ri && (
              <div className="px-5 pb-5 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                {region.providers.map((provider, ci) => (
                  <div key={ci} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon.Mail className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">{provider.name}</h4>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-mono font-bold">{provider.volume}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                      <p className="text-xs text-cyan-300 font-mono truncate">{provider.domain}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">{provider.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deliverability tips */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Shield className="w-4 h-4 text-green-400" /> Email Deliverability Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTips.map((tip, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${tip.priority === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' : tip.priority === 'HIGH' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
              <span className="text-xl flex-shrink-0">{tip.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-bold text-white">{tip.title}</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${tip.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : tip.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>{tip.priority}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ================================================================
// REPORTS TAB — campaigns + delivery reports
// ================================================================
function ReportsTab({ campaigns, deliveryReports, onCampaignClick }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (c) => {
    setSelected(c);
    onCampaignClick(c._id);
  };

  // Aggregate stats
  const totalSent = campaigns.reduce((s, c) => s + (c.totalSent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.totalDelivered || 0), 0);
  const totalUndelivered = campaigns.reduce((s, c) => s + (c.totalUndelivered || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Icon.Send} label="Total Campaigns" value={campaigns.length} color="purple" />
        <StatCard icon={Icon.CheckCircle} label="Total Sent" value={totalSent} color="blue" />
        <StatCard icon={Icon.Target} label="Delivery Rate" value={`${deliveryRate}%`} color="green" />
        <StatCard icon={Icon.XCircle} label="Undelivered" value={totalUndelivered} color="red" />
      </div>

      {/* Delivery donut */}
      {totalSent > 0 && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon.Target className="w-4 h-4 text-green-400" /> Delivery Breakdown
          </h3>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative" style={{ width: 140, height: 140 }}>
              <svg width="140" height="140">
                <circle cx="70" cy="70" r="55" fill="none" stroke="#1e293b" strokeWidth="14" />
                <circle cx="70" cy="70" r="55" fill="none" stroke="#22c55e" strokeWidth="14"
                  strokeDasharray={`${(deliveryRate / 100) * 2 * Math.PI * 55} ${2 * Math.PI * 55}`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-green-400">{deliveryRate}%</span>
                <span className="text-[10px] text-gray-500">delivered</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="text-sm text-gray-300">Delivered: <span className="font-bold text-white">{totalDelivered}</span></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-sm text-gray-300">Undelivered: <span className="font-bold text-white">{totalUndelivered}</span></span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-700" /><span className="text-sm text-gray-300">Total attempts: <span className="font-bold text-white">{totalSent}</span></span></div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Layers className="w-4 h-4 text-purple-400" /> Campaign History
        </h3>
        {campaigns.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Icon.Report className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No campaigns yet. Send your first campaign from the Send Email tab.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c._id} className={`rounded-xl p-4 cursor-pointer transition border ${selected?._id === c._id ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                onClick={() => handleSelect(c)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      c.status === 'sent' ? 'bg-green-500/20 text-green-300' :
                      c.status === 'partial' ? 'bg-amber-500/20 text-amber-300' :
                      c.status === 'blocked_spam' ? 'bg-red-500/20 text-red-300' :
                      c.status === 'running' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>{c.status}</span>
                    <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.totalSent || 0} sent · {c.totalDelivered || 0} delivered
                  </div>
                </div>
                <p className="text-sm text-gray-300 truncate">{c.message?.substring(0, 80) || 'No message'}…</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery reports for selected campaign */}
      {selected && deliveryReports.length > 0 && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon.Report className="w-4 h-4 text-cyan-400" /> Delivery Details — {selected.message?.substring(0, 30) || 'Campaign'}…
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {deliveryReports.map((dr, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-xs">
                <span className="text-gray-300 font-mono">{dr.number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{dr.senderApiName}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    dr.status === 'sent' || dr.status === 'delivered' ? 'bg-green-500/20 text-green-300' :
                    dr.status === 'invalid' ? 'bg-red-500/20 text-red-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>{dr.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// INFO TAB — app info + features
// ================================================================
function InfoTab({ settings }) {
  const info = [
    { icon: Icon.Whatsapp, label: 'WhatsApp', value: settings?.whatsapp || 'Not set', color: 'text-green-400' },
    { icon: Icon.Mail, label: 'Email', value: settings?.email || 'Not set', color: 'text-indigo-400' },
    { icon: Icon.Phone, label: 'Phone', value: settings?.phone || settings?.whatsapp || 'Not set', color: 'text-blue-400' },
  ];

  const features = [
    { icon: Icon.Sparkle, label: 'AI-powered message suggestions', desc: 'Gemini AI helps you write spam-free messages' },
    { icon: Icon.Shield, label: 'Enterprise spam protection', desc: 'Multi-layer anti-spam: heuristic + AI + country rules' },
    { icon: Icon.Globe, label: 'Global email reach', desc: 'Send to any email address worldwide — no carrier restrictions' },
    { icon: Icon.Bolt, label: 'Auto-routing sender APIs', desc: 'Intelligent load-balancing across multiple providers' },
    { icon: Icon.Inbox, label: 'Inbox & auto-reply', desc: 'Multi-language automatic email auto-responder' },
    { icon: Icon.Clock, label: 'Scheduled sends', desc: 'Plan campaigns for optimal delivery times' },
    { icon: Icon.Activity, label: 'Live progress tracking', desc: 'Real-time campaign delivery monitoring' },
    { icon: Icon.Target, label: 'Delivery reports', desc: 'Per-recipient delivery status tracking' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20">
            {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-8 h-8 text-white" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{settings?.platformName || 'Gmail Mailer'}</h2>
            <p className="text-xs text-purple-400/70 mt-0.5">{settings?.language === 'bn' ? 'Language: Bangla' : 'Language: English'}</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-5 leading-relaxed">
          {settings?.description || 'Enterprise Gmail Email Sending Module — send campaigns with AI-powered spam protection and auto-routing.'}
        </p>

        <div className="space-y-3">
          {info.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm text-gray-200">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Icon.Shield className="w-4 h-4 text-green-400" /> Platform Features
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <f.icon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-gray-200 font-medium">{f.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// INBOX & AUTO-REPLY TAB — preserved functionality, upgraded styling
// ================================================================
function InboxAutoReplyTab({ language, onToast, loginId }) {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, msgRes] = await Promise.all([
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getAutoReplyConfig' }) }),
        fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'getInboxMessages' }) }),
      ]);
      const cfg = await cfgRes.json();
      if (cfg.success) { setConfig(cfg.config); setWebhookUrl(cfg.webhookUrl || ''); }
      const msg = await msgRes.json();
      if (msg.success) setMessages(msg.messages);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'setAutoReplyConfig', enabled: config.enabled, languagePrompt: config.languagePrompt, replyMessage: config.replyMessage }),
      });
      const data = await res.json();
      if (data.success) { onToast('Auto-reply settings saved', 'success'); setConfig(data.config); }
      else onToast(data.error || 'Save failed', 'error');
    } catch { onToast('Network error', 'error'); }
    setSaving(false);
  };

  if (loading || !config) return <div className="flex items-center justify-center py-20"><Spinner size={24} /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/15 to-indigo-600/10 border border-purple-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Icon.Inbox className="w-6 h-6 text-purple-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">How Email Auto-Reply Works</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            When someone emails one of your connected inboxes (Gmail, Outlook, etc.), the system automatically replies with a language selection prompt.
            The sender chooses <span className="text-purple-300">1 (Bangla)</span>, <span className="text-purple-300">2 (English)</span>, or <span className="text-purple-300">3 (Sylheti)</span>,
            and then receives your pre-written reply in their chosen language \u2014 ideal for out-of-office, lead capture, or support acknowledgements.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Auto-Reply Status</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enable to automatically respond to incoming emails with language selection</p>
          </div>
          <button onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`relative w-14 h-7 rounded-full transition ${config.enabled ? 'bg-green-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition ${config.enabled ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5">
          <p className="text-xs text-gray-500 mb-2">Inbound Webhook URL (configure this in your email provider's inbound / IMAP-to-webhook forwarding):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-purple-300 bg-slate-900 px-3 py-2 rounded-lg font-mono break-all">{webhookUrl}</code>
            <button onClick={() => { navigator.clipboard?.writeText(webhookUrl); onToast('Webhook URL copied', 'success'); }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg flex-shrink-0 transition">Copy</button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">POST inbound emails to this URL with fields: {`{ action: 'emailInbound', From, Subject, Body, userEmail: '${loginId || 'YOUR_ID'}' }`}</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Step 1: Language Selection Prompt</h3>
        <p className="text-xs text-gray-500 mb-4">This email body is sent first when a message is received. It asks the sender to reply with a language choice.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'en', label: 'English Prompt', flag: '\ud83c\uddec\ud83c\udde7' },
            { key: 'bn', label: 'Bangla Prompt', flag: '\ud83c\udde7\ud83c\udde9' },
            { key: 'syl', label: 'Sylheti Prompt', flag: ' Sylheti' },
          ].map(({ key, label, flag }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1.5 block">{flag} {label}</label>
              <textarea
                value={config.languagePrompt?.[key] || ''}
                onChange={(e) => setConfig({ ...config, languagePrompt: { ...config.languagePrompt, [key]: e.target.value } })}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Step 2: Auto-Reply Messages</h3>
        <p className="text-xs text-gray-500 mb-4">After the sender replies with their language choice (1/2/3), this is the email they receive in that language.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'bn', label: 'Bangla Reply (Option 1)', flag: '\ud83c\udde7\ud83c\udde9' },
            { key: 'en', label: 'English Reply (Option 2)', flag: '\ud83c\uddec\ud83c\udde7' },
            { key: 'syl', label: 'Sylheti Reply (Option 3)', flag: ' Sylheti' },
          ].map(({ key, label, flag }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1.5 block">{flag} {label}</label>
              <textarea
                value={config.replyMessage?.[key] || ''}
                onChange={(e) => setConfig({ ...config, replyMessage: { ...config.replyMessage, [key]: e.target.value } })}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition flex items-center gap-2 shadow-lg shadow-purple-600/30">
          {saving ? <Spinner size={14} /> : <Icon.Check className="w-4 h-4" />}
          {saving ? 'Saving\u2026' : 'Save Auto-Reply Settings'}
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Recent Inbound Emails</h3>
          <button onClick={load} className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"><Icon.Refresh className="w-3.5 h-3.5" />Refresh</button>
        </div>
        {messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Icon.Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No inbound emails yet. Once your email provider webhook is configured, received messages will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon.Mail className="w-4 h-4 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-white">{m.fromNumber || m.fromEmail || 'Unknown sender'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      m.state === 'replied' ? 'bg-green-500/20 text-green-300' :
                      m.state === 'awaiting_language' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-700 text-gray-400'
                    }`}>
                      {m.state === 'replied' ? `Replied (${m.selectedLanguage || '?'})` : m.state === 'awaiting_language' ? 'Awaiting language' : 'Direct'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">Incoming: {m.incomingMessage || '(empty)'}</p>
                  {m.replySent && <p className="text-xs text-gray-500 mt-0.5">Reply: {m.replySent.slice(0, 80)}\u2026</p>}
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(m.receivedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// SCHEDULED SENDS SECTION
// ================================================================
function ScheduledSection({ language, onToast }) {
  const [scheduled, setScheduled] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sMessage, setSMessage] = useState('');
  const [sNumbers, setSNumbers] = useState('');
  const [sTime, setSTime] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchScheduled = useCallback(async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'getScheduledSends' }),
      });
      const data = await res.json();
      if (data.scheduledSends) setScheduled(data.scheduledSends);
    } catch {}
  }, []);

  useEffect(() => { fetchScheduled(); }, [fetchScheduled]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!sMessage.trim() || !sNumbers.trim() || !sTime) { onToast('Fill all fields', 'error'); return; }
    setLoading(true);
    try {
      const nums = sNumbers.split(/[\n,]/).map(n => n.trim()).filter(Boolean);
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'scheduleSend', message: sMessage, numbers: nums, scheduledAt: sTime }),
      });
      const data = await res.json();
      if (data.success) {
        onToast('Campaign scheduled', 'success');
        setSMessage(''); setSNumbers(''); setSTime(''); setShowForm(false);
        fetchScheduled();
      } else {
        onToast(data.error || 'Failed', 'error');
      }
    } catch { onToast('Network error', 'error'); }
    setLoading(false);
  };

  return (
    <div className="mt-6 bg-slate-900/50 border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Icon.Calendar className="w-4 h-4 text-blue-400" /> Scheduled Sends
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 transition">
          <Icon.Plus className="w-3.5 h-3.5" /> {showForm ? 'Cancel' : 'Schedule new'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSchedule} className="space-y-3 mb-4 p-4 bg-white/5 rounded-xl border border-white/5">
          <input type="text" value={sMessage} onChange={(e) => setSMessage(e.target.value)}
            placeholder="Email body content"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <input type="text" value={sNumbers} onChange={(e) => setSNumbers(e.target.value)}
            placeholder="Recipient emails (comma or newline separated)"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <input type="datetime-local" value={sTime} onChange={(e) => setSTime(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <button type="submit" disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition">
            {loading ? <Spinner /> : <Icon.Clock className="w-4 h-4" />} Schedule
          </button>
        </form>
      )}

      {scheduled.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-6">No scheduled sends yet.</p>
      ) : (
        <div className="space-y-2">
          {scheduled.map((s) => (
            <div key={s._id} className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-blue-300 font-medium text-xs flex items-center gap-1.5"><Icon.Calendar className="w-3.5 h-3.5" /> {new Date(s.scheduledAt).toLocaleString()}</span>
                <span className="text-gray-500 text-xs">{s.numbers?.length || 0} recipients</span>
              </div>
              <p className="text-xs text-gray-300">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// AI CHAT POPUP — floating, Gemini-powered, language-aware
// ================================================================
function AIChatPopup({ language }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'aiChat', message: userMsg, language }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.error || 'AI unavailable. Admin may need to configure Gemini API.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Network error.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-2xl shadow-purple-600/40 flex items-center justify-center text-white hover:scale-110 transition"
          aria-label="AI Support">
          <Icon.Chat className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Icon.Sparkle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AI Support</div>
                <div className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><Icon.Close className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '50vh' }}>
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Icon.Sparkle className="w-10 h-10 text-purple-500/50 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  {language === 'bn' ? 'হাই! আমি আপনাকে সাহায্য করতে পারি। কী জানতে চান?' : "Hi! I'm your AI assistant. How can I help you today?"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs ${m.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-gray-400 ml-1">Typing…</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleSend(); }}
              placeholder={language === 'bn' ? 'মেসেজ লিখুন…' : 'Type a message…'}
              className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs" />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center">
              {loading ? <Spinner size={14} /> : <Icon.Send2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
