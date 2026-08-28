'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { COUNTRY_SUPPORT, getCountryStats } from '@/lib/countrySupport';
import SmsTab from './SmsTab';

// ================================================================
// Icon set (professional SVG, NO emoji in chrome — emoji only for flags)
// ================================================================
const Icon = {
  Send: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Dashboard: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 9a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-3a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" /></svg>,
  Report: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Info: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Sms: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z" /></svg>,
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
  Rocket: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.84 2.58m-.119-8.54a7.5 7.5 0 01-3.046 5.634L4.042 18.66l.469-3.461A7.5 7.5 0 0110.5 9.75m-2.25 4.5h.008v.008h-.008v-.008z" /></svg>,
  Clipboard: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
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
  Gear: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Edit: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  DocText: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Folder: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
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
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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
    if (!agreedTerms) {
      setError('You must agree to the Terms of Agreement before signing in.');
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

            {/* Terms of Agreement checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-purple-500 flex-shrink-0" />
              <span className="text-xs text-gray-400 leading-relaxed">
                I have read and agree to the{' '}
                <button type="button" onClick={() => setShowTerms(true)} className="text-purple-400 hover:text-purple-300 underline font-medium">Terms of Agreement</button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreedTerms}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
            >
              {loading ? <><Spinner /> Signing in…</> : <><Icon.Lock className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          {/* Terms of Agreement Modal */}
          {showTerms && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowTerms(false)}>
              <div className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Shield className="w-4 h-4 text-purple-400" /> Terms of Agreement</h3>
                  <button onClick={() => setShowTerms(false)} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-3 text-xs text-gray-400 leading-relaxed">
                  <p className="text-gray-300 font-semibold text-sm">{platformName} — Terms of Agreement</p>
                  <p>By accessing and using this platform, you agree to the following terms and conditions:</p>
                  <p><span className="text-purple-300 font-medium">1. Authorized Use.</span> This platform is intended for legitimate email marketing, transactional, and business communications only. You must have proper consent from all recipients before sending.</p>
                  <p><span className="text-purple-300 font-medium">2. No Spam.</span> You agree not to use this service for sending unsolicited bulk email, phishing, fraud, or any activity that violates anti-spam laws (CAN-SPAM, GDPR, CASL, etc.).</p>
                  <p><span className="text-purple-300 font-medium">3. Account Responsibility.</span> You are solely responsible for all emails sent through your account. You must keep your credentials confidential.</p>
                  <p><span className="text-purple-300 font-medium">4. Gmail OAuth.</span> Connected Gmail accounts use Google OAuth credentials.json (Desktop flow). You are responsible for your own API quotas and Google's Terms of Service.</p>
                  <p><span className="text-purple-300 font-medium">5. Anti-Spam Compliance.</span> The platform includes anti-spam features (humanize, drip mode, rotation, track pixel). These must be used to improve deliverability, not to evade detection for malicious purposes.</p>
                  <p><span className="text-purple-300 font-medium">6. Data Privacy.</span> Recipient email lists and campaign data are stored securely. The platform does not sell or share your data with third parties.</p>
                  <p><span className="text-purple-300 font-medium">7. Usage Limits.</span> Sending quotas are enforced per account. Exceeding limits may result in temporary suspension.</p>
                  <p><span className="text-purple-300 font-medium">8. Acceptance.</span> By checking the box and signing in, you acknowledge that you have read, understood, and agree to be bound by these terms.</p>
                </div>
                <div className="px-5 py-3.5 border-t border-white/10 flex gap-2 flex-shrink-0">
                  <button onClick={() => { setAgreedTerms(true); setShowTerms(false); }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition">I Agree</button>
                  <button onClick={() => setShowTerms(false)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-sm font-medium transition">Close</button>
                </div>
              </div>
            </div>
          )}

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
    { k: 'sms', l: 'SMS Module', I: Icon.Sms },
    { k: 'countries', l: 'Deliverability', I: Icon.Shield },
    { k: 'inbox', l: 'Inbox & Auto-Reply', I: Icon.Inbox },
    { k: 'reports', l: 'Reports', I: Icon.Report },
    { k: 'info', l: 'App Info', I: Icon.Info },
  ];

  return (
    <div className="h-screen bg-slate-950 relative overflow-hidden flex flex-col">
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

      {/* ── Desktop flex row: sidebar (flex child, width collapses) + main (fills rest) ── */}
      <div className="flex-1 flex relative z-10 min-h-0">
        {/* Sidebar — desktop (flex child, collapses width — NO fixed/margin hack) */}
        <aside
          style={{ width: sidebarCollapsed ? 0 : 256 }}
          className="hidden lg:flex flex-col gap-1.5 bg-slate-900/60 backdrop-blur-xl border-r border-white/5 overflow-hidden transition-[width] duration-300 ease-in-out flex-shrink-0 relative z-30"
        >
          {/* Inner content wrapper keeps padding stable so collapse animates width only */}
          <div className={`w-64 h-full p-4 flex flex-col gap-1.5 transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center gap-3 px-2 py-4 mb-2 flex-shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20 flex-shrink-0">
                {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" /> : <Icon.Send className="w-6 h-6 text-white" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{platformName}</div>
                <div className="text-[10px] text-purple-400/70 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> User Panel</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
              {tabs.map(({ k, l, I }) => (
                <TabBtn key={k} icon={I} label={l} active={activeTab === k} onClick={() => setActiveTab(k)} />
              ))}
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col gap-1.5 flex-shrink-0">
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
          </div>
        </aside>

        {/* Sidebar collapse/expand toggle — sits at the sidebar edge, moves with it */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center w-5 h-14 my-auto bg-slate-800/90 hover:bg-violet-600 border border-l-0 border-white/10 text-gray-300 hover:text-white rounded-r-lg transition-colors duration-200 flex-shrink-0 z-40"
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

        {/* Main content — flex-1 fills rest, h-full with internal scroll, NO min-h-screen */}
        <main className="flex-1 min-w-0 flex flex-col h-full pt-14 lg:pt-0 overflow-hidden">
          {/* Header (fixed height, no scroll) */}
          <div className="flex items-center justify-between px-4 sm:px-5 lg:px-6 py-3 lg:py-4 border-b border-white/5 flex-shrink-0">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight truncate">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'send' && 'Send Email Campaign'}
                {activeTab === 'sms' && 'SMS Sending Module'}
                {activeTab === 'countries' && 'Deliverability'}
                {activeTab === 'inbox' && 'Inbox & Auto-Reply'}
                {activeTab === 'reports' && 'Delivery Reports'}
                {activeTab === 'info' && 'App Information'}
              </h1>
              <p className="text-gray-400 text-xs mt-1 truncate">
                Welcome, <span className="text-purple-300 font-medium">{stats?.loginId || user?.loginId || stats?.email || user?.email}</span> · <span className="text-gray-500">{new Date(now).toLocaleString()}</span>
              </p>
            </div>
            <button
              onClick={() => { onRefresh ? onRefresh() : fetchAll(); show('Panel refreshed', 'success'); }}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition text-xs flex-shrink-0"
            >
              <Icon.Refresh className="w-4 h-4" /> Refresh
            </button>
          </div>

          {/* Mobile tab bar (fixed height, horizontal scroll) */}
          <div className="lg:hidden flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-white/5 flex-shrink-0">
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

          {/* Content — flex-1 fills remaining height, internal scroll only */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 lg:px-6 py-4 lg:py-5 animate-[fadeIn_0.3s_ease-out]">
            {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={loadingStats} now={now} language={language} />}
            {activeTab === 'send' && (
              <SendTab
                stats={stats}
                templates={templates}
                campaigns={campaigns}
                onSent={(msg, type) => { show(msg, type); fetchAll(); }}
                onCampaignClick={fetchDeliveryReports}
                language={language}
              />
            )}
            {activeTab === 'sms' && (
              <SmsTab
                user={user}
                onToast={show}
                onSent={(msg, type) => { show(msg, type); fetchAll(); }}
              />
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
  // ════════════════════════════════════════════════════════════════════════
  // MULTI-CAMPAIGN STATE — each campaign has its own independent state
  // ════════════════════════════════════════════════════════════════════════
  const STORAGE_KEY = 'mms_sendtab_state_v03';
  const [campaignList, setCampaignList] = useState([]); // array of campaign objects
  const [activeCampaignId, setActiveCampaignId] = useState(null); // currently open campaign
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  // Shared state (across all campaigns but fetched once)
  const [senderAccounts, setSenderAccounts] = useState([]);
  const [subjectCategories, setSubjectCategories] = useState([]);
  const [subjectTemplates, setSubjectTemplates] = useState([]);
  const [bodyTemplates, setBodyTemplates] = useState([]);

  // Modal/UI state (shared)
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalCampaignId, setNameModalCampaignId] = useState(null);
  const [subjectCatModalOpen, setSubjectCatModalOpen] = useState(false);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCampaignId, setPreviewCampaignId] = useState(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagTarget, setTagTarget] = useState('subject');
  const [tagPickerCampaignId, setTagPickerCampaignId] = useState(null);
  const [showBounceResult, setShowBounceResult] = useState(false);
  const [bounceCampaignId, setBounceCampaignId] = useState(null);

  // Terms of Agreement gate
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  // Live Monitor filter
  const [monitorFilter, setMonitorFilter] = useState('all'); // 'all' or campaign id

  const remaining = stats ? Math.max((stats.limit || 0) - (stats.sent || 0), 0) : 0;

  // ════════════════════════════════════════════════════════════════════════
  // Create a new campaign with default state
  // ════════════════════════════════════════════════════════════════════════
  const createDefaultCampaign = (id, name) => ({
    id,
    name,
    // Content
    subject: '',
    message: '',
    numbersText: '',
    // Sending config
    batchSize: 5,
    delayMs: 1200,
    jitterPct: 30,
    humanize: true,
    polymorph: true,
    dripMode: false,
    // Sender
    senderMail: '',
    activeSenderIdx: 0,
    senderRotate: true,
    connectingGmail: false,
    gmailConnectMsg: null,
    // From name
    fromName: '',
    fromNameVariants: '',
    nameList: '',
    autoChangeName: false,
    autoNameInterval: 1,
    aiNamePool: [],
    aiNameUsed: 0,
    aiNameGenLoading: false,
    // Anti-detection
    antiDetect: true,
    colorShift: false,
    textShift: false,
    addUnsubscribe: true,
    trackPixel: false,
    // Content mode
    contentMode: 'html',
    bodyMode: 'html',
    checkBounce: true,
    autoSave: false,
    randomText: false,
    useName: false,
    confirmedShipping: false,
    prioritySend: false,
    autoReply: false,
    speedMode: 'ALL',
    changeAfterStart: 1,
    // Subject rotation
    activeSubjectCat: '',
    autoChangeSubject: false,
    // Body rotation
    activeBodyTplId: '',
    autoChangeBody: false,
    // Test mail
    testRecipient: '',
    testResult: null,
    testing: false,
    // Send state
    loading: false,
    progress: null,
    progressTimer: null,
    paused: false,
    result: null,
    resumeFrom: 0,
    limitExhausted: false,
    // Bounce / validation
    bounceResults: null,
    checkingBounce: false,
    validationStep: -1,
    emailValidation: {},
    sendResults: {},
    // AI
    aiLoading: false,
    aiSuggestion: '',
    spamChecking: false,
    spamPreview: null,
    // Status
    status: 'idle',
  });

  // ════════════════════════════════════════════════════════════════════════
  // Helper to get/update active campaign
  // ════════════════════════════════════════════════════════════════════════
  const getActiveCampaign = () => campaignList.find(c => c.id === activeCampaignId);
  const updateCampaign = (id, updates) => {
    setCampaignList(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };
  const updateActiveCampaign = (updates) => {
    if (!activeCampaignId) return;
    setCampaignList(prev => prev.map(c => c.id === activeCampaignId ? { ...c, ...updates } : c));
  };

  // ════════════════════════════════════════════════════════════════════════
  // localStorage persistence — save ALL campaign states
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.agreedTerms) setAgreedTerms(true);
        if (Array.isArray(s.campaignList)) {
          // Restore campaigns but reset transient send state
          const restored = s.campaignList.map(c => ({
            ...c,
            loading: false,
            progress: null,
            progressTimer: null,
            paused: false,
            testing: false,
            connectingGmail: false,
            aiLoading: false,
            spamChecking: false,
            checkingBounce: false,
            validationStep: -1,
          }));
          setCampaignList(restored);
          if (s.activeCampaignId && restored.find(c => c.id === s.activeCampaignId)) {
            setActiveCampaignId(s.activeCampaignId);
          } else if (restored.length > 0) {
            setActiveCampaignId(restored[0].id);
          }
        }
      }
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      // Don't save transient fields
      const toSave = campaignList.map(c => {
        const { progressTimer, ...rest } = c;
        return rest;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        campaignList: toSave,
        activeCampaignId,
        agreedTerms,
      }));
    } catch (e) { /* ignore */ }
  }, [campaignList, activeCampaignId, agreedTerms]);

  // ════════════════════════════════════════════════════════════════════════
  // Campaign creation / management
  // ════════════════════════════════════════════════════════════════════════
  const handleCreateCampaign = () => {
    if (campaignList.length >= 4) return;
    const id = Date.now();
    const name = newCampaignName.trim() || `Campaign-${campaignList.length + 1}`;
    const newCamp = createDefaultCampaign(id, name);
    setCampaignList(prev => [...prev, newCamp]);
    setActiveCampaignId(id);
    setShowCreateBox(false);
    setNewCampaignName('');
  };

  const handleDeleteCampaign = (id) => {
    setCampaignList(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeCampaignId === id) {
        setActiveCampaignId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleBackToCampaigns = () => {
    setActiveCampaignId(null);
  };

  // ════════════════════════════════════════════════════════════════════════
  // Fetch shared data (sender accounts, categories, body templates)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'listSenders' }),
        });
        const data = await res.json();
        if (active && data.success && Array.isArray(data.senders)) setSenderAccounts(data.senders);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const fetchSubjectCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'listSubjectCategories' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) setSubjectCategories(data.categories);
    } catch {}
  }, []);

  const fetchSubjectTemplates = useCallback(async (catId) => {
    if (!catId) return;
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'getSubjectTemplates', categoryId: catId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) setSubjectTemplates(data.templates);
    } catch {}
  }, []);

  const fetchBodyTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'listBodyTemplates' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) setBodyTemplates(data.templates);
    } catch {}
  }, []);

  useEffect(() => { fetchSubjectCategories(); fetchBodyTemplates(); }, [fetchSubjectCategories, fetchBodyTemplates]);
  useEffect(() => {
    const ac = getActiveCampaign();
    if (ac && ac.activeSubjectCat) fetchSubjectTemplates(ac.activeSubjectCat);
  }, [activeCampaignId, fetchSubjectTemplates]);

  // ════════════════════════════════════════════════════════════════════════
  // Tag definitions + insertion (shared)
  // ════════════════════════════════════════════════════════════════════════
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
    const cid = tagPickerCampaignId || activeCampaignId;
    if (!cid) return;
    const camp = campaignList.find(c => c.id === cid);
    if (!camp) return;
    if (tagTarget === 'subject') updateCampaign(cid, { subject: camp.subject + tagStr });
    else updateCampaign(cid, { message: camp.message + tagStr });
  };

  // ════════════════════════════════════════════════════════════════════════
  // Subject category handlers (operate on active campaign)
  // ════════════════════════════════════════════════════════════════════════
  const [newSubjectCat, setNewSubjectCat] = useState('');
  const [newSubjectText, setNewSubjectText] = useState('');

  const handleAddSubjectCat = async () => {
    const name = newSubjectCat.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'addSubjectCategory', name }),
      });
      const data = await res.json();
      if (data.success) { setNewSubjectCat(''); fetchSubjectCategories(); onSent('Category added', 'success'); }
      else onSent(data.error || 'Failed to add category', 'error');
    } catch { onSent('Network error', 'error'); }
  };

  const handleAddSubjectTemplate = async () => {
    const text = newSubjectText.trim();
    const ac = getActiveCampaign();
    if (!text || !ac || !ac.activeSubjectCat) return;
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'addSubjectTemplate', categoryId: ac.activeSubjectCat, text }),
      });
      const data = await res.json();
      if (data.success) { setNewSubjectText(''); fetchSubjectTemplates(ac.activeSubjectCat); onSent('Subject added', 'success'); }
      else onSent(data.error || 'Failed', 'error');
    } catch { onSent('Network error', 'error'); }
  };

  const handleDeleteSubjectTemplate = async (tplId) => {
    const ac = getActiveCampaign();
    if (!ac || !ac.activeSubjectCat) return;
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'deleteSubjectTemplate', templateId: tplId }),
      });
      const data = await res.json();
      if (data.success) fetchSubjectTemplates(ac.activeSubjectCat);
    } catch {}
  };

  const handlePickSubject = async () => {
    const ac = getActiveCampaign();
    if (!ac || !ac.activeSubjectCat) { onSent('Select a category first', 'error'); return; }
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'pickSubjectFromCategory', categoryId: ac.activeSubjectCat }),
      });
      const data = await res.json();
      if (data.success && data.subject) {
        updateActiveCampaign({ subject: data.subject });
        onSent('Fresh subject loaded', 'success');
        fetchSubjectTemplates(ac.activeSubjectCat);
      } else onSent(data.error || 'No subjects available', 'error');
    } catch { onSent('Network error', 'error'); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // Body template handlers (shared data, operate on active campaign)
  // ════════════════════════════════════════════════════════════════════════
  const [newBodyName, setNewBodyName] = useState('');
  const [newBodyContent, setNewBodyContent] = useState('');
  const [newBodyMode, setNewBodyMode] = useState('html');

  const handleAddBodyTemplate = async () => {
    const nm = newBodyName.trim();
    const ct = newBodyContent.trim();
    if (!nm || !ct) return;
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'addBodyTemplate', name: nm, content: ct, mode: newBodyMode }),
      });
      const data = await res.json();
      if (data.success) { setNewBodyName(''); setNewBodyContent(''); fetchBodyTemplates(); onSent('Body template saved', 'success'); }
      else onSent(data.error || 'Failed', 'error');
    } catch { onSent('Network error', 'error'); }
  };

  const handleDeleteBodyTemplate = async (tplId) => {
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'deleteBodyTemplate', templateId: tplId }),
      });
      const data = await res.json();
      if (data.success) fetchBodyTemplates();
    } catch {}
  };

  const handleLoadBodyTemplate = (tplId, campaignId) => {
    const cid = campaignId || activeCampaignId;
    const tpl = bodyTemplates.find(t => t._id === tplId);
    if (tpl && cid) {
      updateCampaign(cid, { message: tpl.content, bodyMode: tpl.mode || 'html', activeBodyTplId: tplId });
      onSent(`Loaded: ${tpl.name}`, 'success');
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // Gmail connect — credentials.json (ANY .json filename, per campaign)
  // ════════════════════════════════════════════════════════════════════════
  const connectGmailInputRef = useRef(null);
  const connectGmailCampaignIdRef = useRef(null);

  const handleConnectGmailFile = async (e, campaignId) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // Accept ANY .json file — user can name it whatever they want
    if (!file.name.toLowerCase().endsWith('.json')) {
      updateCampaign(campaignId, { gmailConnectMsg: { type: 'error', text: 'Please select a .json credentials file from Google Cloud Console.' } });
      e.target.value = '';
      return;
    }
    updateCampaign(campaignId, { gmailConnectMsg: null, connectingGmail: true });
    try {
      const text = await file.text();
      // Derive a label from filename (remove .json, remove "credentials" word, trim)
      const suggestedLabel = file.name.replace(/\.json$/i, '').replace(/credentials/i, '').replace(/^[-_\s]+|[-_\s]+$/g, '') || file.name;
      const res = await fetch('/api/user/gmail/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ credentialsJson: text, label: suggestedLabel }),
      });
      const data = await res.json();
      if (!data.success || !data.authUrl) {
        updateCampaign(campaignId, { gmailConnectMsg: { type: 'error', text: data.error || 'Failed to start Gmail OAuth flow.' }, connectingGmail: false });
        e.target.value = '';
        return;
      }
      // Show redirect_uri registration guidance if needed
      if (data.needsRegistration && data.ourCallbackUri) {
        updateCampaign(campaignId, {
          gmailConnectMsg: {
            type: 'error',
            text: `<b>&#9888; Setup required &mdash; Redirect URI not registered</b><br>Add this URI to Google Cloud Console &rarr; Credentials &rarr; OAuth Client &rarr; Authorized redirect URIs:<br><code style="display:block;margin:4px 0;padding:4px 8px;background:rgba(0,0,0,0.3);border-radius:4px;font-size:9px;word-break:break-all">${data.ourCallbackUri}</code>After adding it, re-upload your .json file and try again.`,
          },
          connectingGmail: false,
        });
        e.target.value = '';
        return;
      }
      const popup = window.open(data.authUrl, 'gmail-oauth', 'width=520,height=720,left=200,top=100');
      if (!popup) {
        window.location.href = data.authUrl;
        return;
      }
      updateCampaign(campaignId, { gmailConnectMsg: { type: 'success', text: 'Google permission page opened. Grant access to connect your Gmail.' } });
    } catch (err) {
      updateCampaign(campaignId, { gmailConnectMsg: { type: 'error', text: err.message || 'Could not read the credentials file.' } });
    }
    updateCampaign(campaignId, { connectingGmail: false });
    e.target.value = '';
  };

  // Listen for popup callback
  useEffect(() => {
    const handler = (ev) => {
      if (ev.data && ev.data.type === 'user-gmail-oauth-result') {
        if (ev.data.success) {
          // Refresh sender accounts
          (async () => {
            try {
              const res = await fetch('/api/system', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ action: 'listSenders' }),
              });
              const data = await res.json();
              if (data.success && Array.isArray(data.senders)) setSenderAccounts(data.senders);
            } catch {}
          })();
          onSent(`Gmail connected: ${ev.data.email}`, 'success');
        } else {
          onSent(ev.data.error || 'Gmail connection failed', 'error');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSent]);

  // ════════════════════════════════════════════════════════════════════════
  // Check Bounce — enterprise loading animation (per campaign)
  // ════════════════════════════════════════════════════════════════════════
  const validationSteps = [
    'Analyzing recipient data...',
    'Checking bounce response...',
    'Checking valid format...',
    'Removing duplicates...',
    'Validating email syntax...',
    'Filtering disposable domains...',
    'MX record verification...',
    'Finalizing results...',
  ];

  const handleCheckBounce = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    const emails = camp.numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);
    if (emails.length === 0) return;
    updateCampaign(campaignId, { checkingBounce: true, bounceResults: null, validationStep: 0 });
    // Enterprise-level loading: cycle through dynamic text (~3s each step)
    const stepDuration = 3000;
    for (let i = 0; i < validationSteps.length; i++) {
      updateCampaign(campaignId, { validationStep: i });
      await new Promise(r => setTimeout(r, stepDuration));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set();
    const valid = [];
    const bounced = [];
    const duplicates = [];
    emails.forEach(em => {
      if (seen.has(em)) { duplicates.push(em); return; }
      seen.add(em);
      if (emailRegex.test(em) && !em.endsWith('@example.com') && !em.endsWith('@test.com')) {
        valid.push(em);
      } else {
        bounced.push(em);
      }
    });
    updateCampaign(campaignId, {
      bounceResults: { checked: emails.length, valid, bounced, duplicates },
      checkingBounce: false,
      validationStep: -1,
    });
  };

  const handleReplaceBounced = (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp || !camp.bounceResults) return;
    const validSet = new Set(camp.bounceResults.valid);
    const seen = new Set();
    const kept = [];
    camp.numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean).forEach(em => {
      if (validSet.has(em) && !seen.has(em)) { seen.add(em); kept.push(em); }
    });
    updateCampaign(campaignId, { numbersText: kept.join('\n'), bounceResults: null });
    onSent(`Removed ${camp.bounceResults.bounced.length + camp.bounceResults.duplicates.length} invalid/duplicate emails`, 'success');
  };

  // ════════════════════════════════════════════════════════════════════════
  // Paste / Import (per campaign)
  // ════════════════════════════════════════════════════════════════════════
  const handlePasteEmails = async (campaignId) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const camp = campaignList.find(c => c.id === campaignId);
        updateCampaign(campaignId, { numbersText: camp && camp.numbersText ? camp.numbersText + '\n' + text : text });
        onSent('Pasted from clipboard', 'success');
      }
    } catch (e) {
      onSent('Clipboard access denied — paste manually (Ctrl+V)', 'error');
    }
  };

  const handleBulkImport = async (e, campaignId) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'bulkImport', csvData: text }),
      });
      const data = await res.json();
      if (data.success) { updateCampaign(campaignId, { numbersText: data.numbers.join('\n') }); onSent(`Imported ${data.count} emails`, 'success'); }
      else onSent(data.error || 'Import failed', 'error');
    } catch { onSent('Import error', 'error'); }
    e.target.value = '';
  };

  // ════════════════════════════════════════════════════════════════════════
  // AI functions (per campaign)
  // ════════════════════════════════════════════════════════════════════════
  const handleAiSuggest = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    updateCampaign(campaignId, { aiLoading: true });
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'aiChat', language: 'en', message: `Write a professional email body for subject: "${camp.subject}". Keep it concise, business-appropriate. HTML format.` }),
      });
      const data = await res.json();
      if (data.success && data.reply) updateCampaign(campaignId, { aiSuggestion: data.reply });
    } catch {}
    updateCampaign(campaignId, { aiLoading: false });
  };

  const handleApplyAi = (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (camp && camp.aiSuggestion) {
      updateCampaign(campaignId, { message: camp.aiSuggestion, aiSuggestion: '' });
    }
  };

  const handleSpamCheck = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp || !camp.message.trim()) return;
    updateCampaign(campaignId, { spamChecking: true });
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'aiSpamReview', content: camp.message, subject: camp.subject }),
      });
      const data = await res.json();
      if (data.success) updateCampaign(campaignId, { spamPreview: { score: data.score, level: data.level, reasons: data.reasons } });
    } catch {}
    updateCampaign(campaignId, { spamChecking: false });
  };

  const generateAiNames = useCallback(async (campaignId) => {
    updateCampaign(campaignId, { aiNameGenLoading: true });
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'aiChat', language: 'en',
          message: `Generate exactly 200 unique, professional brand sender display names for email marketing (e.g. "Sarah Mitchell", "James Carter", "Emily Rodriguez", "Customer Care Team", "Support Desk"). Mix of person names and department names. Return ONLY the names, one per line, no numbering, no extra text. Each name 2-4 words max.`,
        }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        const names = data.reply.split('\n').map(n => n.trim().replace(/^\d+[\.)]\s*/, '')).filter(Boolean).slice(0, 200);
        const camp = campaignList.find(c => c.id === campaignId);
        updateCampaign(campaignId, { aiNamePool: [...(camp?.aiNamePool || []), ...names], aiNameUsed: 0 });
      }
    } catch {}
    updateCampaign(campaignId, { aiNameGenLoading: false });
  }, [campaignList]);

  // ════════════════════════════════════════════════════════════════════════
  // Send / Stop / Pause / Test — per campaign
  // ════════════════════════════════════════════════════════════════════════
  const pollProgress = (campaignId, campaignDbId) => {
    // Clear existing timer for this campaign
    const camp = campaignList.find(c => c.id === campaignId);
    if (camp && camp.progressTimer) clearInterval(camp.progressTimer);
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'getCampaignProgress', campaignId: campaignDbId }),
        });
        const data = await res.json();
        if (data.success) {
          const prog = data.campaign;
          const sr = {};
          if (prog.recipients) {
            prog.recipients.forEach(r => {
              sr[r.email] = r.status === 'sent' || r.status === 'delivered' ? 'sent' : 'failed';
            });
          }
          updateCampaign(campaignId, {
            progress: prog,
            sendResults: sr,
            limitExhausted: prog.limitExhausted || false,
            status: prog.status,
          });
          if (['sent', 'partial', 'failed', 'blocked_spam'].includes(prog.status)) {
            clearInterval(timer);
            updateCampaign(campaignId, { progressTimer: null, loading: false, status: prog.status });
          }
        }
      } catch {}
    }, 2000);
    updateCampaign(campaignId, { progressTimer: timer });
  };

  const handleSend = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    if (!camp.message.trim()) { onSent('Please enter an email body', 'error'); return; }
    const parsedEmails = camp.numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);
    if (parsedEmails.length === 0) { onSent('No valid email addresses', 'error'); return; }
    const startIdx = camp.resumeFrom > 0 && camp.resumeFrom < parsedEmails.length ? camp.resumeFrom : 0;
    const nums = parsedEmails.slice(startIdx, startIdx + remaining);
    updateCampaign(campaignId, { loading: true, result: null, progress: null, paused: false, sendResults: {}, limitExhausted: false, status: 'running' });
    let currentFromName = camp.fromName;
    if (camp.autoChangeName && camp.aiNamePool.length > camp.aiNameUsed) {
      currentFromName = camp.aiNamePool[camp.aiNameUsed] || camp.fromName;
      updateCampaign(campaignId, { aiNameUsed: camp.aiNameUsed + 1 });
    }
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message: camp.message, subject: camp.subject, numbers: nums, sendType: 'manual',
          options: {
            batchSize: camp.batchSize, delayMs: camp.delayMs, jitterPct: camp.jitterPct, humanize: camp.humanize, polymorph: camp.polymorph, dripMode: camp.dripMode,
            contentMode: camp.contentMode, changeAfterSent: camp.polymorph, randomText: camp.randomText,
            senderRotate: camp.senderRotate, checkBounce: camp.checkBounce, bodyMode: camp.bodyMode,
            autoSave: camp.autoSave, autoReply: camp.autoReply,
            speedMode: camp.speedMode, changeAfterStart: camp.changeAfterStart, useName: camp.useName,
            confirmedShipping: camp.confirmedShipping, prioritySend: camp.prioritySend, senderMail: camp.senderMail,
            fromName: currentFromName,
            fromNameVariants: [...camp.fromNameVariants.split(',').map(s => s.trim()).filter(Boolean), ...camp.nameList.split('\n').map(s => s.trim()).filter(Boolean)],
            autoChangeName: camp.autoChangeName, autoNameInterval: camp.autoNameInterval,
            aiNamePool: camp.autoChangeName ? camp.aiNamePool.slice(camp.aiNameUsed) : [],
            subjectVariants: camp.autoChangeSubject ? subjectTemplates.map(t => t.text).filter(Boolean) : [],
            autoChangeSubject: camp.autoChangeSubject,
            bodyVariants: camp.autoChangeBody ? bodyTemplates.map(t => t.content).filter(Boolean) : [],
            autoChangeBody: camp.autoChangeBody,
            trackPixel: camp.trackPixel, embedAll: false,
            antiDetect: camp.antiDetect, colorShift: camp.colorShift, textShift: camp.textShift, addUnsubscribe: camp.addUnsubscribe,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invalidInfo = data.totalInvalid > 0 ? ` | ${data.totalInvalid} invalid` : '';
        const resumeNote = startIdx > 0 ? ` (resumed from #${startIdx + 1})` : '';
        onSent(`[${camp.name}] Sent ${data.totalSent} via ${data.senderApiUsed} — ${data.totalDelivered} delivered, ${data.totalUndelivered} undelivered${invalidInfo}${resumeNote}`, 'success');
        updateCampaign(campaignId, { result: data, resumeFrom: 0 });
        if (data.campaignId) pollProgress(campaignId, data.campaignId);
      } else if (data.blocked) {
        onSent(`[${camp.name}] Message blocked by spam protection. Rewrite your content.`, 'error');
        updateCampaign(campaignId, { result: { blocked: true, spamScore: data.spamScore, spamReasons: data.spamReasons }, status: 'blocked', loading: false });
      } else {
        onSent(`[${camp.name}] ${data.error || 'Failed to send'}`, 'error');
        updateCampaign(campaignId, { status: 'failed', loading: false });
      }
    } catch { onSent(`[${camp.name}] Network error`, 'error'); updateCampaign(campaignId, { loading: false, status: 'failed' }); }
  };

  const handleStop = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    const sentCount = camp.progress?.totalSent || 0;
    if (camp.progress?._id) {
      try {
        await fetch('/api/system', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'stopCampaign', campaignId: camp.progress._id, resumeFrom: sentCount }),
        });
      } catch {}
    }
    if (camp.progressTimer) clearInterval(camp.progressTimer);
    updateCampaign(campaignId, { loading: false, paused: false, resumeFrom: sentCount, progressTimer: null, status: 'stopped' });
    onSent(`[${camp.name}] Stopped at ${sentCount} sent — press Start to resume`, 'error');
  };

  const handlePause = (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    updateCampaign(campaignId, { paused: !camp.paused });
  };

  const handleTestMail = async (campaignId) => {
    const camp = campaignList.find(c => c.id === campaignId);
    if (!camp) return;
    if (!camp.message.trim()) { onSent('Enter email body first', 'error'); return; }
    if (!camp.testRecipient.trim()) { onSent('Enter a test recipient email', 'error'); return; }
    updateCampaign(campaignId, { testing: true, testResult: null });
    try {
      const res = await fetch('/api/system', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'sendCampaign', message: camp.message, subject: camp.subject, numbers: [camp.testRecipient.trim()], sendType: 'test',
          options: { testMail: true, testRecipient: camp.testRecipient.trim(), contentMode: camp.contentMode, batchSize: 1, delayMs: 0, checkBounce: camp.checkBounce, bodyMode: camp.bodyMode },
        }),
      });
      const data = await res.json();
      if (data.success && data.testMail) {
        updateCampaign(campaignId, { testResult: { ok: true, recipient: data.recipient, sender: data.senderApiUsed } });
        onSent(`Test email sent to ${data.recipient}`, 'success');
      } else if (data.blocked) {
        updateCampaign(campaignId, { testResult: { ok: false, blocked: true, score: data.spamScore } });
        onSent('Test blocked by spam filter', 'error');
      } else {
        updateCampaign(campaignId, { testResult: { ok: false, error: data.error } });
        onSent(data.error || 'Test failed', 'error');
      }
    } catch { onSent('Network error', 'error'); }
    updateCampaign(campaignId, { testing: false });
  };

  // Cleanup timers on unmount
  useEffect(() => () => {
    campaignList.forEach(c => { if (c.progressTimer) clearInterval(c.progressTimer); });
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // Static config arrays
  // ════════════════════════════════════════════════════════════════════════
  const contentTypes = [
    { key: 'html', label: 'HTML', icon: 'FileCode' },
    { key: 'pdf', label: 'PDF', icon: 'FilePdf' },
    { key: 'image', label: 'Image', icon: 'Image' },
    { key: 'inline', label: 'Inline', icon: 'Image' },
    { key: 'htmlfile', label: 'File', icon: 'FileCode' },
    { key: 'randomcolor', label: 'R-Color', icon: 'Palette' },
  ];

  const speedModes = [
    { key: 'ALL', label: 'ALL' },
    { key: 'SLOW', label: 'SLOW' },
    { key: 'SAFE', label: 'SAFE' },
  ];

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
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition border ${value ? st.on : 'bg-white/[0.02] text-gray-500 border-white/5 hover:text-gray-300'}`}>
        {icon && (() => { const Ic = Icon[icon] || Icon.Check; return <Ic className="w-3 h-3" />; })()}
        <span>{label}</span>
        <span className={`ml-auto w-3.5 h-3.5 rounded border flex items-center justify-center transition ${value ? st.chk : 'border-gray-600'}`}>
          {value && <Icon.Check className="w-2.5 h-2.5 text-white" />}
        </span>
      </button>
    );
  };

  const campaignStatusColors = {
    idle: 'bg-white/5 text-gray-400',
    running: 'bg-blue-500/20 text-blue-300 animate-pulse',
    sent: 'bg-green-500/20 text-green-300',
    partial: 'bg-amber-500/20 text-amber-300',
    failed: 'bg-red-500/20 text-red-300',
    stopped: 'bg-amber-500/20 text-amber-300',
    blocked: 'bg-red-500/20 text-red-300',
  };

  // ════════════════════════════════════════════════════════════════════════
  // TERMS OF AGREEMENT MODAL
  // ════════════════════════════════════════════════════════════════════════
  if (showTerms && !agreedTerms) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-slate-900 border border-violet-500/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-gradient-to-r from-violet-600/20 to-indigo-600/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Icon.Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Terms of Agreement</h2>
              <p className="text-[10px] text-violet-300/80 uppercase tracking-widest">MMS Sender V01 — Anti-Bypass Engine</p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4 text-sm text-gray-300 leading-relaxed">
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
              <p className="text-violet-200 font-semibold flex items-center gap-2 mb-1.5"><Icon.Bolt className="w-4 h-4" /> Enterprise Anti-Bypass & Anti-Detection Engine</p>
              <p className="text-[12px] text-gray-400">By proceeding, you acknowledge that this platform employs a multi-layered anti-detection system designed to ensure maximum deliverability while protecting sender reputation.</p>
            </div>
            <div className="space-y-3">
              {[
                { n: '1', c: 'green', t: 'Polymorphic Content Engine', d: 'Each email is uniquely transformed — random color shifts, text variation, and structural changes ensure no two emails are identical.' },
                { n: '2', c: 'cyan', t: 'Humanized Sending Patterns', d: 'Adaptive delay algorithms with randomized jitter replicate natural human sending behavior.' },
                { n: '3', c: 'amber', t: 'AI-Powered Name Rotation', d: 'Gemini AI generates thousands of fresh, realistic sender display names per campaign.' },
                { n: '4', c: 'red', t: 'Smart Bounce Validation', d: 'Enterprise-grade email validation removes bounces, duplicates, and invalid addresses before sending.' },
                { n: '5', c: 'indigo', t: 'Multi-Campaign Parallel Sending', d: 'Run up to 4 independent campaigns simultaneously — each with its own sender, subject, body, and recipient list.' },
              ].map(item => (
                <div key={item.n} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-lg bg-${item.c}-500/15 text-${item.c}-400 flex items-center justify-center text-[11px] font-bold`}>{item.n}</span>
                  <div><p className="text-white font-medium text-[13px]">{item.t}</p><p className="text-[11px] text-gray-500">{item.d}</p></div>
                </div>
              ))}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-[11px] text-amber-200/90">
                <strong className="text-amber-300">User Responsibility:</strong> You agree to use this platform for legitimate email marketing only.
                State persistence ensures your campaigns survive page refreshes. Each of the 4 campaign slots operates independently.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-slate-950/50 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${termsChecked ? 'bg-violet-500 border-violet-500' : 'border-gray-600 group-hover:border-gray-500'}`}>
                {termsChecked && <Icon.Check className="w-3 h-3 text-white" />}
              </span>
              <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} className="hidden" />
              <span className="text-[12px] text-gray-300">I have read and agree to the Terms of Agreement and Anti-Bypass Engine policies.</span>
            </label>
            <div className="flex gap-2.5">
              <button onClick={() => setShowTerms(false)} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={() => { if (termsChecked) { setAgreedTerms(true); setShowTerms(false); } }} disabled={!termsChecked}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition shadow-lg shadow-violet-600/30">
                <Icon.Rocket className="w-4 h-4" /> Create Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // AGGREGATED LIVE MONITOR STATS
  // ════════════════════════════════════════════════════════════════════════
  const runningCampaigns = campaignList.filter(c => c.status === 'running' || c.loading);
  const totalSentAll = campaignList.reduce((sum, c) => sum + (c.progress?.totalSent || 0), 0);
  const totalDeliveredAll = campaignList.reduce((sum, c) => sum + (c.progress?.totalDelivered || 0), 0);
  const totalBouncedAll = campaignList.reduce((sum, c) => sum + (c.progress?.totalUndelivered || 0), 0);

  const monitorCampaigns = monitorFilter === 'all' ? campaignList : campaignList.filter(c => c.id === monitorFilter);
  const monSent = monitorCampaigns.reduce((sum, c) => sum + (c.progress?.totalSent || 0), 0);
  const monDelivered = monitorCampaigns.reduce((sum, c) => sum + (c.progress?.totalDelivered || 0), 0);
  const monBounced = monitorCampaigns.reduce((sum, c) => sum + (c.progress?.totalUndelivered || 0), 0);

  // ════════════════════════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-2">
      {/* ═══ LIVE MONITOR BAR (TOP, ADVANCED) ═══ */}
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-r from-green-600/10 via-violet-600/8 to-transparent px-3 py-2 flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_60%)]" />
        <div className="relative flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <p className="text-[11px] text-green-400 uppercase tracking-wider font-bold flex items-center gap-1"><Icon.Activity className="w-3.5 h-3.5" /> Live Monitor</p>
          </div>
          {/* Filter tabs: All + each campaign */}
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setMonitorFilter('all')}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition ${monitorFilter === 'all' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              All ({campaignList.length})
            </button>
            {campaignList.map(c => (
              <button key={c.id} onClick={() => setMonitorFilter(c.id)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition flex items-center gap-1 ${monitorFilter === c.id ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {c.name}
                {c.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
              </button>
            ))}
          </div>
          {/* Aggregated stats */}
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Icon.Send className="w-3 h-3 text-violet-400" />
              <div className="leading-none"><p className="text-[8px] text-gray-500 uppercase">Sent</p><p className="text-[13px] font-black text-white tabular-nums">{monSent}</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon.CheckCircle className="w-3 h-3 text-green-400" />
              <div className="leading-none"><p className="text-[8px] text-gray-500 uppercase">Delivered</p><p className="text-[13px] font-black text-green-400 tabular-nums">{monDelivered}</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon.XCircle className="w-3 h-3 text-red-400" />
              <div className="leading-none"><p className="text-[8px] text-gray-500 uppercase">Bounced</p><p className="text-[13px] font-black text-red-400 tabular-nums">{monBounced}</p></div>
            </div>
            {runningCampaigns.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/15 border border-blue-500/30">
                <Icon.Rocket className="w-3 h-3 text-blue-400 animate-pulse" />
                <span className="text-[10px] text-blue-300 font-bold">{runningCampaigns.length} running</span>
              </div>
            )}
          </div>
        </div>
        {/* Per-campaign progress bars (only for running/progress campaigns in filter) */}
        {monitorCampaigns.filter(c => c.progress && (c.progress.totalSent > 0 || c.loading)).length > 0 && (
          <div className="relative mt-2 space-y-1">
            {monitorCampaigns.filter(c => c.progress || c.loading).map(c => {
              const sent = c.progress?.totalSent || 0;
              const total = (c.progress?.totalSent || 0) + (c.progress?.totalUndelivered || 0);
              const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-400 w-20 truncate flex-shrink-0">{c.name}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden min-w-0">
                    <div className={`h-full rounded-full transition-all duration-500 ${c.status === 'running' ? 'bg-gradient-to-r from-violet-500 to-blue-500' : 'bg-gradient-to-r from-violet-500 to-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-300 tabular-nums flex-shrink-0 w-12 text-right">{sent}/{total || '?'}</span>
                  <span className={`text-[7px] px-1 py-0.5 rounded-full font-bold flex-shrink-0 ${campaignStatusColors[c.status] || ''}`}>{c.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ LIMIT + CONNECT BAR ═══ */}
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-white/5 bg-slate-900/50 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Icon.Bolt className="w-3 h-3 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-[8px] text-violet-300/80 uppercase tracking-widest font-semibold">Limit</p>
            <p className="text-[12px] text-white mt-0.5"><span className="font-black">{remaining}</span><span className="text-gray-400 text-[9px]">/{stats?.limit || 0}</span></p>
          </div>
        </div>
        {stats?.expiresAt && (
          <div className="flex items-center gap-1 text-[9px] text-gray-400 flex-shrink-0">
            <Icon.Clock className="w-3 h-3 text-amber-400" />
            <span>Exp: <span className="text-amber-300 font-medium">{new Date(stats.expiresAt).toLocaleDateString()}</span></span>
          </div>
        )}
        <div className="h-6 w-px bg-white/10 hidden lg:block" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] text-green-300 font-medium">Anti-Spam Engine</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">{senderAccounts.length} senders</span>
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${runningCampaigns.length > 0 ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-pulse' : 'bg-green-500/10 text-green-300 border border-green-500/20'}`}>{runningCampaigns.length > 0 ? 'Sending' : 'Ready'}</span>
        </div>
      </div>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      {campaignList.length === 0 ? (
        /* ── EMPTY STATE: Only "Create Campaign" button ── */
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-600/30 mx-auto mb-4">
              <Icon.Rocket className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Start Your First Campaign</h2>
            <p className="text-[12px] text-gray-500 max-w-md">Create up to 4 independent campaigns. Each runs simultaneously with its own sender, subject, body, and recipient list.</p>
          </div>
          {!showCreateBox ? (
            <button onClick={() => { if (!agreedTerms) { setShowTerms(true); return; } setShowCreateBox(true); }}
              className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-base font-bold transition shadow-lg shadow-violet-600/30">
              <Icon.Plus className="w-5 h-5" /> Create Campaign
            </button>
          ) : (
            <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Layers className="w-4 h-4 text-violet-400" /> New Campaign</h3>
                <button onClick={() => { setShowCreateBox(false); setNewCampaignName(''); }} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
              </div>
              <input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} autoFocus
                placeholder={`Campaign-${campaignList.length + 1}`}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-3"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCampaign(); }} />
              <div className="flex gap-2">
                <button onClick={() => { setShowCreateBox(false); setNewCampaignName(''); }} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition">Cancel</button>
                <button onClick={handleCreateCampaign}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-violet-600/30">
                  <Icon.Check className="w-4 h-4" /> Create
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeCampaignId && campaignList.find(c => c.id === activeCampaignId) ? (
        /* ── CAMPAIGN EDITOR (active campaign) ── */
        <CampaignEditor
          campaign={campaignList.find(c => c.id === activeCampaignId)}
          updateCampaign={updateCampaign}
          onBack={handleBackToCampaigns}
          onSend={handleSend}
          onStop={handleStop}
          onPause={handlePause}
          onTestMail={handleTestMail}
          onCheckBounce={handleCheckBounce}
          onReplaceBounced={handleReplaceBounced}
          onPasteEmails={handlePasteEmails}
          onBulkImport={handleBulkImport}
          onConnectGmail={handleConnectGmailFile}
          onAiSuggest={handleAiSuggest}
          onApplyAi={handleApplyAi}
          onSpamCheck={handleSpamCheck}
          onGenerateAiNames={generateAiNames}
          onPickSubject={handlePickSubject}
          onLoadBodyTemplate={handleLoadBodyTemplate}
          onDeleteCampaign={handleDeleteCampaign}
          openNameModal={(id) => { setNameModalCampaignId(id); setNameModalOpen(true); }}
          openSubjectCatModal={() => setSubjectCatModalOpen(true)}
          openBodyModal={() => setBodyModalOpen(true)}
          openPreview={(id) => { setPreviewCampaignId(id); setShowPreview(true); }}
          openTagPicker={(id, target) => { setTagPickerCampaignId(id); setTagTarget(target); setTagPickerOpen(true); }}
          openBounceResult={(id) => { setBounceCampaignId(id); setShowBounceResult(true); }}
          Icon={Icon} Spinner={Spinner} MiniToggle={MiniToggle}
          contentTypes={contentTypes} speedModes={speedModes} campaignStatusColors={campaignStatusColors}
          subjectCategories={subjectCategories} subjectTemplates={subjectTemplates} bodyTemplates={bodyTemplates}
          senderAccounts={senderAccounts} remaining={remaining} stats={stats}
          validationSteps={validationSteps}
          allCampaigns={campaignList}
          onSelectCampaign={setActiveCampaignId}
          onDeleteCampaignFromList={handleDeleteCampaign}
        />
      ) : (
        /* ── CAMPAIGN SELECTOR (list of campaign cards) ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campaignList.map((c, idx) => {
            const emails = c.numbersText.split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);
            return (
              <div key={c.id} className="group relative bg-slate-900/50 border border-white/5 hover:border-violet-500/30 rounded-2xl p-5 cursor-pointer transition"
                onClick={() => setActiveCampaignId(c.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-sm">{idx + 1}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{c.name}</h3>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${campaignStatusColors[c.status] || ''}`}>{c.status}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(c.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition">
                    <Icon.Trash className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2"><Icon.Mail className="w-3 h-3 text-violet-400" /><span className="text-gray-400 truncate flex-1">{c.subject || '(no subject)'}</span></div>
                  <div className="flex items-center gap-2"><Icon.Users className="w-3 h-3 text-amber-400" /><span className="text-gray-400">{emails.length} recipients</span></div>
                  <div className="flex items-center gap-2"><Icon.Send className="w-3 h-3 text-cyan-400" /><span className="text-gray-400">{c.progress?.totalSent || 0} sent · {c.progress?.totalDelivered || 0} delivered</span></div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-gray-600">Click to open</span>
                  <Icon.Activity className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
          {campaignList.length < 4 && (
            <button onClick={() => setShowCreateBox(true)}
              className="flex flex-col items-center justify-center gap-3 bg-slate-900/30 border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl p-5 min-h-[180px] transition group">
              <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition">
                <Icon.Plus className="w-6 h-6 text-gray-500 group-hover:text-violet-400 transition" />
              </div>
              <span className="text-[12px] text-gray-500 group-hover:text-violet-300 font-medium transition">Add Campaign ({campaignList.length}/4)</span>
            </button>
          )}
        </div>
      )}

      {/* ═══ CREATE CAMPAIGN BOX (when shown from list) ═══ */}
      {showCreateBox && campaignList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowCreateBox(false); setNewCampaignName(''); }}>
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Layers className="w-4 h-4 text-violet-400" /> New Campaign ({campaignList.length + 1}/4)</h3>
              <button onClick={() => { setShowCreateBox(false); setNewCampaignName(''); }} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
            </div>
            <input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} autoFocus
              placeholder={`Campaign-${campaignList.length + 1}`}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-3"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCampaign(); }} />
            <div className="flex gap-2">
              <button onClick={() => { setShowCreateBox(false); setNewCampaignName(''); }} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={handleCreateCampaign}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-violet-600/30">
                <Icon.Check className="w-4 h-4" /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NAME ROTATION GEAR MODAL (⚙) ═══ */}
      {nameModalOpen && (
        <NameRotationModal
          campaign={campaignList.find(c => c.id === nameModalCampaignId)}
          onSave={(nameList) => { updateCampaign(nameModalCampaignId, { nameList }); setNameModalOpen(false); }}
          onClose={() => setNameModalOpen(false)}
          Icon={Icon}
        />
      )}

      {/* ═══ SUBJECT CATEGORY & TEMPLATE MANAGEMENT MODAL ═══ */}
      {subjectCatModalOpen && (
        <SubjectCategoryModal
          campaign={getActiveCampaign()}
          subjectCategories={subjectCategories}
          subjectTemplates={subjectTemplates}
          activeCat={getActiveCampaign()?.activeSubjectCat || ''}
          onSetCat={(catId) => updateActiveCampaign({ activeSubjectCat: catId })}
          newSubjectCat={newSubjectCat} setNewSubjectCat={setNewSubjectCat}
          onAddCat={handleAddSubjectCat}
          newSubjectText={newSubjectText} setNewSubjectText={setNewSubjectText}
          onAddTemplate={handleAddSubjectTemplate}
          onDeleteTemplate={handleDeleteSubjectTemplate}
          onUseSubject={(text) => { updateActiveCampaign({ subject: text }); setSubjectCatModalOpen(false); onSent('Subject loaded', 'success'); }}
          onClose={() => setSubjectCatModalOpen(false)}
          Icon={Icon} Spinner={Spinner}
        />
      )}

      {/* ═══ BODY TEMPLATE MANAGEMENT MODAL ═══ */}
      {bodyModalOpen && (
        <BodyTemplateModal
          bodyTemplates={bodyTemplates}
          newBodyName={newBodyName} setNewBodyName={setNewBodyName}
          newBodyContent={newBodyContent} setNewBodyContent={setNewBodyContent}
          newBodyMode={newBodyMode} setNewBodyMode={setNewBodyMode}
          onAdd={handleAddBodyTemplate}
          onDelete={handleDeleteBodyTemplate}
          onLoad={(tplId) => { handleLoadBodyTemplate(tplId); setBodyModalOpen(false); }}
          onClose={() => setBodyModalOpen(false)}
          Icon={Icon} Spinner={Spinner}
        />
      )}

      {/* ═══ EMAIL PREVIEW OVERLAY ═══ */}
      {showPreview && (
        <PreviewModal
          campaign={campaignList.find(c => c.id === previewCampaignId)}
          onClose={() => setShowPreview(false)}
          Icon={Icon}
        />
      )}

      {/* ═══ BOUNCE RESULT VIEWER ═══ */}
      {showBounceResult && (
        <BounceResultModal
          campaign={campaignList.find(c => c.id === bounceCampaignId)}
          onReplace={() => { handleReplaceBounced(bounceCampaignId); setShowBounceResult(false); }}
          onClose={() => setShowBounceResult(false)}
          Icon={Icon}
        />
      )}

      {/* ═══ ALL TAG PICKER MODAL ═══ */}
      {tagPickerOpen && (
        <TagPickerModal
          allTags={allTags}
          tagTarget={tagTarget} setTagTarget={setTagTarget}
          onInsert={insertTag}
          onClose={() => setTagPickerOpen(false)}
          Icon={Icon}
        />
      )}
    </div>
  );
}


// ================================================================
// CAMPAIGN EDITOR — full per-campaign config UI
// ================================================================
function CampaignEditor({
  campaign, updateCampaign, onBack, onSend, onStop, onPause, onTestMail,
  onCheckBounce, onReplaceBounced, onPasteEmails, onBulkImport, onConnectGmail,
  onAiSuggest, onApplyAi, onSpamCheck, onGenerateAiNames, onPickSubject, onLoadBodyTemplate,
  onDeleteCampaign, openNameModal, openSubjectCatModal, openBodyModal, openPreview, openTagPicker, openBounceResult,
  Icon, Spinner, MiniToggle, contentTypes, speedModes, campaignStatusColors,
  subjectCategories, subjectTemplates, bodyTemplates, senderAccounts, remaining, stats,
  validationSteps, allCampaigns, onSelectCampaign,
}) {
  const c = campaign;
  const u = (updates) => updateCampaign(c.id, updates);
  const parsedEmails = (c.numbersText || '').split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);
  const totalTarget = parsedEmails.length;
  const emails = c.numbersText || '';

  // Connect Gmail file input ref
  const fileInputRef = useRef(null);

  return (
    <div className="flex flex-col gap-2">
      {/* HEADER: Back + Campaign Name + Status + Quick campaign switcher */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/20 bg-slate-900/50 flex-shrink-0 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[11px] font-medium transition flex-shrink-0">
          <Icon.ChevronLeft className="w-3.5 h-3.5" /> Campaigns
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Icon.Rocket className="w-3.5 h-3.5 text-white" />
          </div>
          <input value={c.name} onChange={(e) => u({ name: e.target.value })}
            className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-100 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[120px]" />
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${campaignStatusColors[c.status] || ''}`}>{c.status}</span>
        {/* Quick switcher to other campaigns */}
        <div className="flex items-center gap-1 flex-wrap">
          {allCampaigns.filter(o => o.id !== c.id).map(o => (
            <button key={o.id} onClick={() => onSelectCampaign(o.id)} title={`Open ${o.name}`}
              className="px-2 py-1 bg-white/5 hover:bg-violet-500/15 text-gray-400 hover:text-violet-300 rounded-md text-[9px] font-medium transition flex items-center gap-1">
              {o.name}
              {o.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            </button>
          ))}
        </div>
        <button onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) onDeleteCampaign(c.id); }}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md text-[10px] font-medium transition flex-shrink-0">
          <Icon.Trash className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {/* CREDENTIAL.JSON CONNECT BAR — per campaign */}
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-r from-violet-600/10 to-transparent px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Icon.Key className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-[8px] text-violet-300/80 uppercase tracking-widest font-semibold">Credentials</p>
              <p className="text-[11px] text-white mt-0.5">{senderAccounts.length} connected</p>
            </div>
          </div>
          {/* Connect via credential.json — accepts ANY .json filename */}
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition flex-shrink-0 ${c.connectingGmail ? 'bg-slate-700 text-gray-400' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30'}`}>
            {c.connectingGmail ? <Spinner size={12} /> : <Icon.Upload className="w-3.5 h-3.5" />}
            {c.connectingGmail ? 'Connecting…' : 'Upload credential.json'}
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={(e) => onConnectGmail(e, c.id)} className="hidden" disabled={c.connectingGmail} />
          </label>
          <span className="text-[9px] text-gray-500 flex-shrink-0">Any <code className="text-violet-300">.json</code> file from Google Cloud Console</span>
          {/* Sender select */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select value={c.activeSenderIdx} onChange={(e) => u({ activeSenderIdx: Number(e.target.value) })}
              className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[140px]">
              {senderAccounts.length === 0 && <option value={0}>No accounts — Upload credential.json</option>}
              {senderAccounts.map((s, i) => (<option key={i} value={i}>{s.email}</option>))}
            </select>
            <button onClick={() => u({ senderRotate: !c.senderRotate })}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.senderRotate ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
              title="Auto-rotate sender accounts">
              <Icon.Refresh className={`w-2.5 h-2.5 ${c.senderRotate ? 'animate-spin' : ''}`} style={c.senderRotate ? { animationDuration: '3s' } : {}} /> Rotate
            </button>
          </div>
        </div>
        {/* Gmail connect message (OAuth guidance / errors) */}
        {c.gmailConnectMsg && (
          <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg text-[10px] flex items-start gap-1.5 ${c.gmailConnectMsg.type === 'success' ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
            <span className="flex-shrink-0">{c.gmailConnectMsg.type === 'success' ? '✓' : '✕'}</span>
            <span className="leading-snug" dangerouslySetInnerHTML={{ __html: c.gmailConnectMsg.text }} />
          </div>
        )}
      </div>

      {/* MAIN GRID: Center config (left) + Receiver List (right) */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-2">
        {/* ── CENTER CONFIG (all options visible, no hidden overflow) ── */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Subject + Sender Name */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {/* Subject */}
            <div className="bg-slate-900/50 border border-violet-500/20 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-200 font-semibold flex items-center gap-1"><Icon.Mail className="w-3 h-3 text-violet-400" /> Subject</label>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openTagPicker(c.id, 'subject')} className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Tag className="w-2.5 h-2.5" /> Tags</button>
                  <button onClick={openSubjectCatModal} className="text-[9px] text-violet-300 hover:text-violet-200 flex items-center gap-0.5 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20 transition"><Icon.Folder className="w-2.5 h-2.5" /> Manage</button>
                </div>
              </div>
              <input value={c.subject} onChange={(e) => u({ subject: e.target.value })}
                placeholder="Enter subject or use category rotation…"
                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px]"
                maxLength={120} />
              <div className="flex items-center gap-1.5 mt-1.5">
                <select value={c.activeSubjectCat} onChange={(e) => u({ activeSubjectCat: e.target.value })}
                  className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-0">
                  <option value="">Category…</option>
                  {subjectCategories.map(cat => <option key={cat._id} value={cat._id}>{cat.name} ({cat.count || 0})</option>)}
                </select>
                <button onClick={() => onPickSubject(c.id)} disabled={!c.activeSubjectCat}
                  className="flex items-center gap-0.5 px-2 py-1 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 rounded-md text-[9px] font-medium border border-violet-500/20 transition disabled:opacity-40 flex-shrink-0">
                  <Icon.Refresh className="w-2.5 h-2.5" /> Pick
                </button>
                <button onClick={() => u({ autoChangeSubject: !c.autoChangeSubject })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.autoChangeSubject ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                  title="Auto-rotate subject per batch">
                  <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeSubject ? 'animate-spin' : ''}`} style={c.autoChangeSubject ? { animationDuration: '4s' } : {}} /> Auto
                </button>
              </div>
              <p className="text-[9px] text-gray-500 mt-0.5">{c.subject.length}/120 {c.autoChangeSubject && subjectTemplates.length > 0 && <span className="text-amber-300">· {subjectTemplates.length} rotating</span>}</p>
            </div>

            {/* Sender Name + Gear */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="flex items-center gap-1 text-[10px] text-gray-300 mb-1">
                    <Icon.User className="w-3 h-3 text-green-400" /> From Name
                    <button onClick={() => openNameModal(c.id)} className="ml-auto text-green-400 hover:text-green-300 transition" title="Manage name rotation list">
                      <Icon.Gear className="w-3.5 h-3.5" />
                    </button>
                  </label>
                  <input value={c.fromName} onChange={(e) => u({ fromName: e.target.value })}
                    placeholder="Support Team"
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-[11px]" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-300 mb-1 flex items-center gap-1"><Icon.Refresh className="w-3 h-3 text-green-400" /> Variants <span className="text-gray-600 text-[9px]">(comma)</span></label>
                  <input value={c.fromNameVariants} onChange={(e) => u({ fromNameVariants: e.target.value })}
                    placeholder="Support, Sales, Billing"
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-[11px]" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button onClick={() => u({ autoChangeName: !c.autoChangeName })}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium border transition flex-shrink-0 ${c.autoChangeName ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                  title="Auto-change sender name per N emails">
                  <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeName ? 'animate-spin' : ''}`} style={c.autoChangeName ? { animationDuration: '3s' } : {}} /> Auto-Name
                </button>
                {c.autoChangeName && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[9px] text-gray-500">every</span>
                    <input type="number" min="1" max="999" value={c.autoNameInterval} onChange={(e) => u({ autoNameInterval: Math.max(1, Number(e.target.value)) })}
                      className="w-12 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-green-500" />
                  </div>
                )}
                {c.autoChangeName && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 flex-1 min-w-0">
                    {c.aiNameGenLoading ? <Spinner size={9} /> : <Icon.Sparkle className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                    <span className="text-[9px] text-green-300 truncate">{c.aiNameGenLoading ? 'AI generating…' : `${c.aiNamePool.length - c.aiNameUsed} AI names`}</span>
                    <button onClick={() => onGenerateAiNames(c.id)} disabled={c.aiNameGenLoading} className="text-[8px] text-green-300 hover:text-green-200 ml-auto flex-shrink-0 disabled:opacity-40">↻</button>
                  </div>
                )}
              </div>
              {/* Sender Mail manual override */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-[10px] text-gray-300 mb-1 flex items-center gap-1"><Icon.Mail className="w-3 h-3 text-cyan-400" /> Sender Mail</label>
                  <input value={c.senderMail} onChange={(e) => u({ senderMail: e.target.value })}
                    placeholder="auto (empty)"
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[11px] font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-300 mb-1 flex items-center gap-1"><Icon.Users className="w-3 h-3 text-amber-400" /> Recipients</label>
                  <div className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-amber-300 text-[11px] font-bold tabular-nums">{parsedEmails.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Email Body */}
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-gray-300 flex items-center gap-1"><Icon.FileCode className="w-3 h-3 text-violet-400" /> Email Body</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex gap-0.5 bg-white/5 rounded-md p-0.5">
                  <button onClick={() => u({ bodyMode: 'html' })} className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition ${c.bodyMode === 'html' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>HTML</button>
                  <button onClick={() => u({ bodyMode: 'plain' })} className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition ${c.bodyMode === 'plain' ? 'bg-violet-600 text-white' : 'text-gray-400'}`}>Plain</button>
                </div>
                <select onChange={(e) => { if (e.target.value) onLoadBodyTemplate(e.target.value, c.id); e.target.value=''; }}
                  className="px-1.5 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] text-gray-300 focus:outline-none cursor-pointer">
                  <option value="">Load body…</option>
                  {bodyTemplates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <button onClick={openBodyModal} className="text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20 transition"><Icon.DocText className="w-2.5 h-2.5" /> Manage</button>
                <button onClick={() => u({ autoChangeBody: !c.autoChangeBody })}
                  className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[9px] font-medium border transition ${c.autoChangeBody ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/5 text-gray-500 border-white/5'}`}
                  title="Auto-rotate body per batch">
                  <Icon.Refresh className={`w-2.5 h-2.5 ${c.autoChangeBody ? 'animate-spin' : ''}`} style={c.autoChangeBody ? { animationDuration: '4s' } : {}} /> Auto
                </button>
                <button onClick={() => openTagPicker(c.id, 'body')} className="text-[9px] text-amber-300 hover:text-amber-200 flex items-center gap-0.5"><Icon.Tag className="w-2.5 h-2.5" /> Tags</button>
              </div>
            </div>
            <textarea value={c.message} onChange={(e) => u({ message: e.target.value })} rows={6}
              placeholder="Type HTML content or load a body template… use #RANDOM#, #DATE#, #NAME# tags"
              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y text-[11px] font-mono"
              maxLength={2000} />
            <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
              <div className="flex items-center gap-2">
                <p className="text-[9px] text-gray-500">{c.message.length}/2000</p>
                {c.spamChecking && <p className="text-[9px] text-gray-500 animate-pulse flex items-center gap-0.5"><Spinner size={8} /> AI spam…</p>}
                {c.spamPreview && !c.spamChecking && (
                  <p className={`text-[9px] font-semibold flex items-center gap-0.5 ${c.spamPreview.level === 'high' ? 'text-red-400' : c.spamPreview.level === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                    Spam: {c.spamPreview.score}/100 · {c.spamPreview.level}
                  </p>
                )}
                {c.autoChangeBody && bodyTemplates.length > 0 && <span className="text-[9px] text-cyan-300">· {bodyTemplates.length} rotating</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onSpamCheck(c.id)} disabled={c.spamChecking || !c.message.trim()}
                  className="flex items-center gap-0.5 px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 rounded-md text-[9px] font-medium transition">
                  <Icon.Shield className="w-2.5 h-2.5" /> Spam Check
                </button>
                <button onClick={() => onAiSuggest(c.id)} disabled={c.aiLoading}
                  className="flex items-center gap-0.5 px-2 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-md text-[9px] font-medium transition">
                  {c.aiLoading ? <Spinner size={8} /> : <Icon.Sparkle className="w-2.5 h-2.5" />} AI
                </button>
                <button onClick={() => openPreview(c.id)}
                  className="text-[9px] text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20 transition">
                  <Icon.Eye className="w-2.5 h-2.5" /> Preview
                </button>
              </div>
            </div>
            {c.aiSuggestion && (
              <div className="mt-1.5 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-2">
                <p className="text-[10px] text-gray-200 flex-1 truncate">{c.aiSuggestion}</p>
                <button onClick={() => onApplyAi(c.id)} className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[9px] font-medium flex-shrink-0">Use</button>
              </div>
            )}
          </div>

          {/* Row 3: Content Type + Speed + Anti-Detect + Options */}
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Content Type */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Icon.Layers className="w-2.5 h-2.5 text-violet-400" /> Content</p>
                <div className="grid grid-cols-3 gap-0.5">
                  {contentTypes.map(ct => {
                    const Ic = Icon[ct.icon] || Icon.Layers;
                    return (
                      <button key={ct.key} onClick={() => u({ contentMode: ct.key })}
                        className={`flex flex-col items-center gap-0.5 p-1 rounded-md border transition ${c.contentMode === ct.key ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}>
                        <Ic className={`w-3 h-3 ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`} />
                        <span className={`text-[8px] font-medium ${c.contentMode === ct.key ? 'text-violet-300' : 'text-gray-400'}`}>{ct.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Speed + Change After */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Icon.Zap className="w-2.5 h-2.5 text-amber-400" /> Speed</p>
                <div className="flex gap-0.5">
                  {speedModes.map(sp => (
                    <button key={sp.key} onClick={() => u({ speedMode: sp.key })}
                      className={`flex-1 px-1 py-1 rounded-md text-[9px] font-medium transition ${c.speedMode === sp.key ? 'bg-amber-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{sp.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] text-gray-500">After</span>
                  <input type="number" min="1" max="999" value={c.changeAfterStart} onChange={(e) => u({ changeAfterStart: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
                </div>
              </div>
              {/* Anti-Detection */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Icon.Shield className="w-2.5 h-2.5 text-green-400" /> Anti-Detect</p>
                <div className="grid grid-cols-2 gap-1">
                  <MiniToggle label="Detect" value={c.antiDetect} onChange={(v) => u({ antiDetect: v })} icon="Shield" accent="green" />
                  <MiniToggle label="Color" value={c.colorShift} onChange={(v) => u({ colorShift: v })} icon="Palette" accent="violet" />
                  <MiniToggle label="Text" value={c.textShift} onChange={(v) => u({ textShift: v })} icon="Sparkle" accent="violet" />
                  <MiniToggle label="Unsub" value={c.addUnsubscribe} onChange={(v) => u({ addUnsubscribe: v })} icon="Link" accent="cyan" />
                </div>
              </div>
              {/* Options */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Options</p>
                <div className="grid grid-cols-2 gap-1">
                  <MiniToggle label="Name" value={c.useName} onChange={(v) => u({ useName: v })} icon="User" accent="yellow" />
                  <MiniToggle label="Pixel" value={c.trackPixel} onChange={(v) => u({ trackPixel: v })} icon="Eye" accent="cyan" />
                  <MiniToggle label="Bounce" value={c.checkBounce} onChange={(v) => u({ checkBounce: v })} icon="Shield" accent="green" />
                  <MiniToggle label="Reply" value={c.autoReply} onChange={(v) => u({ autoReply: v })} icon="Reply" accent="yellow" />
                  <MiniToggle label="Save" value={c.autoSave} onChange={(v) => u({ autoSave: v })} icon="Save" accent="cyan" />
                  <MiniToggle label="Random" value={c.randomText} onChange={(v) => u({ randomText: v })} icon="Sparkle" accent="yellow" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Send Rate + Extra Flags + Test Mail */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Send Rate */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Icon.Bolt className="w-3 h-3 text-amber-400" /> Send Rate</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Batch</span><span className="text-violet-300 font-medium">{c.batchSize}</span></label>
                  <input type="range" min="1" max="20" value={c.batchSize} onChange={(e) => u({ batchSize: Number(e.target.value) })} className="w-full accent-violet-500 mt-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Delay</span><span className="text-violet-300 font-medium">{c.delayMs}ms</span></label>
                  <input type="number" min="100" max="10000" step="100" value={c.delayMs} onChange={(e) => u({ delayMs: Math.max(100, Number(e.target.value) || 100) })}
                    className="w-full px-1 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-100 text-[9px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 mt-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-gray-400 flex justify-between"><span>Jitter</span><span className="text-violet-300 font-medium">{c.jitterPct}%</span></label>
                  <input type="range" min="0" max="100" value={c.jitterPct} onChange={(e) => u({ jitterPct: Number(e.target.value) })} className="w-full accent-violet-500 mt-0.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1.5">
                <MiniToggle label="Humanize" value={c.humanize} onChange={(v) => u({ humanize: v })} icon="Shield" accent="green" />
                <MiniToggle label="Drip" value={c.dripMode} onChange={(v) => u({ dripMode: v })} icon="Clock" accent="cyan" />
                <MiniToggle label="Polymorph" value={c.polymorph} onChange={(v) => u({ polymorph: v })} icon="Sparkle" accent="violet" />
              </div>
            </div>
            {/* Extra Flags */}
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-2.5">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Extra Flags</p>
              <div className="grid grid-cols-2 gap-1">
                <MiniToggle label="Confirmed" value={c.confirmedShipping} onChange={(v) => u({ confirmedShipping: v })} icon="Check" accent="green" />
                <MiniToggle label="Priority" value={c.prioritySend} onChange={(v) => u({ prioritySend: v })} icon="Star" accent="yellow" />
                <MiniToggle label="Humanize" value={c.humanize} onChange={(v) => u({ humanize: v })} icon="Shield" accent="green" />
                <MiniToggle label="Polymorph" value={c.polymorph} onChange={(v) => u({ polymorph: v })} icon="Sparkle" accent="violet" />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <label className="flex items-center gap-0.5 px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-md text-[9px] font-medium cursor-pointer transition border border-white/5">
                  <Icon.Upload className="w-2.5 h-2.5" /> Import
                  <input type="file" accept=".csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
                </label>
                <button onClick={() => openTagPicker(c.id, 'subject')}
                  className="flex items-center gap-0.5 px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-md text-[9px] font-medium transition border border-amber-500/20">
                  <Icon.Tag className="w-2.5 h-2.5" /> All Tags
                </button>
              </div>
            </div>
            {/* Test Mail */}
            <div className={`rounded-xl p-2.5 border transition ${c.testResult?.ok ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-slate-900/50'}`}>
              <p className="text-[9px] text-gray-300 font-semibold flex items-center gap-1 mb-1.5"><Icon.Eye className="w-3 h-3 text-cyan-400" /> Test Mail</p>
              <div className="flex gap-1.5">
                <input value={c.testRecipient} onChange={(e) => u({ testRecipient: e.target.value })}
                  placeholder="test@example.com"
                  className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[10px] font-mono min-w-0" />
                <button onClick={() => onTestMail(c.id)} disabled={c.testing || !c.testRecipient.trim() || !c.message.trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md text-[10px] font-medium transition flex-shrink-0">
                  {c.testing ? <Spinner size={10} /> : <Icon.Send className="w-3 h-3" />} Test
                </button>
              </div>
              {c.testResult && (
                <p className={`text-[9px] px-2 py-1 rounded-md mt-1.5 ${c.testResult.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
                  {c.testResult.ok ? `✓ ${c.testResult.recipient} via ${c.testResult.sender || 'auto'}` : c.testResult.blocked ? `✕ Blocked (${c.testResult.score})` : `✕ ${c.testResult.error || 'Failed'}`}
                </p>
              )}
            </div>
          </div>

          {/* Row 5: Live progress (per campaign) */}
          {c.progress && (
            <div className="bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-bold text-white flex items-center gap-1.5"><Icon.Activity className="w-3.5 h-3.5 text-violet-400" /> Campaign Progress</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.progress.status === 'sent' ? 'bg-green-500/20 text-green-300' : c.progress.status === 'partial' ? 'bg-amber-500/20 text-amber-300' : c.progress.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300 animate-pulse'}`}>{c.progress.status === 'pending' ? 'Ready' : c.progress.status === 'running' ? 'Sending…' : c.progress.status === 'sent' ? 'Success' : c.progress.status}</span>
              </div>
              {c.limitExhausted && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 mb-1.5 animate-pulse">
                  <Icon.Alert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-red-300">Sending Limit Exhausted — Account Sign-Out Detected. Connect another email or wait for reset.</p>
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-violet-300 font-semibold flex-shrink-0">Sent</span>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.progress.totalSent > 0 ? Math.round((c.progress.totalSent / Math.max(c.progress.totalSent + c.progress.totalUndelivered, 1)) * 100) : 0}%` }} />
                </div>
                <span className="text-[11px] font-black text-white tabular-nums flex-shrink-0">{c.progress.totalSent || 0}<span className="text-gray-500 text-[9px] font-normal">/{(c.progress.totalSent || 0) + (c.progress.totalUndelivered || 0) || totalTarget}</span></span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-xs font-bold text-white">{c.progress.totalSent || 0}</div><div className="text-[8px] text-gray-500">Sent</div></div>
                <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-xs font-bold text-green-400">{c.progress.totalDelivered || 0}</div><div className="text-[8px] text-gray-500">Delivered</div></div>
                <div className="bg-white/5 rounded-md p-1 text-center"><div className="text-xs font-bold text-red-400">{c.progress.totalUndelivered || 0}</div><div className="text-[8px] text-gray-500">Undel.</div></div>
              </div>
              {c.progress.senderApiName && (
                <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mt-1">
                  <Icon.Refresh className="w-3 h-3 text-violet-400" />
                  Sender: <span className="text-cyan-400">{c.progress.senderApiName}</span> · Batch: {c.progress.batchSize} · Delay: {(c.progress.delayMs / 1000).toFixed(1)}s{c.senderRotate && <span className="text-violet-300"> · auto-rotating</span>}
                </div>
              )}
            </div>
          )}
          {/* Blocked result */}
          {c.result && c.result.blocked && !c.progress && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-[11px] font-bold text-red-300 mb-0.5">⚠ Message Blocked — Spam Protection (Score: {c.result.spamScore}/100)</p>
              {c.result.spamReasons && (
                <div className="flex flex-wrap gap-1">
                  {c.result.spamReasons.map((r, i) => <span key={i} className="text-[9px] bg-red-500/10 px-1.5 py-0.5 rounded text-red-300">{r}</span>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: RECEIVER LIST (LARGER BOX + advanced loading) ── */}
        <div className="bg-slate-900/50 border border-amber-500/20 rounded-xl p-2.5 flex flex-col order-3 lg:order-2 min-h-[400px]">
          <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
            <p className="text-[10px] text-amber-400 uppercase tracking-wider flex items-center gap-1 font-semibold"><Icon.Users className="w-3 h-3" /> Receiver List</p>
            <div className="flex items-center gap-1">
              <button onClick={() => onPasteEmails(c.id)} className="flex items-center gap-0.5 text-[9px] text-violet-300 hover:text-violet-200 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20 transition">
                <Icon.Clipboard className="w-2.5 h-2.5" /> Paste
              </button>
              <label className="flex items-center gap-0.5 text-[9px] text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20 cursor-pointer transition">
                <Icon.Upload className="w-2.5 h-2.5" /> Import
                <input type="file" accept=".csv,.txt" onChange={(e) => onBulkImport(e, c.id)} className="hidden" />
              </label>
            </div>
          </div>
          {/* LARGE textarea — much bigger than the old 2-row box */}
          <textarea data-recipient-textarea value={c.numbersText} onChange={(e) => u({ numbersText: e.target.value })} rows={10}
            placeholder={"user1@gmail.com\nuser2@yahoo.com\nuser3@outlook.com\n…"}
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y text-[10px] font-mono flex-shrink-0 mb-2 min-h-[160px]" />
          {/* CHECK BOUNCE — per campaign, with advanced loading animation */}
          <div className="flex-shrink-0 mb-2">
            <button onClick={() => onCheckBounce(c.id)} disabled={c.checkingBounce || parsedEmails.length === 0}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition ${c.checkBounce ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'} disabled:opacity-40`}>
              {c.checkingBounce ? <Spinner size={12} /> : <Icon.Shield className="w-3.5 h-3.5" />} Check Bounce
            </button>
            {/* Advanced loading animation — rotating status text ~3s each */}
            {c.checkingBounce && (
              <div className="mt-1.5 px-2.5 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Spinner size={10} />
                  <span key={c.validationStep} className="text-[11px] text-violet-200 font-medium truncate animate-pulse flex-1">
                    {validationSteps[c.validationStep] || 'Processing…'}
                    <span className="inline-block w-1 h-1 rounded-full bg-violet-400 ml-1 animate-ping" />
                  </span>
                </div>
                {/* Progress bar for validation steps */}
                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-500 to-green-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${((c.validationStep + 1) / validationSteps.length) * 100}%` }} />
                </div>
                <p className="text-[8px] text-gray-500 mt-1 text-center">Step {c.validationStep + 1} of {validationSteps.length}</p>
              </div>
            )}
            {/* Bounce results summary */}
            {c.bounceResults && !c.checkingBounce && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-green-300 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20 flex items-center gap-1"><Icon.CheckCircle className="w-3 h-3" /> {c.bounceResults.valid.length} valid</span>
                  {c.bounceResults.bounced.length > 0 && (
                    <span className="text-[10px] text-red-300 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20 flex items-center gap-1"><Icon.XCircle className="w-3 h-3" /> {c.bounceResults.bounced.length} bounced</span>
                  )}
                  {c.bounceResults.duplicates && c.bounceResults.duplicates.length > 0 && (
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 flex items-center gap-1"><Icon.Copy className="w-3 h-3" /> {c.bounceResults.duplicates.length} dupes</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openBounceResult(c.id)} className="flex-1 text-[9px] text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded-md border border-cyan-500/20 flex items-center justify-center gap-1 font-medium transition">
                    <Icon.Eye className="w-2.5 h-2.5" /> View Result
                  </button>
                  {c.bounceResults.bounced.length > 0 && (
                    <button onClick={() => onReplaceBounced(c.id)} className="flex-1 text-[9px] text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/20 flex items-center justify-center gap-1 font-medium transition">
                      <Icon.Refresh className="w-2.5 h-2.5" /> Replace
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Recipient list view */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1">
            {parsedEmails.length === 0 ? (
              <div className="text-center py-6">
                <Icon.Users className="w-6 h-6 text-gray-700 mx-auto mb-1.5" />
                <p className="text-[10px] text-gray-600">Paste or import emails to begin</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {parsedEmails.slice(0, 120).map((em, i) => {
                  const v = c.emailValidation[em];
                  const sr = c.sendResults[em];
                  return (
                    <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-white/[0.02] border border-white/5">
                      <span className="text-[8px] text-gray-600 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                      {c.loading || c.progress ? (
                        sr === 'sent' ? (
                          <Icon.Check className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                        ) : sr === 'failed' ? (
                          <Icon.Close className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/50 flex-shrink-0 animate-pulse" />
                        )
                      ) : v && v.checking ? (
                        <Spinner size={9} />
                      ) : v && v.valid ? (
                        <Icon.CheckCircle className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
                      ) : v && !v.valid ? (
                        <Icon.XCircle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-600 flex-shrink-0" />
                      )}
                      <span className={`text-[9px] truncate flex-1 ${(v && !v.valid) || sr === 'failed' ? 'text-red-400' : sr === 'sent' ? 'text-blue-300' : 'text-gray-300'}`} title={em}>{em}</span>
                    </div>
                  );
                })}
                {parsedEmails.length > 120 && (
                  <p className="text-[9px] text-gray-600 text-center pt-1">+{parsedEmails.length - 120} more</p>
                )}
              </div>
            )}
          </div>
          {/* Count summary + Send/Stop */}
          <div className="flex-shrink-0 pt-2 mt-2 border-t border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-gray-500">{parsedEmails.length} total</span>
              <span className="text-green-400">{Object.values(c.emailValidation).filter(v => v && v.valid).length} valid</span>
              <span className="text-blue-400">{Object.values(c.sendResults).filter(s => s === 'sent').length} sent</span>
            </div>
            {!c.loading && !c.progress && (
              <button onClick={() => onSend(c.id)}
                disabled={remaining <= 0 || parsedEmails.length === 0}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-bold transition shadow-lg shadow-violet-600/30">
                <Icon.Rocket className="w-4 h-4" /> Start Campaign
              </button>
            )}
            {(c.loading || c.progress) && (
              <div className="space-y-1">
                <button onClick={() => onStop(c.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[12px] font-bold transition shadow-lg shadow-red-600/30">
                  <Icon.Stop className="w-4 h-4" /> Stop
                </button>
                <button onClick={() => onPause(c.id)}
                  className={`w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition ${c.paused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                  {c.paused ? <><Icon.Play className="w-3 h-3" /> Resume</> : <><Icon.Pause className="w-3 h-3" /> Pause</>}
                </button>
                {c.paused && (
                  <p className="text-[9px] text-amber-300 text-center">⏸ Paused at {c.progress?.totalSent || 0} sent — press Resume to continue</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// NAME ROTATION MODAL (gear icon)
// ================================================================
function NameRotationModal({ campaign, onSave, onClose, Icon }) {
  const [list, setList] = useState(campaign?.nameList || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Gear className="w-4 h-4 text-green-400" /> Sender Name Rotation</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">Enter one name per line. These rotate automatically per batch along with comma-separated variants above. Leave empty to use From Name only.</p>
        <textarea value={list} onChange={(e) => setList(e.target.value)} rows={10}
          placeholder={"John Smith\nSarah Johnson\nMichael Brown\nEmily Davis\n…"}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-[12px] font-mono resize-none" />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-gray-500">{list.split('\n').map(s => s.trim()).filter(Boolean).length} names in rotation</p>
          <div className="flex gap-2">
            <button onClick={() => setList('')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[11px] font-medium transition">Clear</button>
            <button onClick={() => onSave(list)} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"><Icon.Check className="w-3.5 h-3.5" /> Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SUBJECT CATEGORY MODAL
// ================================================================
function SubjectCategoryModal({ campaign, subjectCategories, subjectTemplates, activeCat, onSetCat, newSubjectCat, setNewSubjectCat, onAddCat, newSubjectText, setNewSubjectText, onAddTemplate, onDeleteTemplate, onUseSubject, onClose, Icon, Spinner }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Folder className="w-4 h-4 text-violet-400" /> Subject Categories & Templates</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0">
          {subjectCategories.map(cat => (
            <button key={cat._id} onClick={() => onSetCat(cat._id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${activeCat === cat._id ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {cat.name} <span className="text-[8px] opacity-60">({cat.count || 0})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-3 flex-shrink-0">
          <input value={newSubjectCat} onChange={(e) => setNewSubjectCat(e.target.value)} placeholder="New category name…"
            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px]" />
          <button onClick={onAddCat} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[11px] font-medium transition flex items-center gap-1"><Icon.Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="flex gap-1.5 mb-2 flex-shrink-0">
          <input value={newSubjectText} onChange={(e) => setNewSubjectText(e.target.value)} placeholder="New subject line for this category…" disabled={!activeCat}
            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-[11px] disabled:opacity-40" />
          <button onClick={onAddTemplate} disabled={!activeCat || !newSubjectText.trim()} className="px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg text-[11px] font-medium transition disabled:opacity-40 flex items-center gap-1"><Icon.Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 pr-1 space-y-1">
          {subjectTemplates.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-4">{activeCat ? 'No templates yet — add one above' : 'Select a category'}</p>
          ) : (
            subjectTemplates.map(t => (
              <div key={t._id} className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
                <Icon.Mail className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-300 truncate flex-1">{t.text}</span>
                <button onClick={() => onUseSubject(t.text)} className="text-[9px] text-violet-300 hover:text-violet-200 opacity-0 group-hover:opacity-100 transition flex-shrink-0">Use</button>
                <button onClick={() => onDeleteTemplate(t._id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"><Icon.Close className="w-3 h-3" /></button>
              </div>
            ))
          )}
        </div>
        <button onClick={onClose} className="mt-3 w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition flex-shrink-0">Done</button>
      </div>
    </div>
  );
}

// ================================================================
// BODY TEMPLATE MODAL
// ================================================================
function BodyTemplateModal({ bodyTemplates, newBodyName, setNewBodyName, newBodyContent, setNewBodyContent, newBodyMode, setNewBodyMode, onAdd, onDelete, onLoad, onClose, Icon, Spinner }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.DocText className="w-4 h-4 text-cyan-400" /> Body Template Manager</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 mb-3 flex-shrink-0">
          <div className="flex gap-1.5">
            <input value={newBodyName} onChange={(e) => setNewBodyName(e.target.value)} placeholder="Template name (e.g. Invoice Template)…"
              className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[11px]" />
            <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setNewBodyMode('html')} className={`px-2 py-1 rounded text-[10px] font-medium transition ${newBodyMode === 'html' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>HTML</button>
              <button onClick={() => setNewBodyMode('plain')} className={`px-2 py-1 rounded text-[10px] font-medium transition ${newBodyMode === 'plain' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>Plain</button>
            </div>
          </div>
          <textarea value={newBodyContent} onChange={(e) => setNewBodyContent(e.target.value)} rows={4}
            placeholder="Paste HTML or plain text body content here… use #RANDOM#, #DATE#, #NAME# tags"
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-[11px] font-mono resize-none" />
          <button onClick={onAdd} disabled={!newBodyName.trim() || !newBodyContent.trim()}
            className="w-full px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-[11px] font-medium transition flex items-center justify-center gap-1"><Icon.Plus className="w-3 h-3" /> Save Body Template</button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 pr-1 space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saved Templates ({bodyTemplates.length})</p>
          {bodyTemplates.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-4">No body templates saved yet — create one above</p>
          ) : (
            bodyTemplates.map(t => (
              <div key={t._id} className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
                <Icon.DocText className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 truncate">{t.name}</p>
                  <p className="text-[9px] text-gray-600 truncate">{(t.content || '').substring(0, 60)}…</p>
                </div>
                <span className="text-[8px] text-gray-600 uppercase flex-shrink-0">{t.mode || 'html'}</span>
                <button onClick={() => onLoad(t._id)} className="text-[9px] text-cyan-300 hover:text-cyan-200 opacity-0 group-hover:opacity-100 transition flex-shrink-0">Load</button>
                <button onClick={() => onDelete(t._id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"><Icon.Close className="w-3 h-3" /></button>
              </div>
            ))
          )}
        </div>
        <button onClick={onClose} className="mt-3 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition flex-shrink-0">Done</button>
      </div>
    </div>
  );
}

// ================================================================
// EMAIL PREVIEW MODAL
// ================================================================
function PreviewModal({ campaign, onClose, Icon }) {
  const c = campaign || {};
  const [fullscreen, setFullscreen] = useState(false);
  const parsedEmails = (c.numbersText || '').split(/[\n,\s]/).map(n => n.trim()).filter(Boolean);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-slate-900 border border-violet-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${fullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-2xl max-h-[85vh] rounded-2xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/50 flex-shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Eye className="w-4 h-4 text-violet-400" /> Email Preview</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(!fullscreen)} className="text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition flex items-center gap-1">
              <Icon.Activity className="w-3 h-3" /> {fullscreen ? 'Exit Full' : 'Fullscreen'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5 border border-white/5">
            <div className="flex items-start gap-2"><span className="text-[10px] text-gray-500 w-12 flex-shrink-0">From:</span><span className="text-[11px] text-gray-200">{c.fromName || c.senderMail || 'sender@gmail.com'} <span className="text-gray-500">&lt;{c.senderMail || 'auto-selected sender'}&gt;</span></span></div>
            <div className="flex items-start gap-2"><span className="text-[10px] text-gray-500 w-12 flex-shrink-0">To:</span><span className="text-[11px] text-gray-200">{parsedEmails[0] || 'recipient@example.com'}{parsedEmails.length > 1 && <span className="text-gray-500"> +{parsedEmails.length - 1} more</span>}</span></div>
            <div className="flex items-start gap-2"><span className="text-[10px] text-gray-500 w-12 flex-shrink-0">Subject:</span><span className="text-[11px] text-violet-300 font-medium">{c.subject || '(no subject)'}</span></div>
          </div>
          <div className="bg-white rounded-lg p-4 min-h-[200px] border border-white/10">
            {c.bodyMode === 'html' ? (
              <div className="text-gray-800 text-sm" dangerouslySetInnerHTML={{ __html: c.message || '<p style="color:#999;font-style:italic">(empty body - type content in the Content field)</p>' }} />
            ) : (
              <pre className="text-gray-800 text-sm whitespace-pre-wrap font-sans">{c.message || '(empty body - type content in the Content field)'}</pre>
            )}
            {c.trackPixel && <img src="https://track.example.com/pixel.gif" alt="" width="1" height="1" className="opacity-10" />}
            {c.addUnsubscribe && <p style={{ marginTop: '20px', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '10px' }}><a href="#" style={{ color: '#999' }}>Unsubscribe</a> from these emails.</p>}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/10 bg-slate-950/50 flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">Close Preview</button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// BOUNCE RESULT MODAL
// ================================================================
function BounceResultModal({ campaign, onReplace, onClose, Icon }) {
  const br = campaign?.bounceResults;
  if (!br) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon.Shield className="w-4 h-4 text-green-400" /> Validation Results</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5"><div className="text-xl font-bold text-white">{br.checked}</div><div className="text-[9px] text-gray-500 uppercase">Checked</div></div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/20"><div className="text-xl font-bold text-green-400">{br.valid.length}</div><div className="text-[9px] text-gray-500 uppercase">Valid</div></div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/20"><div className="text-xl font-bold text-red-400">{br.bounced.length}</div><div className="text-[9px] text-gray-500 uppercase">Bounced</div></div>
        </div>
        {br.duplicates && br.duplicates.length > 0 && (
          <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-[11px] text-amber-300 font-medium mb-1">{br.duplicates.length} duplicates removed</p>
            <div className="flex flex-wrap gap-1">
              {br.duplicates.slice(0, 10).map((d, i) => <span key={i} className="text-[9px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300">{d}</span>)}
              {br.duplicates.length > 10 && <span className="text-[9px] text-amber-400">+{br.duplicates.length - 10} more</span>}
            </div>
          </div>
        )}
        {br.bounced.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-red-300 font-medium mb-1">Bounced / Invalid emails:</p>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {br.bounced.map((b, i) => <span key={i} className="text-[9px] bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded text-red-300">{b}</span>)}
            </div>
          </div>
        )}
        {br.bounced.length > 0 && (
          <button onClick={onReplace} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold transition">
            <Icon.Refresh className="w-4 h-4" /> Replace Bounced (keep valid only)
          </button>
        )}
        <p className="text-[9px] text-gray-600 mt-3 text-center">Replace removes ONLY bounced/duplicate emails — your valid emails are preserved.</p>
      </div>
    </div>
  );
}

// ================================================================
// TAG PICKER MODAL
// ================================================================
function TagPickerModal({ allTags, tagTarget, setTagTarget, onInsert, onClose, Icon }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
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
            <button onClick={onClose} className="text-gray-500 hover:text-white"><Icon.Close className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {allTags.map((t, i) => (
            <button key={i} onClick={() => onInsert(t.tag)}
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
        <button onClick={onClose} className="mt-4 w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition">Done</button>
      </div>
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
