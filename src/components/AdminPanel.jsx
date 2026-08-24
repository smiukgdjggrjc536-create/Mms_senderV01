'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';

// ───────────────────────────────────────────────────────────────────────────
// Global Loading Context — enterprise overlay
// ───────────────────────────────────────────────────────────────────────────
const LoadingCtx = createContext(null);
function useLoading() { return useContext(LoadingCtx); }

// ============================================================================
// ICON COMPONENTS (professional SVG, no emoji)
// ============================================================================
const Icon = {
  Dashboard: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>),
  Api: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>),
  Users: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>),
  Campaign: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>),
  Content: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>),
  Shield: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>),
  Settings: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>),
  Bell: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>),
  Log: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>),
  Database: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>),
  Lock: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>),
  Refresh: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>),
  Eye: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>),
  EyeOff: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>),
  Plus: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>),
  Trash: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>),
  Check: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>),
  Logout: () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>),
  Send: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>),
  Activity: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>),
  Zap: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>),
  Beaker: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.171.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.878 3.298-.6 4.036a16.875 16.875 0 01-8.187 2.012 16.875 16.875 0 01-8.187-2.012c-1.478-.738-1.832-2.804-.6-4.036L5 14.5"/></svg>),
  Globe: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9s-2.015-9-4.5-9m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m-9 9h18"/></svg>),
  Phone: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>),
  Server: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6"/></svg>),
  Bolt: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>),
  Mail: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>),
  Key: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H3.75v-2.25H6v-2.25H8.25V15l1.5-1.5c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>),
  Rocket: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.07v-4.76m5.84-2.31a7.12 7.12 0 00.74-.84 6 6 0 01.7-.86 35.16 35.16 0 018.5-6.18c.97 2.184 1.47 4.537 1.47 6.918a14.5 14.5 0 01-2.65 8.4m-6.6-2.4a6 6 0 01-5.7-6.7m6.6 2.4l-4.5-2.7m6.6 2.4v-4.5"/></svg>),
  List: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>),
  X: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>),
  Edit: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>),
  Save: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V7.5a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3.75m0 0A2.25 2.25 0 006 6v12a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 18V6a2.25 2.25 0 00-1.5-2.25H8.25z"/></svg>),
  Alert: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>),
  Info: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>),
  Chart: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>),
  Message: () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>),
};

// Wrapper component: <IconByName name="bolt" size={18} className="..." />
const ICON_MAP = {
  dashboard: Icon.Dashboard, api: Icon.Api, users: Icon.Users, campaign: Icon.Campaign,
  content: Icon.Content, shield: Icon.Shield, settings: Icon.Settings, bell: Icon.Bell,
  log: Icon.Log, database: Icon.Database, lock: Icon.Lock, refresh: Icon.Refresh,
  eye: Icon.Eye, eyeoff: Icon.EyeOff, plus: Icon.Plus, trash: Icon.Trash, check: Icon.Check,
  logout: Icon.Logout, send: Icon.Send, activity: Icon.Activity, zap: Icon.Zap, beaker: Icon.Beaker,
  globe: Icon.Globe, phone: Icon.Phone, server: Icon.Server, bolt: Icon.Bolt, mail: Icon.Mail,
  key: Icon.Key, rocket: Icon.Rocket, list: Icon.List, x: Icon.X, edit: Icon.Edit, save: Icon.Save,
  alert: Icon.Alert, info: Icon.Info, chart: Icon.Chart, message: Icon.Message,
};
function IconByName({ name, size, className }) {
  const C = ICON_MAP[name] || Icon.Info;
  return <C />;
}

// ============================================================================
// COUNTRY + CARRIER REFERENCE DATA (used across gateway + validator panels)
// ============================================================================
const COUNTRY_CODES = [
  { code: '+1', dial: '1', name: 'USA / Canada', flag: '🇺🇸', mms: true, note: 'AT&T, Verizon, T-Mobile, Sprint, US Cellular, Cricket, MetroPCS, Google Fi, Mint, Xfinity, Tracfone, Straight Talk' },
  { code: '+44', dial: '44', name: 'United Kingdom', flag: '🇬🇧', mms: true, note: 'EE, O2, Vodafone, Three, Tesco Mobile, Giffgaff' },
  { code: '+880', dial: '880', name: 'Bangladesh', flag: '🇧🇩', mms: true, note: 'Grameenphone, Robi, Banglalink, Teletalk, Biccyl' },
  { code: '+91', dial: '91', name: 'India', flag: '🇮🇳', mms: true, note: 'Jio, Airtel, Vi, BSNL' },
  { code: '+93', dial: '93', name: 'Afghanistan', flag: '🇦🇫', mms: false, note: 'AWCC, Roshan, MTN, Etisalat' },
  { code: '+94', dial: '94', name: 'Sri Lanka', flag: '🇱🇰', mms: true, note: 'Dialog, Mobitel, Hutch, Airtel' },
  { code: '+977', dial: '977', name: 'Nepal', flag: '🇳🇵', mms: true, note: 'Ncell, NTC, Smart Cell' },
  { code: '+960', dial: '960', name: 'Maldives', flag: '🇲🇻', mms: false, note: 'Dhiraagu, Ooredoo' },
  { code: '+92', dial: '92', name: 'Pakistan', flag: '🇵🇰', mms: true, note: 'Jazz, Telenor, Zong, Ufone' },
  { code: '+60', dial: '60', name: 'Malaysia', flag: '🇲🇾', mms: true, note: 'Maxis, Celcom, Digi, U Mobile' },
  { code: '+65', dial: '65', name: 'Singapore', flag: '🇸🇬', mms: true, note: 'SingTel, StarHub, M1' },
  { code: '+66', dial: '66', name: 'Thailand', flag: '🇹🇭', mms: true, note: 'AIS, DTAC, TrueMove' },
  { code: '+62', dial: '62', name: 'Indonesia', flag: '🇮🇩', mms: true, note: 'Telkomsel, Indosat, XL, Tri' },
  { code: '+63', dial: '63', name: 'Philippines', flag: '🇵🇭', mms: true, note: 'Globe, Smart, Sun, DITO' },
  { code: '+84', dial: '84', name: 'Vietnam', flag: '🇻🇳', mms: true, note: 'Viettel, Vinaphone, Mobifone' },
  { code: '+86', dial: '86', name: 'China', flag: '🇨🇳', mms: true, note: 'China Mobile, China Unicom, China Telecom' },
  { code: '+81', dial: '81', name: 'Japan', flag: '🇯🇵', mms: true, note: 'NTT Docomo, au, SoftBank, Rakuten' },
  { code: '+82', dial: '82', name: 'South Korea', flag: '🇰🇷', mms: true, note: 'SK Telecom, KT, LG U+' },
  { code: '+971', dial: '971', name: 'UAE', flag: '🇦🇪', mms: true, note: 'Etisalat, du' },
  { code: '+966', dial: '966', name: 'Saudi Arabia', flag: '🇸🇦', mms: true, note: 'STC, Mobily, Zain' },
  { code: '+20', dial: '20', name: 'Egypt', flag: '🇪🇬', mms: true, note: 'Vodafone, Orange, Etisalat, WE' },
  { code: '+234', dial: '234', name: 'Nigeria', flag: '🇳🇬', mms: true, note: 'MTN, Glo, Airtel, 9mobile' },
  { code: '+27', dial: '27', name: 'South Africa', flag: '🇿🇦', mms: true, note: 'Vodacom, MTN, Cell C, Telkom' },
  { code: '+49', dial: '49', name: 'Germany', flag: '🇩🇪', mms: true, note: 'Deutsche Telekom, Vodafone, O2' },
  { code: '+33', dial: '33', name: 'France', flag: '🇫🇷', mms: true, note: 'Orange, SFR, Bouygues, Free' },
  { code: '+34', dial: '34', name: 'Spain', flag: '🇪🇸', mms: true, note: 'Movistar, Orange, Vodafone, Yoigo' },
  { code: '+39', dial: '39', name: 'Italy', flag: '🇮🇹', mms: true, note: 'TIM, Vodafone, WindTre, Iliad' },
  { code: '+31', dial: '31', name: 'Netherlands', flag: '🇳🇱', mms: true, note: 'KPN, Vodafone, T-Mobile' },
  { code: '+7', dial: '7', name: 'Russia', flag: '🇷🇺', mms: true, note: 'MTS, MegaFon, Beeline, Tele2' },
  { code: '+55', dial: '55', name: 'Brazil', flag: '🇧🇷', mms: true, note: 'Vivo, Claro, TIM, Oi' },
  { code: '+52', dial: '52', name: 'Mexico', flag: '🇲🇽', mms: true, note: 'Telcel, AT&T, Movistar' },
  { code: '+54', dial: '54', name: 'Argentina', flag: '🇦🇷', mms: true, note: 'Movistar, Claro, Personal' },
  { code: '+61', dial: '61', name: 'Australia', flag: '🇦🇺', mms: true, note: 'Telstra, Optus, Vodafone, TPG' },
  { code: '+64', dial: '64', name: 'New Zealand', flag: '🇳🇿', mms: true, note: 'Spark, Vodafone, 2degrees, Skinny' },
];

// Carrier MMS gateway domain map (mirrors src/lib/gateway/constants.js CARRIER_MMS_DOMAINS)
const CARRIER_DOMAINS = [
  { carrier: 'AT&T', domain: 'mms.att.net', country: 'USA', aliases: 'att, at&t, cingular' },
  { carrier: 'Verizon', domain: 'vzwpix.com', country: 'USA', aliases: 'verizon, vzw, xfinity' },
  { carrier: 'T-Mobile', domain: 'tmomail.net', country: 'USA', aliases: 't-mobile, tmobile, mint' },
  { carrier: 'Sprint', domain: 'pm.sprint.com', country: 'USA', aliases: 'sprint' },
  { carrier: 'Boost Mobile', domain: 'myboostmobile.com', country: 'USA', aliases: 'boost' },
  { carrier: 'US Cellular', domain: 'mms.uscc.net', country: 'USA', aliases: 'us cellular, uscellular' },
  { carrier: 'Cricket', domain: 'mms.cricketwireless.net', country: 'USA', aliases: 'cricket' },
  { carrier: 'MetroPCS', domain: 'mymetropcs.com', country: 'USA', aliases: 'metro pcs, metropcs' },
  { carrier: 'Google Fi', domain: 'msg.fi.google.com', country: 'USA', aliases: 'google fi, fi' },
  { carrier: 'Consumer Cellular', domain: 'mailmymobile.net', country: 'USA', aliases: 'consumer cellular' },
  { carrier: 'Ting', domain: 'message.ting.com', country: 'USA', aliases: 'ting' },
  { carrier: 'Republic Wireless', domain: 'text.republicwireless.com', country: 'USA', aliases: 'republic' },
  { carrier: 'Virgin Mobile', domain: 'vmpix.com', country: 'USA', aliases: 'virgin' },
  { carrier: 'Tracfone', domain: 'mmst5.tracfone.com', country: 'USA', aliases: 'tracfone' },
  { carrier: 'Straight Talk', domain: 'mms.straighttalk.com', country: 'USA', aliases: 'straight talk' },
  { carrier: 'Page Plus', domain: 'vtext.com', country: 'USA', aliases: 'page plus' },
  { carrier: 'Rogers', domain: 'pcs.rogers.com', country: 'Canada', aliases: 'rogers' },
  { carrier: 'Bell', domain: 'txt.bell.ca', country: 'Canada', aliases: 'bell' },
  { carrier: 'Telus', domain: 'msg.telus.com', country: 'Canada', aliases: 'telus' },
  { carrier: 'Fido', domain: 'fido.ca', country: 'Canada', aliases: 'fido' },
  { carrier: 'Koodo', domain: 'msg.koodomobile.com', country: 'Canada', aliases: 'koodo' },
  { carrier: 'Virgin Canada', domain: 'vmobile.ca', country: 'Canada', aliases: 'virgin canada' },
  { carrier: 'Wind', domain: 'mms.windmobile.ca', country: 'Canada', aliases: 'wind' },
];

// Email-to-MMS sender providers
const PROVIDER_TYPES = [
  { id: 'GMAIL_OAUTH', label: 'Gmail OAuth2', countries: 'Global', weight: 5, note: 'Best deliverability — OAuth2 refresh-token based, no password needed' },
  { id: 'GMAIL_APP_PASSWORD', label: 'Gmail App Password', countries: 'Global', weight: 5, note: 'Easiest — use a Gmail App Password (16 chars). No OAuth setup needed. Enable 2FA, generate app password at myaccount.google.com/apppasswords' },
  { id: 'OUTLOOK_GRAPH', label: 'Outlook Graph API', countries: 'Global', weight: 4, note: 'Microsoft Graph API — Azure app registration + client secret' },
  { id: 'CUSTOM_SMTP', label: 'Custom SMTP', countries: 'Global', weight: 3, note: 'Any SMTP server — host, port, user, pass (e.g. Amazon SES, Postmark)' },
  { id: 'YAHOO', label: 'Yahoo Mail', countries: 'Global', weight: 2, note: 'Yahoo account with app password' },
  { id: 'AOL', label: 'AOL Mail', countries: 'Global', weight: 2, note: 'AOL account with app password' },
];

// Resolve a country from a raw phone number (mirrors core.js getCountryCode
// but uses the full 3-digit prefix table above for richer output).
function resolveCountryFromNumber(raw) {
  if (!raw || typeof raw !== 'string') return { country: 'Unknown', code: '', flag: '🌐', mms: false };
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  // Try 3-digit, then 2-digit, then 1-digit prefixes.
  for (const len of [3, 2, 1]) {
    if (digits.length >= len) {
      const prefix = digits.slice(0, len);
      const match = COUNTRY_CODES.find(c => c.dial === prefix);
      if (match) return { country: match.name, code: match.code, flag: match.flag, mms: match.mms, note: match.note };
    }
  }
  return { country: 'Unknown', code: '', flag: '🌐', mms: false };
}

// ============================================================================
// API HELPERS
// ============================================================================
async function api(action, data = {}) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

// Gateway API helper — calls /api/admin/gateway/* with credentials.
async function gatewayApi(path = '', options = {}) {
  // Normalize: callers pass either '/admin/gateway/health' (full) or '/health' (relative).
  // Base is /api/admin/gateway — strip any duplicate prefix so we never get /api/admin/gateway/admin/gateway/...
  let suffix = path || '';
  if (suffix.startsWith('/admin/gateway')) suffix = suffix.slice('/admin/gateway'.length);
  const url = `/api/admin/gateway${suffix}`;
  // Callers pass body as either a pre-stringified string OR a raw object.
  // Only stringify if it's not already a string (avoids double-encoding).
  let bodyPayload = undefined;
  if (options.body !== undefined && options.body !== null) {
    bodyPayload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    body: bodyPayload,
  });
  return res.json().catch(() => ({ error: 'Invalid JSON response' }));
}

// Deploy hook helper
async function deployHookApi(body) {
  const res = await fetch('/api/admin/system/deploy-hook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'Invalid JSON response' }));
}

// System API helper (calls /api/system with an action payload)
async function systemApi(body) {
  const res = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'Invalid JSON response' }));
}

// ============================================================================
// MAIN ADMIN PANEL
// ============================================================================
export default function AdminPanel({ mode, user, onLoginSuccess, onLogout, onRefresh }) {
  if (mode === 'login') return <AdminLogin onLoginSuccess={onLoginSuccess} />;
  return <AdminDashboard user={user} onLogout={onLogout} onRefresh={onRefresh} />;
}


// ============================================================================
// ADMIN LOGIN — 3-layer security (username + password + API key)
// ============================================================================
function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstSetupCreds, setFirstSetupCreds] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api('adminLogin', { username, password, apiKey });
      if (data.success) {
        onLoginSuccess({ role: data.role, username: data.username, permissions: data.permissions });
      } else if (data.firstSetup) {
        setFirstSetupCreds(data.credentials);
        setError(data.message);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Admin Control</h1>
          <p className="text-gray-500 text-sm mt-1">Master Configuration Hub</p>
        </div>

        {firstSetupCreds && (
          <div className="mb-4 p-4 bg-blue-900/40 border border-blue-700/50 rounded-xl">
            <p className="text-blue-300 text-sm font-semibold mb-2">Save these credentials:</p>
            <div className="space-y-1 text-sm font-mono text-blue-100">
              <p>Username: <span className="text-white">{firstSetupCreds.username}</span></p>
              <p>Password: <span className="text-white">{firstSetupCreds.password}</span></p>
              <p>API Key: <span className="text-white">{firstSetupCreds.apiKey}</span></p>
            </div>
            <p className="text-blue-400 text-xs mt-2">Now login with these credentials.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter username" />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">API Key</label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} required
                className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter API key" />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showApiKey ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-2.5 rounded-lg transition shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><BtnSpinner /> Authenticating...</> : <><Icon.Lock /> Secure Login</>}
          </button>
        </form>
        <p className="text-center text-gray-600 text-xs mt-4">3-Layer Security: Username + Password + API Key</p>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function AdminDashboard({ user, onLogout, onRefresh }) {
  const [tab, setTab] = useState('gateway');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.detail) setTab(e.detail); };
    window.addEventListener('admin-tab', handler);
    return () => window.removeEventListener('admin-tab', handler);
  }, []);

  const withLoading = async (label, fn) => {
    setGlobalLoading({ label });
    try { return await fn(); } finally { setGlobalLoading(null); }
  };

  const tabs = [
    { id: 'gateway', label: 'Gateway Engine', icon: <Icon.Zap />, primary: true },
    { id: 'dashboard', label: 'Dashboard', icon: <Icon.Dashboard /> },
    { id: 'apis', label: 'API Management', icon: <Icon.Api /> },
    { id: 'users', label: 'User Management', icon: <Icon.Users /> },
    { id: 'campaigns', label: 'Campaigns', icon: <Icon.Campaign /> },
    { id: 'content', label: 'Content & Templates', icon: <Icon.Content /> },
    { id: 'subadmins', label: 'Sub-Admins', icon: <Icon.Shield /> },
    { id: 'database', label: 'Database', icon: <Icon.Database /> },
    { id: 'blacklist', label: 'Blacklist', icon: <Icon.Lock /> },
    { id: 'alerts', label: 'Alerts', icon: <Icon.Bell /> },
    { id: 'sms-guide', label: 'Free SMS Guide', icon: <Icon.Send /> },
    { id: 'logs', label: 'Activity Logs', icon: <Icon.Log /> },
    { id: 'security', label: 'Admin Security', icon: <Icon.Shield /> },
    { id: 'settings', label: 'Settings', icon: <Icon.Settings /> },
  ];

  return (
    <LoadingCtx.Provider value={withLoading}>
    <div className="min-h-screen bg-slate-950 text-gray-200">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center"><Icon.Shield /></div>
            <div><p className="font-bold text-white">Admin Panel</p><p className="text-xs text-gray-500">{user?.username}</p></div>
          </div>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto" style={{maxHeight: 'calc(100vh - 140px)'}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.id ? (t.primary ? 'bg-gradient-to-r from-sky-600/30 to-blue-600/20 text-sky-300 border border-sky-700/40' : 'bg-blue-600/20 text-blue-400 border border-blue-700/30') : 'text-gray-400 hover:bg-slate-800 hover:text-gray-200'}`}>
              {t.icon}<span>{t.label}</span>
              {t.primary && <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase tracking-wider">Primary</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 space-y-2">
          <button onClick={onRefresh} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-cyan-400 hover:bg-cyan-900/20 transition"><Icon.Refresh />Primary Refresh</button>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition"><Icon.Logout />Logout</button>
        </div>
      </div>

      {/* Mobile toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 p-2 rounded-lg">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      {/* Main content */}
      <div className="lg:ml-64 p-6 pt-16 lg:pt-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'gateway' && <GatewayDashboardTab />}
        {tab === 'apis' && <ApiManagementTab />}
        {tab === 'users' && <UserManagementTab />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'subadmins' && <SubAdminTab />}
        {tab === 'database' && <DatabaseTab />}
        {tab === 'blacklist' && <BlacklistTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'sms-guide' && <FreeSmsGuideTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'security' && <SecurityTab user={user} />}
        {tab === 'settings' && <SettingsTab />}
      </div>
      <EnterpriseOverlay show={!!globalLoading} label={globalLoading?.label || 'Processing...'} />
    </div>
    </LoadingCtx.Provider>
  );
}

// ============================================================================
// LOADING SPINNER + ENTERPRISE PRIMITIVES (preserved, polished)
// ============================================================================
function Spinner({ size = 32, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full border-2 border-slate-700/50" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 border-r-violet-400 animate-spin" style={{ animationDuration: '0.8s' }} />
        <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-sky-500/10 to-violet-500/10 animate-pulse" />
      </div>
      {label && <p className="text-xs text-slate-500 font-medium animate-pulse">{label}</p>}
    </div>
  );
}

function BtnSpinner({ size = 14, color = 'text-white' }) {
  return (
    <svg className={`animate-spin ${color}`} style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function LoadingButton({ loading = false, onClick, children, variant = 'primary', size = 'md', className = '', icon, disabled, full = false, type = 'button' }) {
  const variants = {
    primary:   'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-600/20',
    success:   'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/20',
    danger:    'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-600/20',
    warning:   'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20',
    ghost:     'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700',
    subtle:    'bg-slate-700/50 hover:bg-slate-700 text-white',
  };
  const sizes = { sm: 'px-2.5 py-1 text-xs rounded-lg gap-1', md: 'px-3.5 py-2 text-sm rounded-lg gap-1.5', lg: 'px-5 py-2.5 text-sm rounded-xl gap-2' };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center font-medium transition-all duration-200 ${variants[variant] || variants.primary} ${sizes[size]} ${full ? 'w-full' : ''} ${disabled || loading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'} ${className}`}>
      {loading ? <BtnSpinner /> : icon}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </button>
  );
}

function EnterpriseOverlay({ show, label = 'Processing...' }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 border-r-sky-400 animate-spin" style={{ animationDuration: '1s' }} />
          <div className="absolute inset-2.5 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-2.5 rounded-full border-2 border-transparent border-t-violet-400 border-b-violet-400 animate-spin" style={{ animationDuration: '1.4s', animationDirection: 'reverse' }} />
          <div className="absolute inset-5 rounded-full border-2 border-emerald-500/20" />
          <div className="absolute inset-5 rounded-full border-2 border-transparent border-l-emerald-400 animate-spin" style={{ animationDuration: '0.9s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-sky-400 to-violet-400 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-200">{label}</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid({ rows, count }) {
  const n = count || rows || 3;
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-800/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-800/60" />
            <div className="h-2.5 w-1/2 rounded bg-slate-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

const PROGRESS_COLORS = {
  emerald: 'from-emerald-400 to-teal-500',
  green: 'from-emerald-400 to-teal-500',
  amber: 'from-amber-400 to-orange-500',
  rose: 'from-rose-400 to-red-500',
  red: 'from-red-500 to-rose-500',
  sky: 'from-sky-400 to-blue-500',
  blue: 'from-sky-400 to-blue-500',
  violet: 'from-violet-400 to-purple-500',
  cyan: 'from-cyan-400 to-teal-500',
  indigo: 'from-indigo-400 to-blue-500',
  slate: 'from-slate-500 to-slate-600',
};
function ProgressBar({ percent, value, max, color }) {
  const pct = value != null && max != null ? (value / max) * 100 : percent || 0;
  const grad = PROGRESS_COLORS[color] || (color && color.includes('from-') ? color : (pct > 80 ? 'from-rose-400 to-red-500' : pct > 50 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500'));
  return (
    <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// DETAILING BOX — the enterprise container the user requested.
// Glassy panel with a gradient top accent, optional icon + title + subtitle,
// live badge, and an action slot. This replaces all the old dummy boxes.
// ───────────────────────────────────────────────────────────────────────────
function DetailBox({ title, subtitle, icon, accent = 'sky', action, children, className = '', live, padded = true }) {
  const accents = {
    sky:      'from-sky-500 to-blue-500',
    violet:   'from-violet-500 to-purple-500',
    emerald:  'from-emerald-400 to-green-500',
    amber:    'from-amber-400 to-orange-500',
    rose:     'from-rose-400 to-red-500',
    cyan:     'from-cyan-400 to-teal-500',
    slate:    'from-slate-500 to-slate-600',
    indigo:   'from-indigo-500 to-blue-500',
  };
  const ac = accents[accent] || accents.sky;
  return (
    <div className={`group relative bg-gradient-to-br from-slate-900/70 to-slate-900/30 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-700/90 hover:shadow-lg hover:shadow-slate-950/40 ${className}`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${ac} opacity-70 group-hover:opacity-100 transition-opacity`} />
      <div className={`absolute -inset-px bg-gradient-to-br ${ac} opacity-0 group-hover:opacity-[0.03] transition-opacity rounded-xl`} />
      {(title || icon || action) && (
        <div className="relative flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 border-b border-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-slate-400 flex-none">{icon}</span>}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-slate-100 truncate flex items-center gap-2">{title}
                {live && <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
              </h3>}
              {subtitle && <p className="text-[11px] text-slate-600 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex-none">{action}</div>}
        </div>
      )}
      <div className={`relative ${padded ? 'p-4' : ''}`}>{children}</div>
    </div>
  );
}

// Compact KPI tile — accepts accent (maps to tone) + optional icon
const KPI_TONES = {
  slate:  { accent: 'from-slate-500 to-slate-600',     value: 'text-white',      glow: 'hover:shadow-slate-500/10',    ring: 'group-hover:border-slate-600/50' },
  green:  { accent: 'from-emerald-400 to-green-500',   value: 'text-emerald-300', glow: 'hover:shadow-emerald-500/20',  ring: 'group-hover:border-emerald-600/40' },
  red:    { accent: 'from-rose-400 to-red-500',        value: 'text-rose-300',    glow: 'hover:shadow-rose-500/20',     ring: 'group-hover:border-rose-600/40' },
  amber:  { accent: 'from-amber-400 to-orange-500',    value: 'text-amber-300',   glow: 'hover:shadow-amber-500/20',    ring: 'group-hover:border-amber-600/40' },
  blue:   { accent: 'from-sky-400 to-blue-500',        value: 'text-sky-300',     glow: 'hover:shadow-sky-500/20',      ring: 'group-hover:border-sky-600/40' },
  violet: { accent: 'from-violet-400 to-purple-500',   value: 'text-violet-300',  glow: 'hover:shadow-violet-500/20',   ring: 'group-hover:border-violet-600/40' },
  cyan:   { accent: 'from-cyan-400 to-teal-500',       value: 'text-cyan-300',    glow: 'hover:shadow-cyan-500/20',     ring: 'group-hover:border-cyan-600/40' },
  indigo: { accent: 'from-indigo-400 to-blue-500',     value: 'text-indigo-300',  glow: 'hover:shadow-indigo-500/20',   ring: 'group-hover:border-indigo-600/40' },
  emerald:{ accent: 'from-emerald-400 to-green-500',   value: 'text-emerald-300', glow: 'hover:shadow-emerald-500/20',  ring: 'group-hover:border-emerald-600/40' },
  sky:    { accent: 'from-sky-400 to-blue-500',        value: 'text-sky-300',     glow: 'hover:shadow-sky-500/20',      ring: 'group-hover:border-sky-600/40' },
  rose:   { accent: 'from-rose-400 to-red-500',        value: 'text-rose-300',    glow: 'hover:shadow-rose-500/20',     ring: 'group-hover:border-rose-600/40' },
};
function Kpi({ label, value, sub, tone, accent, icon, live, trend }) {
  const t = KPI_TONES[accent || tone] || KPI_TONES.slate;
  return (
    <div className={`group relative bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-3.5 overflow-hidden transition-all duration-300 ${t.ring} ${t.glow} hover:shadow-lg hover:-translate-y-0.5`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${t.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
      <div className={`absolute -inset-px bg-gradient-to-br ${t.accent} opacity-0 group-hover:opacity-[0.03] transition-opacity rounded-xl`} />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-slate-500"><IconByName name={icon} /></span>}
          {live && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />LIVE</span>}
        </div>
      </div>
      <div className="relative flex items-baseline gap-2 mt-1.5">
        <p className={`text-2xl font-bold tabular-nums ${t.value} leading-none tracking-tight`}>{value}</p>
        {trend != null && <span className={`text-[11px] font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</span>}
      </div>
      {sub && <p className="relative text-[11px] text-slate-600 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function RadialGauge({ value, label, sub, color = '#34d399', size = 120 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">{value}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium mt-2">{label}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

function UsageRow({ name, type, used, limit, percent, status, extras, last }) {
  const statusMap = {
    active:  { dot: 'bg-emerald-400', txt: 'text-emerald-400' },
    warning: { dot: 'bg-amber-400', txt: 'text-amber-400' },
    blocked: { dot: 'bg-rose-400', txt: 'text-rose-400' },
    paused:  { dot: 'bg-slate-500', txt: 'text-slate-500' },
  };
  const s = statusMap[status] || statusMap.paused;
  return (
    <div className={`py-3 ${last ? '' : 'border-b border-slate-800/60'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-none`} />
          <span className="text-sm text-slate-200 font-medium truncate">{name}</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wide flex-none">{type}</span>
        </div>
        <span className={`text-[10px] font-semibold ${s.txt} uppercase flex-none`}>{status}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1"><ProgressBar percent={percent} /></div>
        <span className="text-[11px] text-slate-500 tabular-nums flex-none w-24 text-right">{used}/{limit}</span>
      </div>
      {extras && <div className="flex gap-4 mt-1.5 text-[10px] text-slate-600">{extras}</div>}
    </div>
  );
}

function UserPresenceList({ users, limit = 8 }) {
  const sorted = [...(users || [])].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
  }).slice(0, limit);
  if (sorted.length === 0) return <p className="text-xs text-slate-600 py-4 text-center">No users yet.</p>;
  return (
    <div className="divide-y divide-slate-800/50">
      {sorted.map((u) => (
        <div key={u._id || u.email} className="flex items-center gap-3 py-2.5">
          <span className={`w-2 h-2 rounded-full flex-none ${u.isOnline ? 'bg-emerald-400 shadow-emerald-400/50 shadow-sm animate-pulse' : 'bg-slate-700'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-200 font-medium truncate">{u.email}</p>
            <p className="text-[10px] text-slate-600">last active {u.lastActiveAgo || '—'}</p>
          </div>
          <div className="flex-none text-right">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'suspended' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700/40 text-slate-400'}`}>{u.status}</span>
            {u.sentCount != null && <p className="text-[10px] text-slate-600 mt-0.5">{u.sentCount} sent</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniBars({ values, labels }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2 h-20">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
            <div className="w-full max-w-[28px] rounded-t bg-gradient-to-t from-sky-600/40 to-sky-400 transition-all duration-700" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? '4px' : '2px' }} title={`${labels[i]}: ${v}`} />
          </div>
          <span className="text-[9px] text-slate-600 uppercase">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`group bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-slate-800/70 rounded-xl p-4 transition-all duration-300 hover:border-slate-700/80 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ApiManagementTab() {
  const [senderApis, setSenderApis] = useState([]);
  const [geminiApis, setGeminiApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSenderForm, setShowSenderForm] = useState(false);
  const [showGeminiForm, setShowGeminiForm] = useState(false);
  const [senderForm, setSenderForm] = useState({ name: '', provider: 'custom', apiKey: '', apiSecret: '', endpoint: '', senderId: '', limit: 1000, priority: 0 });
  const [geminiForm, setGeminiForm] = useState({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 });
  const [testing, setTesting] = useState(null);     // apiId being tested
  const [testResult, setTestResult] = useState({});  // { [apiId]: {success, ...} }
  const [testModal, setTestModal] = useState(null);  // { api, number, message }
  const [testingGemini, setTestingGemini] = useState(null);  // gemini apiId being tested OR true for pre-save test
  const [geminiResult, setGeminiResult] = useState({});      // { [geminiApiId]: {ok, message, error, hint, model} }
  const [geminiTestResult, setGeminiTestResult] = useState(null); // pre-save test result
  const [savingGemini, setSavingGemini] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  // Per-card inline add (add one Gemini API at a time under each box)
  const [inlineGeminiCard, setInlineGeminiCard] = useState(null); // card id showing the inline form (or 'new' for the empty-state card)
  const [inlineGeminiForm, setInlineGeminiForm] = useState({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 });
  const [geminiSuccess, setGeminiSuccess] = useState(null); // { name } — shown as confirmation banner

  // Provider templates — auto-fill endpoint + fields when provider changes
  const PROVIDER_TEMPLATES = {
    twilio: {
      label: 'Twilio',
      endpoint: 'https://api.twilio.com/2010-04-01',
      needsSecret: true,
      secretLabel: 'Auth Token',
      keyLabel: 'Account SID',
      help: 'apiKey = Account SID, apiSecret = Auth Token, senderId = Twilio phone number (e.g. +1234567890)',
    },
    vonage: {
      label: 'Vonage / Nexmo',
      endpoint: 'https://api.nexmo.com',
      needsSecret: true,
      secretLabel: 'API Signature Secret',
      keyLabel: 'API Key',
      help: 'apiKey = API Key, apiSecret = API Secret. Vonage Messages API v0.1 is used automatically.',
    },
    messagebird: {
      label: 'MessageBird',
      endpoint: 'https://rest.messagebird.com',
      needsSecret: false,
      keyLabel: 'Access Key (live_...)',
      help: 'apiKey = MessageBird Access Key. senderId = originator (e.g. +1234567890 or a text sender).',
    },
    custom: {
      label: 'Custom HTTP',
      endpoint: '',
      needsSecret: false,
      keyLabel: 'API Key / Bearer Token',
      help: 'Any HTTP endpoint. Body sent as JSON: {to, from, message, apiKey, sender}. Bearer auth header.',
    },
  };

  const load = async () => {
    setLoading(true);
    const [s, g] = await Promise.all([api('getSenderApis'), api('getGeminiApis')]);
    if (s.success) setSenderApis(s.apis);
    if (g.success) setGeminiApis(g.apis);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onProviderChange = (provider) => {
    const tmpl = PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom;
    setSenderForm((f) => ({ ...f, provider, endpoint: tmpl.endpoint || f.endpoint }));
  };

  const addSender = async (e) => {
    e.preventDefault();
    setSavingSender(true);
    try {
      const data = await api('addSenderApi', senderForm);
      if (data.success) { setShowSenderForm(false); setSenderForm({ name: '', provider: 'custom', apiKey: '', apiSecret: '', endpoint: '', senderId: '', limit: 1000, priority: 0 }); load(); }
      else alert(data.error);
    } finally { setSavingSender(false); }
  };

  const addGemini = async (e) => {
    e.preventDefault();
    setSavingGemini(true);
    const data = await api('addGeminiApi', geminiForm);
    setSavingGemini(false);
    if (data.success) { setShowGeminiForm(false); setGeminiForm({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 }); setGeminiTestResult(null); setGeminiSuccess({ name: geminiForm.name || 'Gemini API' }); setTimeout(() => setGeminiSuccess(null), 5000); load(); }
    else alert(data.error);
  };

  // Add ONE Gemini API at a time — inline under a specific card
  const addGeminiInline = async (e) => {
    e.preventDefault();
    // Accept ANY key format: AIzaSy..., AQ., custom/partner keys. Only block
    // empty keys or obvious placeholders.
    if (!inlineGeminiForm.apiKey || inlineGeminiForm.apiKey.length < 8) {
      setGeminiTestResult({ ok: false, error: 'একটি বৈধ API key দিন (AIzaSy... বা AQ.... দিয়ে শুরু হতে পারে)।' });
      return;
    }
    setSavingGemini(true);
    const data = await api('addGeminiApi', inlineGeminiForm);
    setSavingGemini(false);
    if (data.success) {
      setInlineGeminiCard(null);
      setInlineGeminiForm({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 });
      setGeminiTestResult(null);
      setGeminiSuccess({ name: inlineGeminiForm.name || 'Gemini API' });
      setTimeout(() => setGeminiSuccess(null), 5000);
      load();
    } else {
      setGeminiTestResult({ ok: false, error: data.error || 'Failed to add Gemini API' });
    }
  };

  // Test the inline Gemini key before saving
  const testGeminiInline = async () => {
    if (!inlineGeminiForm.apiKey) { setGeminiTestResult({ ok: false, error: 'Enter an API key first.' }); return; }
    setTestingGemini(true);
    setGeminiTestResult(null);
    const data = await api('testGeminiApi', { apiKey: inlineGeminiForm.apiKey, model: inlineGeminiForm.model });
    setGeminiTestResult(data);
    setTestingGemini(false);
  };

  // Test a saved Gemini API from the list
  const testGeminiApi = async (id) => {
    setTestingGemini(id);
    setGeminiResult((r) => ({ ...r, [id]: null }));
    const data = await api('testGeminiApi', { id });
    setGeminiResult((r) => ({ ...r, [id]: data }));
    setTestingGemini(null);
    if (data.ok) load(); // reload to pick up model update + cleared lastError
  };

  // Test the Gemini key currently in the form (before saving)
  const testGeminiBeforeSave = async () => {
    if (!geminiForm.apiKey) { setGeminiTestResult({ ok: false, error: 'Enter an API key first.' }); return; }
    setTestingGemini(true);
    setGeminiTestResult(null);
    const data = await api('testGeminiApi', { apiKey: geminiForm.apiKey, model: geminiForm.model });
    setGeminiTestResult(data);
    setTestingGemini(false);
  };

  const runTest = async () => {
    if (!testModal) return;
    setTesting(testModal.api._id);
    setTestResult((r) => ({ ...r, [testModal.api._id]: null }));
    const data = await api('testSenderApi', { apiId: testModal.api._id, testNumber: testModal.number, testMessage: testModal.message });
    setTestResult((r) => ({ ...r, [testModal.api._id]: data }));
    setTesting(null);
    if (data.success) { setTestModal(null); load(); }
  };

  if (loading) return <Spinner label="Loading APIs..." />;

  const tmpl = PROVIDER_TEMPLATES[senderForm.provider] || PROVIDER_TEMPLATES.custom;

  // Health ring — SVG circular gauge (0-100)
  const HealthRing = ({ score, size = 48 }) => {
    const r = (size - 6) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score));
    const dash = (pct / 100) * c;
    const color = pct > 70 ? '#22c55e' : pct > 40 ? '#eab308' : '#ef4444';
    return (
      <svg width={size} height={size} className="flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500" />
        <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[11px] font-bold">{pct}</text>
      </svg>
    );
  };

  // 4-metric mini-grid for each sender API
  const ApiMetrics = ({ a }) => (
    <div className="grid grid-cols-4 gap-2 mt-3">
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Sent</p>
        <p className="text-sm font-bold text-white">{a.totalSent}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Inbox</p>
        <p className="text-sm font-bold text-green-400">{a.inboxRate}%</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Spam</p>
        <p className="text-sm font-bold text-red-400">{a.spamRate}%</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-gray-500 uppercase">Left</p>
        <p className="text-sm font-bold text-cyan-400">{a.remaining}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">API Management</h2>

      {/* Sender APIs */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Sender APIs <span className="text-sm text-gray-500">({senderApis.length}/10)</span></h3>
          {senderApis.length < 10 && <button onClick={() => setShowSenderForm(!showSenderForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Sender API</button>}
        </div>

        {/* Add Sender Form — enterprise with provider selector */}
        {showSenderForm && (
          <form onSubmit={addSender} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name (e.g. Twilio Primary)" value={senderForm.name} onChange={e => setSenderForm({...senderForm, name: e.target.value})} required />
              {/* Provider selector dropdown */}
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={senderForm.provider} onChange={e => onProviderChange(e.target.value)}>
                {Object.entries(PROVIDER_TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={tmpl.keyLabel || 'API Key'} value={senderForm.apiKey} onChange={e => setSenderForm({...senderForm, apiKey: e.target.value})} required />
              {tmpl.needsSecret && (
                <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={tmpl.secretLabel || 'API Secret'} value={senderForm.apiSecret} onChange={e => setSenderForm({...senderForm, apiSecret: e.target.value})} />
              )}
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Endpoint URL" value={senderForm.endpoint} onChange={e => setSenderForm({...senderForm, endpoint: e.target.value})} />
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Sender ID / From number" value={senderForm.senderId} onChange={e => setSenderForm({...senderForm, senderId: e.target.value})} />
              <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Limit (total sends)" value={senderForm.limit} onChange={e => setSenderForm({...senderForm, limit: parseInt(e.target.value) || 0})} />
              <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Priority (higher=preferred)" value={senderForm.priority} onChange={e => setSenderForm({...senderForm, priority: parseInt(e.target.value) || 0})} />
            </div>
            {tmpl.help && <p className="text-xs text-gray-500 bg-slate-800/40 rounded-lg p-2">💡 {tmpl.help}</p>}
            <button type="submit" disabled={savingSender} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{savingSender ? <BtnSpinner /> : <Icon.Plus />}Save Sender API</button>
          </form>
        )}

        {/* Sender API cards — enterprise with health ring + 4-metric grid + test send */}
        <div className="space-y-3">
          {senderApis.map(a => {
            const tr = testResult[a._id];
            return (
              <div key={a._id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <HealthRing score={a.healthScore} />
                    <div>
                      <span className="text-sm font-bold text-white">{a.name}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 uppercase">{(PROVIDER_TEMPLATES[a.provider] || {}).label || a.provider}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900/40 text-green-400' : a.status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>{a.status}</span>
                      {a.autoRoute && <span className="ml-2 text-xs text-cyan-400">⚡Auto-Route</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Test Send button */}
                    <button onClick={() => setTestModal({ api: a, number: '', message: 'Test from MMS Sender' })} className="flex items-center gap-1 bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs px-2.5 py-1 rounded-lg transition">
                      <Icon.Send /> Test
                    </button>
                    <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={a.autoRoute} onChange={async (e) => { await api('setAutoRoute', { id: a._id, type: 'sender', autoRoute: e.target.checked }); load(); }} />Auto</label>
                    <button onClick={async () => { if (confirm('Delete this API?')) { await api('deleteSenderApi', { id: a._id }); load(); } }} className="text-red-400 hover:text-red-300"><Icon.Trash /></button>
                  </div>
                </div>

                <ApiMetrics a={a} />

                {/* Usage bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Usage</span><span>{a.used}/{a.limit}</span></div>
                  <ProgressBar percent={a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0} />
                </div>

                {a.lastError && <p className="text-xs text-red-400/70 mt-2">⚠ Last error: {a.lastError}</p>}

                {/* Test result display */}
                {tr && (
                  <div className={`mt-2 text-xs rounded-lg p-2 ${tr.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {tr.success ? `✓ Test sent — Provider Msg ID: ${tr.providerMsgId || 'N/A'}` : `✗ Failed: ${tr.errorMessage || 'Unknown error'}${tr.errorCode ? ` (code ${tr.errorCode})` : ''}`}
                  </div>
                )}
              </div>
            );
          })}
          {senderApis.length === 0 && (
            <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm mb-2">No sender APIs configured.</p>
              <p className="text-gray-600 text-xs">Add a Twilio, Vonage, MessageBird, or custom HTTP sender to start sending real MMS/SMS.</p>
            </div>
          )}
        </div>
      </div>

      {/* Test Send Modal */}
      {testModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setTestModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Test Send — {testModal.api.name}</h3>
            <p className="text-xs text-gray-500">Provider: {(PROVIDER_TEMPLATES[testModal.api.provider] || {}).label || testModal.api.provider}</p>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Test number (E.164, e.g. +1234567890)" value={testModal.number} onChange={e => setTestModal({ ...testModal, number: e.target.value })} />
            <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-20" placeholder="Test message" value={testModal.message} onChange={e => setTestModal({ ...testModal, message: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={runTest} disabled={testing === testModal.api._id || !testModal.number} className="flex-1 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                {testing === testModal.api._id ? <><BtnSpinner /> Sending…</> : <><Icon.Send /> Send Test</>}
              </button>
              <button onClick={() => setTestModal(null)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini APIs */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Gemini AI APIs <span className="text-sm text-gray-500">({geminiApis.length}/10)</span></h3>
          {geminiApis.length < 10 && <button onClick={() => setShowGeminiForm(!showGeminiForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Gemini API</button>}
        </div>
        {/* API key format help banner */}
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 mb-3 text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">⚠️ গুরুত্বপূর্ণ / Important:</span> Gemini API key <code className="bg-amber-950/50 px-1 rounded text-amber-100">AIzaSy...</code> অথবা <code className="bg-amber-950/50 px-1 rounded text-amber-100">AQ....</code> দিয়ে শুরু হতে পারে — দুটোই গ্রহণযোগ্য।
          ফ্রি API key নিতে এখানে যান: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline text-amber-300 hover:text-amber-200">https://aistudio.google.com/apikey</a>
          &nbsp;→ "Create API Key" → কপি করে এখানে পেস্ট করুন। Recommended model: <code className="bg-amber-950/50 px-1 rounded text-amber-100">gemini-2.5-flash</code>
        </div>
        {showGeminiForm && (
          <form onSubmit={addGemini} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name (e.g. Gemini Primary)" value={geminiForm.name} onChange={e => setGeminiForm({...geminiForm, name: e.target.value})} required />
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Gemini API Key (AIzaSy... or AQ....)" value={geminiForm.apiKey} onChange={e => setGeminiForm({...geminiForm, apiKey: e.target.value})} required />
            <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={geminiForm.model} onChange={e => setGeminiForm({...geminiForm, model: e.target.value})}>
              <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-flash-latest">gemini-flash-latest</option>
            </select>
            <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Daily Limit (default 1500)" value={geminiForm.limit} onChange={e => setGeminiForm({...geminiForm, limit: parseInt(e.target.value)})} />
            <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
              <button type="button" onClick={testGeminiBeforeSave} disabled={testingGemini} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                {testingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Testing...</> : <><Icon.Beaker />Test before saving</>}
              </button>
              <button type="submit" className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition">
                {savingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Saving...</> : <><Icon.Plus />Save Gemini API</>}
              </button>
              {geminiTestResult && (
                <span className={`text-xs px-3 py-1.5 rounded-lg ${geminiTestResult.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                  {geminiTestResult.ok ? `✅ ${geminiTestResult.message}` : `❌ ${geminiTestResult.error}`}
                </span>
              )}
            </div>
          </form>
        )}
        <div className="space-y-2">
          {geminiApis.map(a => (
            <div key={a._id}>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{a.name}</span>
                    <span className="text-xs text-gray-500">{a.model}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900/40 text-green-400' : a.status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'}`}>{a.status}</span>
                    {a.apiKey && a.apiKey.startsWith('AQ.') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/40">🔑 AQ. key</span>
                    )}
                    {a.apiKey && a.apiKey.startsWith('AIza') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40">🔑 AIza key</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => testGeminiApi(a._id)} disabled={testingGemini === a._id} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-2.5 py-1 rounded-lg transition">
                      {testingGemini === a._id ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Testing</> : <><Icon.Beaker />Test</>}
                    </button>
                    <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={a.autoRoute} onChange={async (e) => { await api('setAutoRoute', { id: a._id, type: 'gemini', autoRoute: e.target.checked }); load(); }} />Auto-Route</label>
                    <button onClick={async () => { if (confirm('Delete?')) { await api('deleteGeminiApi', { id: a._id }); load(); } }} className="text-red-400 hover:text-red-300"><Icon.Trash /></button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 mt-2"><span>Key: {a.apiKey}</span><span>Used: {a.used}/{a.limit}</span><span>Remaining: {a.remaining}</span><span>Health: {a.healthScore}%</span></div>
                <div className="mt-2"><ProgressBar percent={a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0} /></div>
                {geminiResult[a._id] && (
                  <div className={`mt-2 text-xs p-2 rounded-lg ${geminiResult[a._id].ok ? 'bg-green-900/30 text-green-300 border border-green-800/40' : 'bg-red-900/30 text-red-300 border border-red-800/40'}`}>
                    {geminiResult[a._id].ok ? `✅ ${geminiResult[a._id].message} (model: ${geminiResult[a._id].model})` : `❌ ${geminiResult[a._id].error}${geminiResult[a._id].hint ? ` — ${geminiResult[a._id].hint}` : ''}`}
                  </div>
                )}
                {a.lastError && !geminiResult[a._id] && (
                  <div className="mt-2 text-xs p-2 rounded-lg bg-red-900/20 text-red-300/80 border border-red-800/30">Last error: {a.lastError}</div>
                )}
              </div>
              {/* Add button UNDER this box — add one Gemini API at a time */}
              {geminiApis.length < 10 && (
                <div className="mt-1.5">
                  {inlineGeminiCard === a._id ? (
                    <form onSubmit={addGeminiInline} className="bg-slate-800/40 border border-dashed border-blue-600/40 rounded-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name (e.g. Gemini Backup)" value={inlineGeminiForm.name} onChange={e => setInlineGeminiForm({...inlineGeminiForm, name: e.target.value})} required />
                      <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Gemini API Key (AIzaSy... or AQ....)" value={inlineGeminiForm.apiKey} onChange={e => { setInlineGeminiForm({...inlineGeminiForm, apiKey: e.target.value}); setGeminiTestResult(null); }} required />
                      <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={inlineGeminiForm.model} onChange={e => setInlineGeminiForm({...inlineGeminiForm, model: e.target.value})}>
                        <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                        <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-flash-latest">gemini-flash-latest</option>
                      </select>
                      <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Daily Limit (default 1500)" value={inlineGeminiForm.limit} onChange={e => setInlineGeminiForm({...inlineGeminiForm, limit: parseInt(e.target.value)})} />
                      <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={testGeminiInline} disabled={testingGemini} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition">
                          {testingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Testing...</> : <><Icon.Beaker />Test before saving</>}
                        </button>
                        <button type="submit" disabled={savingGemini} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition">
                          {savingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Saving...</> : <><Icon.Plus />Add this Gemini API</>}
                        </button>
                        <button type="button" onClick={() => { setInlineGeminiCard(null); setInlineGeminiForm({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 }); setGeminiTestResult(null); }} className="text-xs text-gray-400 hover:text-white px-2 py-1.5">Cancel</button>
                        {geminiTestResult && (
                          <span className={`text-xs px-2.5 py-1 rounded-lg ${geminiTestResult.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                            {geminiTestResult.ok ? `✅ ${geminiTestResult.message}` : `❌ ${geminiTestResult.error}`}
                          </span>
                        )}
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => { setInlineGeminiCard(a._id); setInlineGeminiForm({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 }); setGeminiTestResult(null); }} className="flex items-center gap-1.5 w-full justify-center bg-slate-800/30 hover:bg-blue-900/30 border border-dashed border-slate-700 hover:border-blue-600/50 text-gray-400 hover:text-blue-300 text-xs px-3 py-2 rounded-lg transition">
                      <Icon.Plus /> Add Gemini API (একটা করে যোগ করুন)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {geminiApis.length === 0 && (
            <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm mb-3">No Gemini APIs yet. Add one for AI spam filtering & chat support.</p>
              {inlineGeminiCard === 'new' ? (
                <form onSubmit={addGeminiInline} className="bg-slate-800/40 border border-dashed border-blue-600/40 rounded-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                  <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Name (e.g. Gemini Primary)" value={inlineGeminiForm.name} onChange={e => setInlineGeminiForm({...inlineGeminiForm, name: e.target.value})} required />
                  <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Gemini API Key (AIzaSy... or AQ....)" value={inlineGeminiForm.apiKey} onChange={e => { setInlineGeminiForm({...inlineGeminiForm, apiKey: e.target.value}); setGeminiTestResult(null); }} required />
                  <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={inlineGeminiForm.model} onChange={e => setInlineGeminiForm({...inlineGeminiForm, model: e.target.value})}>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-flash-latest">gemini-flash-latest</option>
                  </select>
                  <input type="number" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Daily Limit (default 1500)" value={inlineGeminiForm.limit} onChange={e => setInlineGeminiForm({...inlineGeminiForm, limit: parseInt(e.target.value)})} />
                  <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={testGeminiInline} disabled={testingGemini} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition">
                      {testingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Testing...</> : <><Icon.Beaker />Test before saving</>}
                    </button>
                    <button type="submit" disabled={savingGemini} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition">
                      {savingGemini ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Saving...</> : <><Icon.Plus />Add this Gemini API</>}
                    </button>
                    <button type="button" onClick={() => { setInlineGeminiCard(null); setGeminiTestResult(null); }} className="text-xs text-gray-400 hover:text-white px-2 py-1.5">Cancel</button>
                    {geminiTestResult && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg ${geminiTestResult.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                        {geminiTestResult.ok ? `✅ ${geminiTestResult.message}` : `❌ ${geminiTestResult.error}`}
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                <button onClick={() => { setInlineGeminiCard('new'); setInlineGeminiForm({ name: '', apiKey: '', model: 'gemini-2.5-flash', limit: 1500, priority: 0 }); setGeminiTestResult(null); }} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">
                  <Icon.Plus /> Add Gemini API
                </button>
              )}
            </div>
          )}
        </div>
        {/* Success confirmation banner — "Gemini added successfully" */}
        {geminiSuccess && (
          <div className="mt-3 bg-green-900/30 border border-green-700/50 rounded-xl p-3 flex items-center gap-2 text-sm text-green-300 animate-pulse">
            <span className="text-lg">✅</span>
            <span><span className="font-bold text-green-200">{geminiSuccess.name}</span> নিজে অ্যাড হয়ে গেছে — Gemini API successfully added!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// USER MANAGEMENT TAB
// ============================================================================
function UserManagementTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // NEW form: username + password (no email required), expiry as { value, unit }
  const [form, setForm] = useState({ username: '', password: '', sendingLimit: 100, expiryValue: 30, expiryUnit: 'days' });
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState(null); // userId being acted on
  // per-row expiry editor state
  const [expiryEditor, setExpiryEditor] = useState({}); // { [userId]: { value, unit } }
  const withLoading = useLoading();

  const EXPIRY_UNITS = [
    { value: 'hours', label: 'ঘন্টা (Hours)' },
    { value: 'days', label: 'দিন (Days)' },
    { value: 'weeks', label: 'সপ্তাহ (Weeks)' },
    { value: 'months', label: 'মাস (Months)' },
    { value: 'years', label: 'বছর (Years)' },
  ];

  const load = async () => { setLoading(true); const data = await api('getUsers'); if (data.success) setUsers(data.users); setLoading(false); };
  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await api('createUser', form);
      if (data.success) { setShowForm(false); setForm({ username: '', password: '', sendingLimit: 100, expiryValue: 30, expiryUnit: 'days' }); load(); }
      else alert(data.error);
    } finally { setCreating(false); }
  };

  // Per-row expiry update using the new { value, unit } system
  const applyRowExpiry = async (userId) => {
    const ed = expiryEditor[userId];
    if (!ed || !ed.value) return;
    const data = await api('updateUserExpiry', { userId, expiryValue: parseInt(ed.value), expiryUnit: ed.unit });
    if (data.success) { setExpiryEditor(prev => { const n = { ...prev }; delete n[userId]; return n; }); load(); }
    else alert(data.error);
  };

  if (loading) return <Spinner label="Loading users..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Create User</button>
      </div>
      {showForm && (
        <form onSubmit={createUser} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username <span className="text-emerald-400/70">(যেভাবে খুশি দিতে পারেন — কোনো নিয়ম নেই)</span></label>
              <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="e.g. samir123 or any username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password <span className="text-emerald-400/70">(যেভাবে খুশি দিতে পারেন)</span></label>
              <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Send Limit</label>
              <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Send Limit" value={form.sendingLimit} onChange={e => setForm({...form, sendingLimit: parseInt(e.target.value) || 100})} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expiry Value</label>
              <input type="number" min="1" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Expiry value" value={form.expiryValue} onChange={e => setForm({...form, expiryValue: parseInt(e.target.value) || 1})} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expiry Unit</label>
              <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={form.expiryUnit} onChange={e => setForm({...form, expiryUnit: e.target.value})}>
                {EXPIRY_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{creating ? <BtnSpinner /> : <Icon.Plus />}Create User</button>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-xs uppercase border-b border-slate-800">
            <th className="text-left p-2">Username</th><th className="text-left p-2">Status</th><th className="text-left p-2">Limit</th><th className="text-left p-2">Sent</th><th className="text-left p-2">Expiry</th><th className="text-left p-2">IP</th><th className="text-left p-2">Last Active</th><th className="text-left p-2">Last Send</th><th className="text-left p-2">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                <td className="p-2 text-white">
                  <div className="font-medium">{u.loginId || u.userId || u.email || '—'}</div>
                  {u.email && u.email !== (u.userId || u.loginId) && <div className="text-[10px] text-gray-500">{u.email}</div>}
                </td>
                <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{u.isOnline ? 'Online' : u.status}</span></td>
                <td className="p-2 text-gray-400">
                  <input type="number" placeholder="Limit" className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white text-xs" defaultValue={u.sendingLimit} onBlur={async (e) => { await api('updateUserLimit', { userId: u._id, limit: parseInt(e.target.value) }); }} />
                </td>
                <td className="p-2 text-gray-400">{u.sentCount}</td>
                <td className="p-2 text-gray-400">
                  <div className="text-xs mb-1">{u.expiryDaysLeft != null ? `${u.expiryDaysLeft}d left` : 'No expiry'}</div>
                  {expiryEditor[u._id] ? (
                    <div className="flex gap-1 items-center">
                      <input type="number" min="1" placeholder="Val" className="w-12 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-white text-[11px]" value={expiryEditor[u._id].value || ''} onChange={e => setExpiryEditor(prev => ({ ...prev, [u._id]: { ...prev[u._id], value: e.target.value } }))} />
                      <select className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-white text-[11px]" value={expiryEditor[u._id].unit} onChange={e => setExpiryEditor(prev => ({ ...prev, [u._id]: { ...prev[u._id], unit: e.target.value } }))}>
                        {EXPIRY_UNITS.map(unit => <option key={unit.value} value={unit.value}>{unit.value}</option>)}
                      </select>
                      <button onClick={() => applyRowExpiry(u._id)} className="text-emerald-400 text-[10px] px-1">✓</button>
                      <button onClick={() => setExpiryEditor(prev => { const n = { ...prev }; delete n[u._id]; return n; })} className="text-gray-500 text-[10px] px-1">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setExpiryEditor(prev => ({ ...prev, [u._id]: { value: '', unit: 'days' } }))} className="text-blue-400 text-[11px] underline">Set expiry</button>
                  )}
                </td>
                <td className="p-2 text-gray-500 text-xs">{u.ipAddress || '-'}</td>
                <td className="p-2 text-gray-500 text-xs">{u.lastActiveAgo}</td>
                <td className="p-2 text-gray-500 text-xs">{u.lastSendAgo}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    {u.status === 'active' ? <button disabled={acting === u._id} onClick={async () => { setActing(u._id); await withLoading?.('Blocking user...', async () => { await api('suspendUser', { userId: u._id }); }); setActing(null); load(); }} className="text-yellow-400 text-xs px-2 disabled:opacity-50">{acting === u._id ? <BtnSpinner size={10} /> : 'Block'}</button> : <button disabled={acting === u._id} onClick={async () => { setActing(u._id); await withLoading?.('Activating user...', async () => { await api('activateUser', { userId: u._id }); }); setActing(null); load(); }} className="text-green-400 text-xs px-2 disabled:opacity-50">{acting === u._id ? <BtnSpinner size={10} /> : 'Unblock'}</button>}
                    <button disabled={acting === u._id} onClick={async () => { if (confirm('Delete user?')) { setActing(u._id); await withLoading?.('Deleting user...', async () => { await api('deleteUser', { userId: u._id }); }); setActing(null); load(); } }} className="text-red-400 disabled:opacity-50">{acting === u._id ? <BtnSpinner size={12} color="text-red-400" /> : <Icon.Trash />}</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="9" className="text-center text-gray-600 py-8">No users yet. Click "Create User" to add one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// CAMPAIGNS TAB
// ============================================================================
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const data = await api('getCampaigns'); if (data.success) setCampaigns(data.campaigns); setLoading(false); };
  useEffect(() => { load(); }, []);
  if (loading) return <Spinner label="Loading campaigns..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Campaigns</h2>
      <div className="space-y-2">
        {campaigns.map(c => (
          <div key={c._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{c.userEmail}</p>
                <p className="text-xs text-gray-500 mt-1">{c.message?.substring(0, 80)}...</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-2">
                  <span>Sent: {c.totalSent}</span><span>Delivered: {c.totalDelivered}</span><span>Undelivered: {c.totalUndelivered}</span><span>Invalid: {c.totalInvalid}</span><span>Inbox: {c.totalInbox}</span><span>Spam: {c.totalSpam}</span><span>API: {c.senderApiName || '-'}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'sent' ? 'bg-green-900/40 text-green-400' : c.status === 'running' ? 'bg-blue-900/40 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>{c.status}</span>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No campaigns yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// CONTENT & TEMPLATES TAB
// ============================================================================
function ContentTab() {
  const [templates, setTemplates] = useState([]);
  const [content, setContent] = useState([]);
  const [showTplForm, setShowTplForm] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', type: 'custom', content: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [t, c] = await Promise.all([api('getTemplates'), api('getContent')]);
    if (t.success) setTemplates(t.templates);
    if (c.success) setContent(c.assets);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const [savingTpl, setSavingTpl] = useState(false);
  const withLoading = useLoading();
  const addTpl = async (e) => {
    e.preventDefault();
    setSavingTpl(true);
    try {
      const data = await api('addTemplate', tplForm);
      if (data.success) { setShowTplForm(false); setTplForm({ name: '', type: 'custom', content: '' }); load(); }
      else alert(data.error);
    } finally { setSavingTpl(false); }
  };

  if (loading) return <Spinner label="Loading content..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Content & Templates</h2>

      {/* Templates */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-300">Message Templates</h3>
          <button onClick={() => setShowTplForm(!showTplForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Add Template</button>
        </div>
        {showTplForm && (
          <form onSubmit={addTpl} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Template Name" value={tplForm.name} onChange={e => setTplForm({...tplForm, name: e.target.value})} required />
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={tplForm.type} onChange={e => setTplForm({...tplForm, type: e.target.value})}>
                <option value="payment">Payment</option><option value="marketing">Marketing</option><option value="promo">Promo</option><option value="order">Order</option><option value="crypto">Crypto</option><option value="custom">Custom</option>
              </select>
            </div>
            <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" rows="4" placeholder="Message content. Use {name}, {amount} for variables." value={tplForm.content} onChange={e => setTplForm({...tplForm, content: e.target.value})} required />
            <button type="submit" disabled={savingTpl} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{savingTpl ? <BtnSpinner /> : <Icon.Plus />}Save Template</button>
          </form>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => (
            <div key={t._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-white">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{t.type}</span>
                  <button onClick={async () => { await withLoading?.('Deleting template...', async () => { await api('deleteTemplate', { id: t._id }); }); load(); }} className="text-red-400"><Icon.Trash /></button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t.content.substring(0, 100)}</p>
            </div>
          ))}
          {templates.length === 0 && <p className="text-gray-600 text-sm col-span-full text-center py-4">No templates yet.</p>}
        </div>
      </div>

      {/* Content Assets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Content Assets (Logos, Photos)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {content.map(c => (
            <div key={c._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
              {c.url && <img src={c.url} alt={c.name} className="w-full h-24 object-cover rounded mb-2" />}
              <p className="text-xs text-white">{c.name}</p>
              <p className="text-xs text-gray-500">{c.type} - {c.purpose}</p>
              <button onClick={async () => { await withLoading?.('Deleting content...', async () => { await api('deleteContent', { id: c._id }); }); load(); }} className="text-red-400 mt-2"><Icon.Trash /></button>
            </div>
          ))}
          {content.length === 0 && <p className="text-gray-600 text-sm col-span-full text-center py-4">No content assets yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-ADMIN TAB
// ============================================================================
function SubAdminTab() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', permissions: ['dashboard'] });

  const allPerms = ['dashboard', 'apis', 'users', 'campaigns', 'content', 'database', 'blacklist', 'alerts', 'logs', 'settings'];
  const [creating, setCreating] = useState(false);
  const withLoading = useLoading();

  const load = async () => { setLoading(true); const data = await api('getSubAdmins'); if (data.success) setSubs(data.subAdmins); setLoading(false); };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await api('createSubAdmin', form);
      if (data.success) { setShowForm(false); setForm({ username: '', password: '', permissions: ['dashboard'] }); load(); }
      else alert(data.error);
    } finally { setCreating(false); }
  };

  const togglePerm = (perm) => {
    setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
  };

  if (loading) return <Spinner label="Loading sub-admins..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Sub-Admins</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition"><Icon.Plus />Create Sub-Admin</button>
      </div>
      {showForm && (
        <form onSubmit={create} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Permissions (access control):</p>
            <div className="flex flex-wrap gap-2">
              {allPerms.map(p => (
                <label key={p} className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg cursor-pointer border ${form.permissions.includes(p) ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-slate-800 border-slate-700 text-gray-500'}`}>
                  <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} className="hidden" />{p}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{creating ? <BtnSpinner /> : <Icon.Plus />}Create Sub-Admin</button>
        </form>
      )}
      <div className="space-y-2">
        {subs.map(s => (
          <div key={s._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm text-white font-medium">{s.username}</p>
              <p className="text-xs text-gray-500">Permissions: {s.permissions?.join(', ')}</p>
            </div>
            <button onClick={async () => { if (confirm('Delete sub-admin?')) { await withLoading?.('Deleting sub-admin...', async () => { await api('deleteSubAdmin', { id: s._id }); }); load(); } }} className="text-red-400"><Icon.Trash /></button>
          </div>
        ))}
        {subs.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No sub-admins yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// DATABASE TAB
// ============================================================================

function BlacklistTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [number, setNumber] = useState('');
  const [reason, setReason] = useState('spam');

  const [adding, setAdding] = useState(false);
  const withLoading = useLoading();

  const load = async () => { setLoading(true); const data = await api('getBlacklist'); if (data.success) setList(data.blacklist); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const data = await api('addBlacklist', { number, reason });
      if (data.success) { setNumber(''); load(); } else alert(data.error);
    } finally { setAdding(false); }
  };

  if (loading) return <Spinner label="Loading blacklist..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Blacklist</h2>
      <form onSubmit={add} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex gap-3">
        <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Phone number" value={number} onChange={e => setNumber(e.target.value)} required />
        <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm w-40" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">Add</button>
      </form>
      <div className="space-y-2">
        {list.map(b => (
          <div key={b._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
            <div><span className="text-sm text-white">{b.number}</span><span className="text-xs text-gray-500 ml-2">{b.reason}</span></div>
            <button onClick={async () => { await withLoading?.('Removing from blacklist...', async () => { await api('removeBlacklist', { id: b._id }); }); load(); }} className="text-red-400"><Icon.Trash /></button>
          </div>
        ))}
        {list.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No blacklisted numbers.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// ALERTS TAB
// ============================================================================
function AlertsTab() {
  const [settings, setSettings] = useState({ alertWhatsapp: '', alertWhatsappApiKey: '', alertEmail: '', alertEmailApiKey: '', alertEmailFrom: 'alerts@mms-sender.local', alertOnCrash: true, alertOnApiDown: true, alertOnError: true });
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showWaGuide, setShowWaGuide] = useState(false);
  const [showEmailGuide, setShowEmailGuide] = useState(false);
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);
  const copy = (text, key) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };

  useEffect(() => {
    (async () => { const data = await api('getAppSettings'); if (data.success) setSettings(prev => ({ ...prev, ...data.settings })); setLoading(false); })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api('setAlertConfig', settings);
      if (data.success) { setSettings(prev => ({ ...prev, ...data.settings })); setTestResult({ type: 'save', ok: true, msg: 'Alert settings saved successfully' }); }
      else setTestResult({ type: 'save', ok: false, msg: data.error || 'Save failed' });
    } finally { setSaving(false); }
  };

  const testAlert = async () => {
    setTesting(true); setTestResult(null);
    const data = await api('testAlert');
    setTesting(false);
    if (data.success) {
      const r = data.results || {};
      const parts = [];
      if (r.whatsapp) parts.push(`WhatsApp: ${r.whatsapp.success ? '✅ Sent' : '❌ ' + (r.whatsapp.error || 'failed')}`);
      if (r.email) parts.push(`Email: ${r.email.success ? '✅ Sent' : '❌ ' + (r.email.error || 'failed')}`);
      setTestResult({ type: 'test', ok: true, msg: parts.length ? parts.join('  |  ') : 'Test alert processed (no channels configured)' });
    } else setTestResult({ type: 'test', ok: false, msg: data.error || 'Test failed' });
  };

  if (loading) return <Spinner label="Loading alert config..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Alerts & Notifications</h2>
          <p className="text-sm text-gray-400 mt-1">Configure WhatsApp and email alerts for system events. Both channels support free APIs — no credit card required.</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 ${settings.alertWhatsapp && settings.alertWhatsappApiKey ? 'bg-emerald-950/40 border-emerald-800' : 'bg-amber-950/30 border-amber-800'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{settings.alertWhatsapp && settings.alertWhatsappApiKey ? '🟢' : '🟡'}</span>
            <span className="text-sm font-semibold text-white">WhatsApp Channel</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{settings.alertWhatsapp && settings.alertWhatsappApiKey ? 'Configured & ready' : settings.alertWhatsapp ? 'Phone set — API key missing' : 'Not configured'}</p>
        </div>
        <div className={`rounded-xl border p-4 ${settings.alertEmail && settings.alertEmailApiKey ? 'bg-emerald-950/40 border-emerald-800' : 'bg-amber-950/30 border-amber-800'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{settings.alertEmail && settings.alertEmailApiKey ? '🟢' : '🟡'}</span>
            <span className="text-sm font-semibold text-white">Email Channel</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{settings.alertEmail && settings.alertEmailApiKey ? 'Configured & ready' : settings.alertEmail ? 'Email set — API key missing' : 'Not configured'}</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-900/50 border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <span className="text-sm font-semibold text-white">Trigger Rules</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{[settings.alertOnCrash && 'Crash', settings.alertOnApiDown && 'API Down', settings.alertOnError && 'Errors'].filter(Boolean).join(', ') || 'None enabled'}</p>
        </div>
      </div>

      {/* WhatsApp config */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">💬 WhatsApp Alerts <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">Free · CallMeBot</span></h3>
          <button onClick={() => setShowWaGuide(!showWaGuide)} className="text-xs text-blue-400 hover:text-blue-300 underline">{showWaGuide ? 'গাইড লুকান' : 'সেটআপ গাইড দেখুন'}</button>
        </div>

        {showWaGuide && (
          <div className="bg-slate-950/60 border border-slate-700/50 rounded-lg p-4 text-sm text-gray-300 space-y-3">
            <p className="font-semibold text-white text-base">📱 WhatsApp অ্যালার্ট সেটআপ করার সম্পূর্ণ গাইড (বাংলায়)</p>
            <p className="text-xs text-gray-400">CallMeBot একটি ফ্রি সার্ভিস যা আপনার WhatsApp এ অটোমেটিক মেসেজ পাঠায়। নিচের ধাপগুলো হুবহু ফলো করুন:</p>

            <div className="bg-blue-950/30 border border-blue-800/40 rounded-md p-3">
              <p className="text-sm font-semibold text-blue-300">ধাপ ১ — WhatsApp এ CallMeBot নম্বরটি যোগ করুন</p>
              <p className="text-xs text-gray-300 mt-1">আপনার ফোনে WhatsApp ওপেন করুন। নতুন কন্টাক্ট হিসেবে এই নম্বরটি সেভ করুন:</p>
              <div className="bg-slate-800 rounded px-2 py-1.5 mt-1.5 font-mono text-green-300 text-sm flex items-center justify-between">
                <span>+34 694 25 79 52</span>
                <button onClick={() => copy('+34 694 25 79 52', 'wa1')} className="text-xs text-blue-400 hover:text-blue-300">{copied === 'wa1' ? '✓ কপি হয়েছে' : 'কপি করুন'}</button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">⚠️ এই নম্বরটি স্পেনের (Spain)। WhatsApp এ যোগ করলেই হবে — আন্তর্জাতিক কল করতে হবে না।</p>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/40 rounded-md p-3">
              <p className="text-sm font-semibold text-blue-300">ধাপ ২ — অনুমতি মেসেজ পাঠান</p>
              <p className="text-xs text-gray-300 mt-1">উপরের নম্বরে হুবহু নিচের লেখাটি WhatsApp মেসেজ হিসেবে পাঠান (কপি করে পেস্ট করতে পারেন):</p>
              <div className="bg-slate-800 rounded px-2 py-1.5 mt-1.5 font-mono text-green-300 text-sm flex items-center justify-between">
                <span>I allow callmebot to send me messages</span>
                <button onClick={() => copy('I allow callmebot to send me messages', 'wa2')} className="text-xs text-blue-400 hover:text-blue-300">{copied === 'wa2' ? '✓' : 'কপি'}</button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">⚠️ লেখাটি হুবহু একই রকম হতে হবে। বড় হাতের/ছোট হাতের অক্ষর ঠিক রাখুন।</p>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/40 rounded-md p-3">
              <p className="text-sm font-semibold text-blue-300">ধাপ ৩ — API Key সংগ্রহ করুন</p>
              <p className="text-xs text-gray-300 mt-1">মেসেজ পাঠানোর কয়েক সেকেন্ড পর CallMeBot বট আপনাকে রিপ্লাই দেবে। সেই রিপ্লাই মেসেজের ভেতর আপনার <strong className="text-green-300">API Key</strong> লেখা থাকবে (যেমন: <code className="bg-slate-800 px-1 rounded text-green-300">1234567</code>)।</p>
              <p className="text-xs text-amber-300 mt-1.5">⚠️ এই API Key টি সংরক্ষণ করে রাখুন — নিচের ঘরে এটিই বসবে। প্রতিটি WhatsApp নম্বরের জন্য API Key আলাদা।</p>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/40 rounded-md p-3">
              <p className="text-sm font-semibold text-blue-300">ধাপ ৪ — এই প্যানেলে ফোন নম্বর ও API Key বসান</p>
              <p className="text-xs text-gray-300 mt-1">নিচের ঘরে আপনার WhatsApp নম্বর (যে নম্বর থেকে ধাপ ১-৩ করেছেন) এবং CallMeBot থেকে পাওয়া API Key টি বসান।</p>
              <p className="text-xs text-gray-400 mt-1">বাংলাদেশি নম্বরের জন্য ফরম্যাট: <code className="bg-slate-800 px-1 rounded text-green-300">01712345678</code> অথবা <code className="bg-slate-800 px-1 rounded text-green-300">+8801712345678</code> — সিস্টেম অটোমেটিক <code className="bg-slate-800 px-1 rounded text-green-300">88017XXXXXXXX</code> তে কনভার্ট করে নেবে।</p>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/40 rounded-md p-3">
              <p className="text-sm font-semibold text-blue-300">ধাপ ৫ — Save করুন এবং Test করুন</p>
              <p className="text-xs text-gray-300 mt-1">নিচের <strong className="text-white">"Save Settings"</strong> বাটনে চাপ দিন। তারপর <strong className="text-white">"Send Test Alert"</strong> বাটনে চাপ দিন। কিছুক্ষণের মধ্যে আপনার WhatsApp এ একটি টেস্ট মেসেজ আসবে।</p>
              <p className="text-xs text-emerald-300 mt-1.5">✅ যদি টেস্ট মেসেজ আসে — সব ঠিক আছে! এখন থেকে সিস্টেমে কোনো সমস্যা হলে (যেমন API ডাউন, এরর) অটোমেটিক আপনাকে WhatsApp এ জানানো হবে।</p>
            </div>

            <div className="bg-amber-950/20 border border-amber-800/30 rounded-md p-3">
              <p className="text-xs text-amber-300"><strong>সমস্যা হলে:</strong> যদি টেস্ট মেসেজ না আসে — (১) আবার ধাপ ১-২ চেক করুন, নম্বর ঠিক সেভ করেছেন কি না। (২) API Key ঠিক কপি করেছেন কি না। (৩) আপনার ইন্টারনেট কানেকশন ঠিক আছে কি না। CallMeBot ফ্রি সার্ভিস, তাই কখনো কখনো কিছুক্ষণ দেরি হতে পারে।</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">WhatsApp Number <span className="text-amber-400 text-xs">(Bangladesh supported)</span></label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="01712345678 or +8801712345678" value={settings.alertWhatsapp} onChange={e => setSettings({...settings, alertWhatsapp: e.target.value})} />
            <p className="text-xs text-gray-500 mt-1">BD format auto-converted: 017XXX → 88017XXX</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">CallMeBot API Key</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="e.g. 1234567" value={settings.alertWhatsappApiKey} onChange={e => setSettings({...settings, alertWhatsappApiKey: e.target.value})} />
            <p className="text-xs text-gray-500 mt-1">Get it from CallMeBot (see guide above)</p>
          </div>
        </div>
      </div>

      {/* Email config */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">📧 Email Alerts <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Free · Resend</span></h3>
          <button onClick={() => setShowEmailGuide(!showEmailGuide)} className="text-xs text-blue-400 hover:text-blue-300 underline">{showEmailGuide ? 'Hide' : 'Show'} Setup Guide</button>
        </div>

        {showEmailGuide && (
          <div className="bg-slate-950/60 border border-slate-700/50 rounded-lg p-4 text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-white">How to get a free Resend email API key (3000 emails/month, no card):</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Go to <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">https://resend.com</code> and sign up (free, no credit card).</li>
              <li>Verify your email address.</li>
              <li>Go to <strong>API Keys</strong> → <strong>Create API Key</strong> → copy the key (starts with <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">re_...</code>).</li>
              <li>Paste the key in the field below.</li>
              <li>Set "From Email" to <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">onboarding@resend.dev</code> (free testing sender) or your verified domain.</li>
            </ol>
            <p className="text-xs text-amber-300 mt-2">⚠️ With the free plan you can only send TO the email you signed up with unless you verify a custom domain. Use <code className="bg-slate-800 px-1 px-1 rounded text-blue-300">onboarding@resend.dev</code> as the From address for testing.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Alert Recipient Email</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="admin@example.com" value={settings.alertEmail} onChange={e => setSettings({...settings, alertEmail: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Resend API Key</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="re_xxxxxxxx" value={settings.alertEmailApiKey} onChange={e => setSettings({...settings, alertEmailApiKey: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">From Email Address</label>
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="onboarding@resend.dev" value={settings.alertEmailFrom} onChange={e => setSettings({...settings, alertEmailFrom: e.target.value})} />
          <p className="text-xs text-gray-500 mt-1">Use onboarding@resend.dev for free testing, or your verified domain email</p>
        </div>
      </div>

      {/* Trigger rules */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">⚡ Alert Triggers</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer p-2 rounded-lg hover:bg-slate-800/50 transition"><input type="checkbox" checked={settings.alertOnCrash} onChange={e => setSettings({...settings, alertOnCrash: e.target.checked})} className="w-4 h-4 accent-blue-600" />Alert on server crash</label>
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer p-2 rounded-lg hover:bg-slate-800/50 transition"><input type="checkbox" checked={settings.alertOnApiDown} onChange={e => setSettings({...settings, alertOnApiDown: e.target.checked})} className="w-4 h-4 accent-blue-600" />Alert when SMS API goes down</label>
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer p-2 rounded-lg hover:bg-slate-800/50 transition"><input type="checkbox" checked={settings.alertOnError} onChange={e => setSettings({...settings, alertOnError: e.target.checked})} className="w-4 h-4 accent-blue-600" />Alert on errors / bugs</label>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-xl border p-4 text-sm ${testResult.ok ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' : 'bg-red-950/40 border-red-800 text-red-200'}`}>
          <strong>{testResult.type === 'test' ? 'Test Alert Result: ' : 'Save: '}</strong>{testResult.msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-60">{saving ? <BtnSpinner /> : null}Save Settings</button>
        <button onClick={testAlert} disabled={testing} className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">{testing ? <BtnSpinner /> : null}{testing ? 'Sending...' : 'Send Test Alert'}</button>
      </div>
    </div>
  );
}

// ============================================================================
// FREE SMS GUIDE TAB — international + Bangladesh, full Bengali guide
// ============================================================================
function FreeSmsGuideTab() {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">ফ্রি SMS সেন্ডিং API গাইড</h2>
        <p className="text-sm text-gray-400 mt-1">যেকোনো দেশে ফ্রি SMS পাঠানোর সম্পূর্ণ গাইড। কোনো ক্রেডিট কার্ড লাগবে না। নিচে ৩টি অপশন দেওয়া আছে — আন্তর্জাতিক (Textbelt), নিজের ফোন দিয়ে (TextBee), এবং বাংলাদেশের জন্য (Alpha SMS)।</p>
      </div>

      {/* ── Option 1: Textbelt (International — 100+ countries) ── */}
      <div className="bg-slate-900/50 border border-emerald-800/40 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌍</span>
          <div>
            <h3 className="text-lg font-semibold text-white">অপশন ১: Textbelt (আন্তর্জাতিক — সবচেয়ে সহজ) <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full ml-1">100+ দেশ</span></h3>
            <p className="text-xs text-emerald-400">ফ্রি টিয়ার: প্রতিদিন ১টি SMS ফ্রি · কোনো কার্ড নেই · ১০০+ দেশে কাজ করে</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-700/50 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-300">Textbelt একটি সহজ SMS API। ফ্রি API key <code className="bg-slate-800 px-1 rounded text-emerald-300">textbelt</code> ব্যবহার করে প্রতিদিন ১টি SMS ফ্রি পাঠানো যায় — যেকোনো দেশে। আরও বেশি পাঠাতে চাইলে কয়েক ডলারে কেনা যায় (পেমেন্ট ঐচ্ছিক)।</p>

          <p className="text-sm font-semibold text-white pt-1">ধাপে ধাপে সেটআপ:</p>
          <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300">
            <li>এই API টি তৈরি করতে কোনো অ্যাকাউন্ট খোলার দরকার নেই! ফ্রি কী হলো শুধু শব্দটি: <code className="bg-slate-800 px-1 rounded text-emerald-300">textbelt</code></li>
            <li>আপনার সিস্টেমে যান: <strong className="text-sky-400">API Management</strong> → <strong className="text-white">Add Sender API</strong> → provider হিসেবে <strong className="text-white">Custom HTTP</strong> সিলেক্ট করুন।</li>
            <li>Endpoint হিসেবে বসান:
              <button onClick={() => copy('https://textbelt.com/text', 'tb1')} className="text-green-300 hover:underline font-mono text-[11px] ml-1">https://textbelt.com/text</button>
              {copied === 'tb1' && <span className="text-emerald-400"> ✓</span>}
            </li>
            <li><strong className="text-white">API Key</strong> ঘরে বসান: <button onClick={() => copy('textbelt', 'tb2')} className="bg-slate-800 px-1 rounded text-emerald-300 font-mono">textbelt</button> {copied === 'tb2' && <span className="text-emerald-400"> ✓</span>} (এটিই ফ্রি কী)</li>
            <li>ফোন নম্বর অবশ্যই <strong className="text-amber-300">E.164 ফরম্যাটে</strong> হতে হবে — অর্থাৎ কান্ট্রি কোড সহ। যেমন: বাংলাদেশ <code className="bg-slate-800 px-1 rounded">+88017XXXXXXXX</code>, ভারত <code className="bg-slate-800 px-1 rounded">+91XXXXXXXXXX</code>, যুক্তরাষ্ট্র <code className="bg-slate-800 px-1 rounded">+1XXXXXXXXXX</code></li>
            <li>Limit হিসেবে <strong className="text-white">1</strong> দিন (কারণ ফ্রি টিয়ারে প্রতিদিন ১টি)। Save করুন।</li>
          </ol>

          <div className="bg-slate-800/50 border border-slate-700/30 rounded-md p-3 mt-2">
            <p className="text-[10px] text-slate-500 uppercase mb-1">API রিকোয়েস্ট ফরম্যাট (রেফারেন্স):</p>
            <pre className="text-[11px] text-green-300 font-mono overflow-x-auto">{`POST https://textbelt.com/text
Body (form-data or JSON):
{
  "phone": "+8801712345678",
  "message": "আপনার মেসেজ এখানে",
  "key": "textbelt"
}`}</pre>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded-md p-3">
            <span>⚠️</span>
            <p><strong>সীমাবদ্ধতা:</strong> ফ্রি টিয়ারে প্রতিদিন মাত্র ১টি SMS। আরও বেশি পাঠাতে চাইলে <a href="https://textbelt.com/purchase" target="_blank" rel="noopener" className="underline">textbelt.com/purchase</a> থেকে ক্রেডিট কিনুন (খুব সস্তা — প্রায় $0.01/SMS)। বাল্ক স্প্যাম পাঠানো নিষিদ্ধ।</p>
          </div>
        </div>
      </div>

      {/* ── Option 2: TextBee (Your own Android phone) ── */}
      <div className="bg-slate-900/50 border border-sky-800/40 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <h3 className="text-lg font-semibold text-white">অপশন ২: TextBee (নিজের ফোন + SIM দিয়ে)</h3>
            <p className="text-xs text-sky-400">৩০০ SMS/মাস ফ্রি · যেকোনো দেশের SIM কাজ করে · কোনো কার্ড নেই</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-700/50 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-300">TextBee আপনার Android ফোনকে একটি SMS গেটওয়ে বানিয়ে দেয়। আপনার ফোনে একটি SIM থাকলে এবং ইন্টারনেট চালু থাকলে — API এর মাধ্যমে সেই ফোন থেকে SMS পাঠানো যায়। <strong className="text-amber-300">কোনো ক্রেডিট কার্ড লাগে না</strong> — আপনার SIM এর SMS প্যাকেজই ব্যবহার হয়।</p>

          <p className="text-sm font-semibold text-white pt-1">ধাপে ধাপে সেটআপ:</p>
          <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300">
            <li><a href="https://textbee.dev" target="_blank" rel="noopener" className="text-sky-400 hover:underline">textbee.dev</a> এ যান এবং একটি ফ্রি অ্যাকাউন্ট খোলুন (শুধু ইমেইল দিয়ে, কোনো কার্ড নেই)।</li>
            <li>Google Play Store থেকে <strong className="text-white">TextBee Gateway</strong> অ্যাপ ডাউনলোড করুন — যে ফোনটি গেটওয়ে হিসেবে ব্যবহার করবেন সেই ফোনে।</li>
            <li>অ্যাপ ওপেন করুন, আপনার TextBee অ্যাকাউন্ট দিয়ে লগইন করুন, SMS পারমিশন দিন। ফোনটি অন থাকতে হবে এবং ইন্টারনেট কানেক্টেড থাকতে হবে।</li>
            <li>TextBee ওয়েবসাইটে ড্যাশবোর্ড থেকে আপনার <strong className="text-white">API Key</strong> এবং <strong className="text-white">Device ID</strong> নিন।</li>
            <li>এই অ্যাডমিন প্যানেলে যান: <strong className="text-sky-400">API Management</strong> → Add Sender API → provider <strong className="text-white">Custom HTTP</strong>।</li>
            <li>Endpoint বসান: <button onClick={() => copy('https://api.textbee.dev/api/v1/gateway/send-sms', 'tb3')} className="text-green-300 hover:underline font-mono text-[11px]">https://api.textbee.dev/api/v1/gateway/send-sms</button> {copied === 'tb3' && <span className="text-emerald-400"> ✓</span>}</li>
            <li><strong className="text-white">apiKey</strong> = আপনার TextBee API key। <strong className="text-white">apiSecret</strong> = আপনার Device ID। Limit দিন ৩০০। Save করুন।</li>
          </ol>

          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded-md p-3">
            <span>⚠️</span>
            <p><strong>সীমাবদ্ধতা:</strong> গেটওয়ে ফোনটি অনলাইন থাকতে হবে। SMS আপনার SIM প্যাকেজ থেকে যায় (SMS বান্ডল থাকলে ফ্রি)। ফ্রি প্ল্যানে ৩০০ SMS/মাস।</p>
          </div>
        </div>
      </div>

      {/* ── Option 3: Alpha SMS (Bangladesh) ── */}
      <div className="bg-slate-900/50 border border-sky-800/40 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🇧🇩</span>
          <div>
            <h3 className="text-lg font-semibold text-white">অপশন ৩: Alpha SMS (শুধু বাংলাদেশের জন্য)</h3>
            <p className="text-xs text-sky-400">বাংলাদেশি প্রোভাইডার · ট্রায়াল ক্রেডিট · কল করে অ্যাক্টিভেট</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-700/50 rounded-lg p-4 space-y-3">
          <p className="text-xs text-gray-400">Alpha SMS বাংলাদেশের একটি বাল্ক SMS প্রোভাইডার। রেজিস্টার করলে ট্রায়াল ব্যালেন্স (ফ্রি ক্রেডিট) দেয়। আন্তর্জাতিক কার্ড লাগে না — পরে bKash দিয়ে রিচার্জ করা যায়।</p>

          <p className="text-sm font-semibold text-white pt-1">ধাপে ধাপে সেটআপ:</p>
          <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300">
            <li><a href="https://sms.net.bd" target="_blank" rel="noopener" className="text-sky-400 hover:underline">sms.net.bd</a> এ যান এবং বাংলাদেশি নম্বর দিয়ে রেজিস্টার করুন।</li>
            <li><strong className="text-amber-300">তাদের সাপোর্টে কল করুন</strong>: <button onClick={() => copy('+88 09613 250 250', 'tb4')} className="text-green-300 hover:underline font-mono">+88 09613 250 250</button> {copied === 'tb4' && <span className="text-emerald-400"> ✓</span>} — ট্রায়াল ব্যালেন্সের জন্য বলুন। সাধারণত ফ্রি ক্রেডিট দেয়।</li>
            <li>অনুমোদন পেলে ড্যাশবোর্ড থেকে <strong className="text-white">API Key</strong> নিন।</li>
            <li>এই প্যানেলে: <strong className="text-sky-400">API Management</strong> → Add Sender API → <strong className="text-white">Custom HTTP</strong>।</li>
            <li>Endpoint বসান: <button onClick={() => copy('https://api.sms.net.bd/sendsms', 'tb5')} className="text-green-300 hover:underline font-mono text-[11px]">https://api.sms.net.bd/sendsms</button> {copied === 'tb5' && <span className="text-emerald-400"> ✓</span>}</li>
            <li><strong className="text-white">apiKey</strong> = আপনার Alpha SMS API key। Save করুন।</li>
          </ol>
        </div>
      </div>

      {/* ── How to send to ANY country ── */}
      <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">🌐 যেকোনো দেশে SMS কিভাবে পাঠাবেন</h3>
        <p className="text-xs text-gray-300 leading-relaxed">SMS পাঠানোর সময় ফোন নম্বর অবশ্যই <strong className="text-blue-300">E.164 ফরম্যাটে</strong> হতে হবে। এর মানে হলো: <code className="bg-slate-800 px-1 rounded text-blue-300">+</code> চিহ্ন + কান্ট্রি কোড + ফোন নম্বর (শূন্য ছাড়া)।</p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">দেশ</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">কান্ট্রি কোড</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">লোকাল নম্বর</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">E.164 ফরম্যাট</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇧🇩 বাংলাদেশ</td><td className="py-2 px-3 text-blue-300">+880</td><td className="py-2 px-3 font-mono">01712345678</td><td className="py-2 px-3 font-mono text-green-300">+8801712345678</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇮🇳 ভারত</td><td className="py-2 px-3 text-blue-300">+91</td><td className="py-2 px-3 font-mono">09876543210</td><td className="py-2 px-3 font-mono text-green-300">+919876543210</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇺🇸 যুক্তরাষ্ট্র</td><td className="py-2 px-3 text-blue-300">+1</td><td className="py-2 px-3 font-mono">5551234567</td><td className="py-2 px-3 font-mono text-green-300">+15551234567</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇬🇧 যুক্তরাজ্য</td><td className="py-2 px-3 text-blue-300">+44</td><td className="py-2 px-3 font-mono">07123456789</td><td className="py-2 px-3 font-mono text-green-300">+447123456789</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇸🇦 সৌদি আরব</td><td className="py-2 px-3 text-blue-300">+966</td><td className="py-2 px-3 font-mono">0551234567</td><td className="py-2 px-3 font-mono text-green-300">+966551234567</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3">🇲🇾 মালয়েশিয়া</td><td className="py-2 px-3 text-blue-300">+60</td><td className="py-2 px-3 font-mono">0123456789</td><td className="py-2 px-3 font-mono text-green-300">+60123456789</td></tr>
              <tr><td className="py-2 px-3">🇦🇪 আমিরাত</td><td className="py-2 px-3 text-blue-300">+971</td><td className="py-2 px-3 font-mono">0501234567</td><td className="py-2 px-3 font-mono text-green-300">+971501234567</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">নিয়ম: লোকাল নম্বরের শুরুর <strong className="text-white">0</strong> বাদ দিন, তার আগে <strong className="text-white">+ এবং কান্ট্রি কোড</strong> বসান। এই সিস্টেম নম্বরগুলো আপনার ক্যাম্পেইনে এই ফরম্যাটে দিলেই হবে।</p>
        <p className="text-xs text-emerald-300">✅ আরও কান্ট্রি কোড: <a href="https://countrycode.org" target="_blank" rel="noopener" className="underline">countrycode.org</a> থেকে যেকোনো দেশের কোড বের করুন।</p>
      </div>

      {/* ── Comparison ── */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">তুলনা</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">ফিচার</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">🌍 Textbelt</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">📱 TextBee</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">🇧🇩 Alpha SMS</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3 text-slate-500">কার্ড লাগে?</td><td className="py-2 px-3 text-emerald-400">❌ না</td><td className="py-2 px-3 text-emerald-400">❌ না</td><td className="py-2 px-3 text-emerald-400">❌ না</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3 text-slate-500">ফ্রি কোটা</td><td className="py-2 px-3">১ SMS/দিন</td><td className="py-2 px-3">৩০০ SMS/মাস</td><td className="py-2 px-3">ট্রায়াল ক্রেডিট</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3 text-slate-500">দেশ</td><td className="py-2 px-3 text-emerald-400">১০০+ দেশ</td><td className="py-2 px-3">যেকোনো (SIM অনুযায়ী)</td><td className="py-2 px-3">শুধু বাংলাদেশ</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3 text-slate-500">Android ফোন লাগে?</td><td className="py-2 px-3 text-emerald-400">❌ না</td><td className="py-2 px-3 text-amber-400">✅ হ্যাঁ</td><td className="py-2 px-3 text-emerald-400">❌ না</td></tr>
              <tr className="border-b border-slate-800/50"><td className="py-2 px-3 text-slate-500">সেটআপ সময়</td><td className="py-2 px-3">২ মিনিট</td><td className="py-2 px-3">১০ মিনিট</td><td className="py-2 px-3">১ দিন (কলের জন্য)</td></tr>
              <tr><td className="py-2 px-3 text-slate-500">ভালো কিসের জন্য</td><td className="py-2 px-3">দ্রুত টেস্ট, আন্তর্জাতিক</td><td className="py-2 px-3">ফ্রি বাল্ক, যেকোনো দেশ</td><td className="py-2 px-3">বাংলাদেশ প্রোডাকশন</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── How to add in this system ── */}
      <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">📌 এই সিস্টেমে কিভাবে API যোগ করবেন</h3>
        <p className="text-xs text-gray-300 leading-relaxed">API key পাওয়ার পর: <strong className="text-sky-400">API Management</strong> ট্যাব → <strong className="text-white">Add Sender API</strong> → <strong className="text-white">Custom HTTP</strong> সিলেক্ট করুন → endpoint URL ও API key পেস্ট করুন → limit দিন → save করুন। সিস্টেম অটোমেটিক ক্যাম্পেইন ও অটো-রিপ্লাইতে এটি ব্যবহার করবে। টেস্ট করতে চাইলে API Management এ প্রতিটি API এর পাশে <strong className="text-white">Test</strong> বাটন আছে।</p>
      </div>
    </div>
  );
}

// ============================================================================
// LOGS TAB
// ============================================================================
function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { const data = await api('getActivityLogs', { limit: 200 }); if (data.success) setLogs(data.logs); setLoading(false); })();
  }, []);

  if (loading) return <Spinner label="Loading activity logs..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {logs.map((l, i) => (
          <div key={i} className="bg-slate-900/30 border border-slate-800/50 rounded-lg px-3 py-2 text-sm flex gap-3">
            <span className="text-gray-600 text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</span>
            <span className={`text-xs px-1.5 rounded ${l.actorType === 'admin' ? 'bg-blue-900/40 text-blue-400' : l.actorType === 'user' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>{l.actorType}</span>
            <span className="text-gray-300 flex-1">{l.action}: <span className="text-gray-500">{l.details}</span></span>
            {l.ipAddress && <span className="text-gray-600 text-xs">{l.ipAddress}</span>}
          </div>
        ))}
        {logs.length === 0 && <p className="text-gray-600 text-sm py-8 text-center">No activity logs yet.</p>}
      </div>
    </div>
  );
}

// ============================================================================
// SECURITY TAB (admin credential management with mail verification)
// ============================================================================
function SecurityTab({ user }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [message, setMessage] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => { setLoading(true); const data = await api('getAdminCredentials'); if (data.success) setInfo(data.credentials); setLoading(false); };
  useEffect(() => { load(); }, []);

  const doAction = async (action, data) => {
    setActing(true);
    try {
      const res = await api(action, { ...data, verificationCode });
      if (res.needVerification) {
        setPendingAction(action);
        setMessage(`Verification code sent to ${info?.email || 'admin email'}. Code: ${res.code || '(check console)'}`);
      } else if (res.success) {
        setMessage(`${action} completed successfully!`);
        setVerificationCode(''); setPendingAction(null);
        if (action === 'updateAdminApiKey') setMessage(`New API Key: ${res.apiKey}`);
        load();
      } else {
        setMessage(res.error || 'Failed');
      }
    } finally { setActing(false); }
  };

  if (loading) return <Spinner label="Loading security..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Admin Security</h2>
      {info && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 max-w-lg">
          <div className="space-y-2 text-sm">
            <p className="text-gray-400">Current Username: <span className="text-white font-mono">{info.username}</span></p>
            <p className="text-gray-400">API Key: <span className="text-white font-mono">{info.apiKeyMasked}</span></p>
            <p className="text-gray-400">Email: <span className="text-white">{info.email || 'Not set (add email to enable verification)'}</span></p>
          </div>
        </div>
      )}
      {message && <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg px-4 py-2 text-sm text-blue-300">{message}</div>}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 max-w-lg">
        {pendingAction && (
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Verification Code</label>
            <div className="flex gap-2">
              <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="6-digit code" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} />
              <button onClick={() => doAction(pendingAction, pendingAction === 'updateAdminUsername' ? { newUsername } : pendingAction === 'updateAdminPassword' ? { newPassword } : {})} disabled={acting} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{acting ? <BtnSpinner /> : null}Verify & Confirm</button>
            </div>
          </div>
        )}
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Change Username</label>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="New username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            <button onClick={() => doAction('updateAdminUsername', { newUsername })} disabled={acting} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{acting ? <BtnSpinner size={12} /> : null}Change</button>
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Change Password</label>
          <div className="flex gap-2">
            <input type="password" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="New password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button onClick={() => doAction('updateAdminPassword', { newPassword })} disabled={acting} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{acting ? <BtnSpinner size={12} /> : null}Change</button>
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Regenerate API Key</label>
          <button onClick={() => doAction('updateAdminApiKey', {})} disabled={acting} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-60">{acting ? <BtnSpinner size={12} /> : null}Generate New API Key</button>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Set Admin Email (for verification)</label>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="admin@example.com" defaultValue={info?.email} onBlur={async (e) => { await api('updateAdminEmail', { email: e.target.value }); load(); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB
// ============================================================================
function SettingsTab() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => { const data = await api('getAppSettings'); if (data.success) setSettings(data.settings); setLoading(false); })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api('updateAppSettings', { settings });
      if (data.success) alert('Settings saved'); else alert(data.error);
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading settings..." />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 max-w-2xl">
        <h3 className="text-lg font-semibold text-gray-300">Primary Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Platform Name</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.platformName || ''} onChange={e => setSettings({...settings, platformName: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Logo URL</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.logoUrl || ''} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Description</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.description || ''} onChange={e => setSettings({...settings, description: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">WhatsApp Number</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.whatsapp || ''} onChange={e => setSettings({...settings, whatsapp: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Email</label>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.email || ''} onChange={e => setSettings({...settings, email: e.target.value})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Language</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.language || 'en'} onChange={e => setSettings({...settings, language: e.target.value})}>
              <option value="en">English</option><option value="bn">Bengali</option>
            </select>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 pt-4">MMS Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Default User Limit</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.defaultUserLimit || 100} onChange={e => setSettings({...settings, defaultUserLimit: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Default User Expiry (days)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.defaultUserExpiryDays || 30} onChange={e => setSettings({...settings, defaultUserExpiryDays: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Rate Limit (per minute)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.rateLimitPerMinute || 10} onChange={e => setSettings({...settings, rateLimitPerMinute: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1.5">Rate Limit (per hour)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={settings.rateLimitPerHour || 100} onChange={e => setSettings({...settings, rateLimitPerHour: parseInt(e.target.value)})} />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 pt-4">Spam Protection</h3>
        <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={settings.spamProtection !== false} onChange={e => setSettings({...settings, spamProtection: e.target.checked})} />Enable spam protection (invalid numbers won't send)</label>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1.5">Country Rules (JSON)</label>
          <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono" rows="3" placeholder='{"BD": "allow", "US": "allow"}' value={settings.countryRules || ''} onChange={e => setSettings({...settings, countryRules: e.target.value})} />
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm px-6 py-2.5 rounded-lg transition font-semibold disabled:opacity-60">{saving ? <BtnSpinner /> : null}Save All Settings</button>
      </div>
    </div>
  );
}

// ============================================================================
// GATEWAY ENGINE DASHBOARD TAB (Phase 4 UI — Email-to-MMS Gateway)
// ============================================================================
// This component provides the admin UI for the Email-to-MMS Gateway engine
// that was built across Phases 1-4. It calls the REST API endpoints under
// /api/admin/gateway/* (and /api/admin/system/deploy-hook) to display:
//
//   • Overview  — live health metrics (account pool, throughput, carrier
//                 cache, delivery pipeline, config summary)
//   • Config    — edit SystemConfig (routing delay, batch size, phishing
//                 filter, Gemini key, carrier lookup key, Render deploy URL,
//                 blocked keywords)
//   • Accounts  — email account pool management (add account, view health,
//                 reset cooldown)
//   • Logs      — unified live log feed (activity + delivery reports)
//   • Preview   — dry-run MMS payload preview (safety filter + AI rewrite +
//                 carrier lookup)
//   • Deploy    — trigger Render.com deploy hook + clear carrier cache
//
// The gatewayApi() helper below calls the REST endpoints with credentials
// (the JWT cookie is sent automatically via credentials: 'include').
// ============================================================================


// ============================================================================
// NEW DASHBOARD TAB — Enterprise Overview (replaces old overview user hated)
// ============================================================================
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api('getDashboardStats');
      if (data.success) { setStats(data); setError(''); }
      else setError(data.error || 'Failed to load dashboard');
    } catch (e) { setError(e.message); }
    setLoading(false); setRefreshing(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  if (loading && !stats) return <SkeletonGrid count={6} />;

  const s = stats || {};
  const db = s.database || {};
  const grade = s.grade || 'B';
  const gradeColor = grade === 'A' ? 'emerald' : grade === 'B' ? 'sky' : grade === 'C' ? 'amber' : 'rose';
  const liveUsers = s.activeUsers || 0;
  const totalUsers = s.totalUsers || 0;
  const totalSms = s.totalSms || 0;
  const todaySms = s.todaySms || 0;
  const successRate = s.successRate || 0;
  const apiKeys = s.totalApiKeys || 0;
  const activeCampaigns = s.activeCampaigns || 0;

  return (
    <div className="space-y-6">
      {/* Hero grade banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 border border-white/10">
        <div className="absolute inset-0 bg-grid-white/[0.03] pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-300/70 font-semibold">System Grade</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-5xl font-black ${grade === 'A' ? 'text-emerald-400' : grade === 'B' ? 'text-sky-400' : grade === 'C' ? 'text-amber-400' : 'text-rose-400'}`}>{grade}</span>
              <div>
                <p className="text-white text-lg font-bold">{grade === 'A' ? 'Excellent Health' : grade === 'B' ? 'Good — Stable' : grade === 'C' ? 'Needs Attention' : 'Critical'}</p>
                <p className="text-xs text-slate-400">Auto-evaluated from DB load, latency & throughput</p>
              </div>
            </div>
          </div>
          <button onClick={load} disabled={refreshing} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50">
            <IconByName name="refresh" size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Users" value={totalUsers} icon="users" accent="sky" sub={`${liveUsers} live now`} live={liveUsers > 0} />
        <Kpi label="Messages Today" value={todaySms} icon="message" accent="emerald" sub={`${totalSms} all-time`} />
        <Kpi label="Delivery Rate" value={`${successRate.toFixed(1)}%`} icon="check" accent="violet" sub={successRate > 95 ? 'Excellent' : successRate > 80 ? 'Good' : 'Check logs'} />
        <Kpi label="Active API Keys" value={apiKeys} icon="key" accent="amber" sub={`${activeCampaigns} campaigns running`} />
      </div>

      {/* Detail boxes grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DetailBox
          title="Database Health"
          subtitle="Real MongoDB metrics"
          icon="server"
          accent="cyan"
          live
          action={<button onClick={() => window.dispatchEvent(new CustomEvent('admin-tab', { detail: 'database' }))} className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold">Open DB →</button>}
        >
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Storage Used</span>
              <span className="text-white font-bold">{db.usedMB ? db.usedMB.toFixed(1) : '0'} <span className="text-slate-500 text-xs">MB</span></span>
            </div>
            <ProgressBar value={db.usagePercent || 0} max={100} color={db.usagePercent > 80 ? 'rose' : db.usagePercent > 60 ? 'amber' : 'emerald'} />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{(db.usagePercent || 0).toFixed(1)}% used</span>
              <span>{db.freeMB ? db.freeMB.toFixed(0) : '512'} MB free</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
              <span className="text-slate-400">Response Time</span>
              <span className="text-emerald-400 font-bold">{db.responseMs ? db.responseMs.toFixed(0) : '--'}ms</span>
            </div>
          </div>
        </DetailBox>

        <DetailBox title="Throughput" subtitle="Message delivery pipeline" icon="bolt" accent="amber">
          <div className="mt-3">
            <RadialGauge value={successRate} max={100} label="Success %" size={120} />
            <div className="grid grid-cols-2 gap-2 mt-3 text-center">
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-lg font-bold text-white">{todaySms}</p>
                <p className="text-[10px] text-slate-500 uppercase">Today</p>
              </div>
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-lg font-bold text-white">{totalSms}</p>
                <p className="text-[10px] text-slate-500 uppercase">All-time</p>
              </div>
            </div>
          </div>
        </DetailBox>

        <DetailBox title="Live Presence" subtitle="Users active in last 5 min" icon="users" accent="emerald" live={liveUsers > 0}>
          <div className="mt-3">
            <UserPresenceList users={s.recentUsers || []} />
          </div>
        </DetailBox>
      </div>

      {/* Mini bar chart + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DetailBox title="7-Day Activity" subtitle="Messages per day" icon="chart" accent="indigo">
          <div className="mt-4">
            <MiniBars
              values={(s.weeklyActivity || []).map(d => typeof d === 'number' ? d : (d.count || d.value || 0))}
              labels={(s.weeklyActivity || []).map((d, i) => typeof d === 'object' ? (d.day || d.label || d.date || '') : `D${i + 1}`)}
            />
            {(!s.weeklyActivity || s.weeklyActivity.length === 0) && <p className="text-slate-500 text-sm text-center py-4">No activity data yet</p>}
          </div>
        </DetailBox>
        <DetailBox title="Recent Events" subtitle="Latest system activity" icon="list" accent="slate">
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">
            {(s.recentActivity || []).map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-white/5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.type === 'send' ? 'bg-emerald-400' : a.type === 'error' ? 'bg-rose-400' : 'bg-sky-400'}`} />
                <span className="text-slate-300 flex-1 truncate">{a.message || a.action || '—'}</span>
                <span className="text-xs text-slate-600 flex-shrink-0">{a.time || a.createdAt || ''}</span>
              </div>
            ))}
            {(!s.recentActivity || s.recentActivity.length === 0) && <p className="text-slate-500 text-sm text-center py-8">No recent activity</p>}
          </div>
        </DetailBox>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm">
          <IconByName name="alert" size={16} className="inline mr-2" />{error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEW DATABASE TAB — 100% Real MongoDB Stats (fixes user's #1 complaint)
// ============================================================================
function DatabaseTab() {
  const [conns, setConns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', uri: '', storageLimit: 512 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadConns = async () => {
    const data = await api('getMongoConnections');
    if (data.success) setConns(data.connections);
  };
  const loadStats = async () => {
    setRefreshing(true); setError('');
    try {
      const data = await api('getDatabaseStats');
      if (data.success) setStats(data);
      else setError(data.error || 'Could not fetch real DB stats');
    } catch (e) { setError(e.message); }
    setRefreshing(false);
  };
  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadConns(), loadStats()]);
    setLoading(false);
  };
  useEffect(() => { loadAll(); const t = setInterval(loadStats, 15000); return () => clearInterval(t); }, []);

  const add = async (e) => {
    e.preventDefault(); setCreating(true);
    try {
      const data = await api('addMongoConnection', form);
      if (data.success) { setShowForm(false); setForm({ label: '', uri: '', storageLimit: 512 }); loadConns(); }
      else alert(data.error || 'Failed');
    } catch (e) { alert(e.message); }
    setCreating(false);
  };
  const setActive = async (id) => {
    const data = await api('setActiveMongo', { id });
    if (data.success) { loadConns(); loadStats(); }
    else alert(data.error || 'Failed');
  };
  const remove = async (id) => {
    if (!confirm('Remove this connection?')) return;
    const data = await api('removeMongoConnection', { id });
    if (data.success) loadConns();
  };

  if (loading) return <SkeletonGrid count={4} />;

  const st = stats || {};
  const usagePct = st.usagePercent || 0;
  const freeMB = st.freeMB || 0;
  const usedMB = st.usedMB || 0;
  const limitMB = st.limitMB || 512;
  const respMs = st.responseMs || 0;

  return (
    <div className="space-y-6">
      {/* REAL DB Stats Hero — the user's primary complaint fix */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <DetailBox title="Storage Usage" subtitle={`${st.dbName || 'database'} • real data`} icon="server" accent={usagePct > 80 ? 'rose' : usagePct > 60 ? 'amber' : 'emerald'} live action={
          <button onClick={loadStats} disabled={refreshing} className="text-xs text-slate-400 hover:text-white font-semibold flex items-center gap-1">
            <IconByName name="refresh" size={12} className={refreshing ? 'animate-spin' : ''} /> Live
          </button>
        }>
          <div className="mt-4 space-y-3">
            <div className="text-center">
              <span className={`text-4xl font-black ${usagePct > 80 ? 'text-rose-400' : usagePct > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>{usagePct.toFixed(2)}</span>
              <span className="text-lg text-slate-400">%</span>
              <p className="text-xs text-slate-500 mt-1">used of {limitMB} MB limit</p>
            </div>
            <ProgressBar value={usagePct} max={100} color={usagePct > 80 ? 'rose' : usagePct > 60 ? 'amber' : 'emerald'} />
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-white font-bold text-sm">{usedMB.toFixed(1)}</p>
                <p className="text-slate-500">MB used</p>
              </div>
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-emerald-400 font-bold text-sm">{freeMB.toFixed(0)}</p>
                <p className="text-slate-500">MB free</p>
              </div>
            </div>
          </div>
        </DetailBox>

        <DetailBox title="Response Time" subtitle="Real ping latency" icon="bolt" accent={respMs < 50 ? 'emerald' : respMs < 200 ? 'amber' : 'rose'} live>
          <div className="mt-4 text-center">
            <span className={`text-4xl font-black ${respMs < 50 ? 'text-emerald-400' : respMs < 200 ? 'text-amber-400' : 'text-rose-400'}`}>{respMs.toFixed(0)}</span>
            <span className="text-lg text-slate-400">ms</span>
            <p className="text-xs text-slate-500 mt-1">MongoDB ping</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${st.readyState === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {st.readyState === 1 ? '● Connected' : '● Disconnected'}
              </span>
            </div>
            {st.host && <p className="text-[10px] text-slate-600 mt-2 truncate">{st.host}</p>}
          </div>
        </DetailBox>

        <DetailBox title="Data & Indexes" subtitle="On-disk breakdown" icon="database" accent="violet">
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-400">Data Size</span><span className="text-violet-300 font-bold">{(st.dataMB || 0).toFixed(1)} MB</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Index Size</span><span className="text-indigo-300 font-bold">{(st.indexMB || 0).toFixed(1)} MB</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">On Disk</span><span className="text-sky-300 font-bold">{(st.storageOnDiskMB || 0).toFixed(1)} MB</span></div>
            <div className="pt-2 border-t border-white/5 grid grid-cols-3 gap-1 text-center text-xs">
              <div><p className="text-white font-bold">{st.objects || 0}</p><p className="text-slate-500">Objects</p></div>
              <div><p className="text-white font-bold">{st.collections || 0}</p><p className="text-slate-500">Collections</p></div>
              <div><p className="text-white font-bold">{st.indexes || 0}</p><p className="text-slate-500">Indexes</p></div>
            </div>
          </div>
        </DetailBox>

        <DetailBox title="Engine Info" subtitle="MongoDB server details" icon="info" accent="slate">
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Version</span><span className="text-white font-mono">{st.dbVersion || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Engine</span><span className="text-white font-mono">{st.engine || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Avg Obj Size</span><span className="text-white font-mono">{(st.avgObjSize || 0).toFixed(0)} B</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Collections</span><span className="text-white font-mono">{st.collections || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Measured</span><span className="text-slate-300 text-xs">{st.measuredAt ? new Date(st.measuredAt).toLocaleTimeString() : '—'}</span></div>
          </div>
        </DetailBox>
      </div>

      {/* Collection Details table */}
      {st.collectionDetails && st.collectionDetails.length > 0 && (
        <DetailBox title="Collection Breakdown" subtitle="Per-collection real document counts & sizes" icon="list" accent="cyan">
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-4">Collection</th>
                  <th className="py-2 pr-4 text-right">Docs</th>
                  <th className="py-2 pr-4 text-right">Data</th>
                  <th className="py-2 pr-4 text-right">Storage</th>
                  <th className="py-2 pr-4 text-right">Index</th>
                  <th className="py-2 text-right">Avg Size</th>
                </tr>
              </thead>
              <tbody>
                {st.collectionDetails.sort((a, b) => (b.storageSize || 0) - (a.storageSize || 0)).map((c, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4 font-mono text-sky-300">{c.name}</td>
                    <td className="py-2 pr-4 text-right text-white">{c.count?.toLocaleString() || 0}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{((c.size || 0) / 1048576).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{((c.storageSize || 0) / 1048576).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{((c.totalIndexSize || 0) / 1048576).toFixed(2)}</td>
                    <td className="py-2 text-right text-slate-400">{(c.avgObjSize || 0).toFixed(0)} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailBox>
      )}

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm flex items-center gap-2">
          <IconByName name="alert" size={16} /> {error} — ensure MongoDB URI is configured.
        </div>
      )}

      {/* Connection manager */}
      <DetailBox
        title="MongoDB Connections"
        subtitle="Multi-database routing"
        icon="server"
        accent="sky"
        action={<button onClick={() => setShowForm(s => !s)} className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-semibold flex items-center gap-1.5"><IconByName name="plus" size={14} /> Add</button>}
      >
        <div className="mt-3 space-y-2">
          {conns.map((c) => (
            <div key={c._id} className={`flex items-center justify-between p-3 rounded-xl border ${c.isActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.isActive ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                  <IconByName name="server" size={18} className={c.isActive ? 'text-emerald-400' : 'text-slate-400'} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{c.label}</p>
                  <p className="text-xs text-slate-500 font-mono">{c.uri ? c.uri.replace(/:\/\/.*@/, '://***@') : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">ACTIVE</span>}
                {!c.isActive && <button onClick={() => setActive(c._id)} className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white">Set Active</button>}
                <button onClick={() => remove(c._id)} className="text-xs px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300">Remove</button>
              </div>
            </div>
          ))}
          {conns.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No connections configured</p>}

          {showForm && (
            <form onSubmit={add} className="bg-slate-900/50 rounded-xl p-4 border border-white/10 space-y-3">
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Label (e.g. Primary)" required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
              <input value={form.uri} onChange={e => setForm({ ...form, uri: e.target.value })} placeholder="mongodb+srv://..." required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
              <input type="number" value={form.storageLimit} onChange={e => setForm({ ...form, storageLimit: Number(e.target.value) })} placeholder="Storage limit MB" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
              <button type="submit" disabled={creating} className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50">{creating ? 'Adding...' : 'Add Connection'}</button>
            </form>
          )}
        </div>
      </DetailBox>
    </div>
  );
}


// ============================================================================
// GATEWAY DASHBOARD — PRIMARY TAB (user's most important section)
// All sub-tabs: Overview, Config, Accounts, Validator, Lookup, Logs, Preview, Deploy
// ============================================================================
function GatewayDashboardTab() {
  const [sub, setSub] = useState('overview');
  const subTabs = [
    { id: 'overview', label: 'Overview', icon: 'chart' },
    { id: 'config', label: 'Gateway Settings', icon: 'settings', primary: true },
    { id: 'accounts', label: 'Email Accounts', icon: 'mail' },
    { id: 'validator', label: 'HLR Validator', icon: 'check' },
    { id: 'lookup', label: 'Provider & Country', icon: 'globe' },
    { id: 'logs', label: 'Live Logs', icon: 'list' },
    { id: 'preview', label: 'MMS Preview', icon: 'eye' },
    { id: 'deploy', label: 'Deploy', icon: 'rocket' },
  ];
  return (
    <div className="space-y-4">
      {/* Primary badge banner */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-900/40 to-indigo-900/40 rounded-xl px-4 py-3 border border-violet-500/20">
        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <IconByName name="bolt" size={20} className="text-violet-400" />
        </div>
        <div>
          <p className="text-white font-bold text-sm flex items-center gap-2">Email-to-MMS Gateway <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-200 uppercase tracking-wider font-bold">Primary</span></p>
          <p className="text-xs text-slate-400">Core delivery engine — carrier routing, HLR validation, AI rewriting, proxy masking</p>
        </div>
      </div>
      {/* Sub-tab nav */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${sub === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${t.primary && sub === t.id ? 'ring-1 ring-violet-500/50' : ''}`}>
            <IconByName name={t.icon} size={14} /> {t.label}
            {t.primary && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
          </button>
        ))}
      </div>
      {sub === 'overview' && <GatewayOverview />}
      {sub === 'config' && <GatewayConfig />}
      {sub === 'accounts' && <GatewayAccounts />}
      {sub === 'validator' && <GatewayValidator />}
      {sub === 'lookup' && <GatewayLookup />}
      {sub === 'logs' && <GatewayLogs />}
      {sub === 'preview' && <GatewayPreview />}
      {sub === 'deploy' && <GatewayDeploy />}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────
function GatewayOverview() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try { const d = await gatewayApi('/admin/gateway/health'); if (d.success || d.accountPool) setHealth(d); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  if (loading) return <SkeletonGrid count={4} />;
  const h = health || {};
  const pool = h.accountPool || {};
  const throughput = h.throughput || {};
  const carrier = h.carrierCache || {};
  const delivery = h.delivery24h || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Accounts Online" value={`${pool.active || 0}/${pool.total || 0}`} icon="mail" accent="emerald" sub={`${pool.cooldown || 0} cooling down`} />
        <Kpi label="Throughput /min" value={throughput.lastMinute || 0} icon="bolt" accent="amber" sub={`${throughput.lastHour || 0} / hour`} />
        <Kpi label="Carrier Cache Hit" value={`${(carrier.hitRate || 0).toFixed(0)}%`} icon="database" accent="violet" sub={`${carrier.size || 0} entries`} />
        <Kpi label="24h Delivery" value={`${(delivery.successRate || 0).toFixed(1)}%`} icon="check" accent="sky" sub={`${delivery.total || 0} sent`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DetailBox title="Account Pool Health" subtitle="Per-provider availability" icon="mail" accent="emerald" live>
          <div className="mt-3 space-y-2">
            {Object.entries(pool.byProvider || {}).map(([prov, info]) => (
              <div key={prov} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-white/5">
                <span className="text-slate-300 font-mono text-xs">{prov}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">{info.active || 0} active</span>
                  <span className="text-amber-400">{info.cooldown || 0} cooldown</span>
                  <span className="text-rose-400">{info.suspended || 0} susp.</span>
                </div>
              </div>
            ))}
            {Object.keys(pool.byProvider || {}).length === 0 && <p className="text-slate-500 text-sm text-center py-4">No accounts configured</p>}
          </div>
        </DetailBox>
        <DetailBox title="Delivery Last 24h" subtitle="Success & failure breakdown" icon="chart" accent="sky">
          <div className="mt-3 space-y-3">
            <ProgressBar value={delivery.successRate || 0} max={100} color={delivery.successRate > 90 ? 'emerald' : 'amber'} />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-emerald-500/10 rounded-lg py-2"><p className="text-emerald-400 font-bold text-base">{delivery.delivered || 0}</p><p className="text-slate-500">Delivered</p></div>
              <div className="bg-amber-500/10 rounded-lg py-2"><p className="text-amber-400 font-bold text-base">{delivery.pending || 0}</p><p className="text-slate-500">Pending</p></div>
              <div className="bg-rose-500/10 rounded-lg py-2"><p className="text-rose-400 font-bold text-base">{delivery.failed || 0}</p><p className="text-slate-500">Failed</p></div>
            </div>
          </div>
        </DetailBox>
      </div>
    </div>
  );
}

// ── Config (PRIMARY — ALL SystemConfig options) ──────────────────────────
function GatewayConfig() {
  const [config, setConfig] = useState(null);
  const [dynamic, setDynamic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [form, setForm] = useState({
    geminiApiKey: '', carrierLookupApiKey: '', routingDelaySeconds: 3, batchSizePerAccount: 5,
    enablePhishingFilter: true, blockedKeywords: ['bank', 'otp', 'passcode', 'credit card'], renderDeployUrl: '',
  });
  const [dynForm, setDynForm] = useState({
    routingDelayMs: 3000, batchSizePerAccount: 5, maxConcurrency: 10, queuePaused: false,
    aiPolymorphEnabled: true, safetyFilterEnabled: true,
  });

  const load = async () => {
    try {
      const [cfg, dyn] = await Promise.all([
        gatewayApi('/admin/gateway?resource=config'),
        gatewayApi('/admin/gateway/dynamic'),
      ]);
      if (cfg.success && cfg.config) {
        setConfig(cfg.config);
        setForm({
          geminiApiKey: cfg.config.geminiApiKey || '', carrierLookupApiKey: cfg.config.carrierLookupApiKey || '',
          routingDelaySeconds: cfg.config.routingDelaySeconds ?? 3, batchSizePerAccount: cfg.config.batchSizePerAccount ?? 5,
          enablePhishingFilter: cfg.config.enablePhishingFilter ?? true,
          blockedKeywords: cfg.config.blockedKeywords || ['bank', 'otp', 'passcode', 'credit card'],
          renderDeployUrl: cfg.config.renderDeployUrl || '',
        });
      }
      if (dyn.success && dyn.config) {
        setDynamic(dyn.config);
        setDynForm({
          routingDelayMs: dyn.config.routingDelayMs ?? 3000, batchSizePerAccount: dyn.config.batchSizePerAccount ?? 5,
          maxConcurrency: dyn.config.maxConcurrency ?? 10, queuePaused: dyn.config.queuePaused ?? false,
          aiPolymorphEnabled: dyn.config.aiPolymorphEnabled ?? true, safetyFilterEnabled: dyn.config.safetyFilterEnabled ?? true,
        });
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveConfig = async (e) => {
    e.preventDefault(); setSaving(true); setSavedMsg('');
    try {
      const d = await gatewayApi('/admin/gateway', { method: 'POST', body: JSON.stringify({ resource: 'config', action: 'update', config: form }) });
      if (d.success) { setSavedMsg('✓ Gateway config saved'); setConfig(d.config || form); }
      else setSavedMsg(`✗ ${d.error || 'Failed'}`);
    } catch (e) { setSavedMsg(`✗ ${e.message}`); }
    setSaving(false); setTimeout(() => setSavedMsg(''), 4000);
  };
  const saveDynamic = async () => {
    setSaving(true);
    try {
      const d = await gatewayApi('/admin/gateway/dynamic', { method: 'POST', body: JSON.stringify(dynForm) });
      if (d.success) setSavedMsg('✓ Runtime config updated');
      else setSavedMsg(`✗ ${d.error || 'Failed'}`);
    } catch (e) { setSavedMsg(`✗ ${e.message}`); }
    setSaving(false); setTimeout(() => setSavedMsg(''), 4000);
  };
  const toggleKeyword = (kw) => {
    setForm(f => ({ ...f, blockedKeywords: f.blockedKeywords.includes(kw) ? f.blockedKeywords.filter(k => k !== kw) : [...f.blockedKeywords, kw] }));
  };

  if (loading) return <SkeletonGrid count={4} />;

  return (
    <div className="space-y-4">
      {savedMsg && <div className={`rounded-xl p-3 text-sm font-semibold ${savedMsg.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>{savedMsg}</div>}

      {/* AI / Rewriting */}
      <DetailBox title="AI Rewriting Engine" subtitle="Gemini-powered message polymorphism" icon="bolt" accent="violet" live>
        <form onSubmit={saveConfig} className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Gemini API Key</label>
            <input value={form.geminiApiKey} onChange={e => setForm({ ...form, geminiApiKey: e.target.value })} placeholder="AIzaSy... or AQ...." type="password" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
            <p className="text-[10px] text-slate-500 mt-1">Used for AI message rewriting / polymorphism to bypass carrier filters</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
              <input type="checkbox" checked={form.enablePhishingFilter} onChange={e => setForm({ ...form, enablePhishingFilter: e.target.checked })} className="w-4 h-4 rounded accent-violet-500" />
              Enable Phishing / Safety Filter
            </label>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Blocked Keywords ({form.blockedKeywords.length})</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.blockedKeywords.map(kw => (
                <button type="button" key={kw} onClick={() => toggleKeyword(kw)} className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-xs flex items-center gap-1 hover:bg-rose-500/25">{kw} <IconByName name="x" size={10} /></button>
              ))}
            </div>
            <input onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) { setForm(f => ({ ...f, blockedKeywords: [...f.blockedKeywords, v] })); e.target.value = ''; } } }} placeholder="Add keyword + Enter" className="w-full mt-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs" />
          </div>
        </form>
      </DetailBox>

      {/* Routing & Throttling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DetailBox title="Routing & Throttling" subtitle="Persistent config (SystemConfig)" icon="settings" accent="sky">
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Routing Delay (seconds)</label>
              <input type="number" value={form.routingDelaySeconds} onChange={e => setForm({ ...form, routingDelaySeconds: Number(e.target.value) })} min="0" max="60" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Batch Size / Account</label>
              <input type="number" value={form.batchSizePerAccount} onChange={e => setForm({ ...form, batchSizePerAccount: Number(e.target.value) })} min="1" max="100" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Carrier Lookup API Key (HLR)</label>
              <input value={form.carrierLookupApiKey} onChange={e => setForm({ ...form, carrierLookupApiKey: e.target.value })} placeholder="sk_..." type="password" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Render Deploy Webhook URL</label>
              <input value={form.renderDeployUrl} onChange={e => setForm({ ...form, renderDeployUrl: e.target.value })} placeholder="https://api.render.com/deploy/..." className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
            </div>
          </div>
        </DetailBox>

        <DetailBox title="Runtime Overrides" subtitle="Hot-reloadable (Redis) — no restart needed" icon="bolt" accent="amber" live>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Routing Delay (ms) — live override</label>
              <input type="number" value={dynForm.routingDelayMs} onChange={e => setDynForm({ ...dynForm, routingDelayMs: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Max Concurrency</label>
              <input type="number" value={dynForm.maxConcurrency} onChange={e => setDynForm({ ...dynForm, maxConcurrency: Number(e.target.value) })} min="1" max="50" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                <input type="checkbox" checked={dynForm.queuePaused} onChange={e => setDynForm({ ...dynForm, queuePaused: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" /> Pause Queue
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                <input type="checkbox" checked={dynForm.aiPolymorphEnabled} onChange={e => setDynForm({ ...dynForm, aiPolymorphEnabled: e.target.checked })} className="w-4 h-4 rounded accent-violet-500" /> AI Polymorph
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                <input type="checkbox" checked={dynForm.safetyFilterEnabled} onChange={e => setDynForm({ ...dynForm, safetyFilterEnabled: e.target.checked })} className="w-4 h-4 rounded accent-emerald-500" /> Safety Filter
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                <input type="number" value={dynForm.batchSizePerAccount} onChange={e => setDynForm({ ...dynForm, batchSizePerAccount: Number(e.target.value) })} className="w-12 px-1 py-0 rounded bg-transparent text-white text-sm" /> Batch
              </label>
            </div>
            <button onClick={saveDynamic} disabled={saving} className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Applying...' : 'Apply Runtime Overrides'}</button>
          </div>
        </DetailBox>
      </div>

      {/* Provider weights info */}
      <DetailBox title="Provider Priority Weights" subtitle="Routing preference order (higher = preferred)" icon="info" accent="indigo">
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
          {PROVIDER_TYPES.map(p => (
            <div key={p.id} className="bg-white/5 rounded-lg p-3 text-center">
              <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-500/20 flex items-center justify-center mb-1">
                <IconByName name="mail" size={16} className="text-indigo-400" />
              </div>
              <p className="text-white text-xs font-bold">{p.label}</p>
              <p className="text-indigo-300 text-lg font-black">{p.weight}</p>
              <p className="text-[9px] text-slate-500">{p.note}</p>
            </div>
          ))}
        </div>
      </DetailBox>

      <button onClick={saveConfig} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        <IconByName name="save" size={18} /> {saving ? 'Saving Gateway Configuration...' : 'Save Gateway Configuration'}
      </button>
    </div>
  );
}

// ── Email Accounts (CRUD with provider country logic) ────────────────────
function GatewayAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ provider: 'GMAIL_OAUTH', email: '', label: '', dailyLimit: 400, credentials: {} });
  const [testResult, setTestResult] = useState({});
  // Send Test Email modal + state
  const [testEmailModal, setTestEmailModal] = useState(null); // { account, toEmail }
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null); // { ok, message }
  // Gmail OAuth — candidates.json upload + auto-setup
  const [gmailFile, setGmailFile] = useState(null);          // parsed candidates.json
  const [gmailFileName, setGmailFileName] = useState('');    // display name
  const [gmailFileError, setGmailFileError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthResult, setOauthResult] = useState(null);      // { success, message }

  // Parse the uploaded candidates.json (Google OAuth client credentials JSON)
  const handleGmailFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGmailFileError(''); setOauthResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Google's downloaded credentials JSON has shape:
      //   { "installed": { "client_id", "client_secret", ... } }
      // or { "web": { ... } }
      const creds = json.installed || json.web || json;
      const clientId = creds.client_id;
      const clientSecret = creds.client_secret;
      if (!clientId || !clientSecret) {
        setGmailFileError('Invalid candidates.json — missing client_id or client_secret.');
        setGmailFile(null); setGmailFileName('');
        return;
      }
      setGmailFile({ clientId, clientSecret, redirectUris: creds.redirect_uris || [] });
      setGmailFileName(file.name);
      // Auto-fill the credentials in the form so manual save still works as fallback
      setForm(f => ({ ...f, credentials: { ...f.credentials, clientId, clientSecret } }));
    } catch {
      setGmailFileError('Could not parse the file. Please upload a valid candidates.json from Google Cloud Console.');
      setGmailFile(null); setGmailFileName('');
    }
  };

  // Start the OAuth consent flow — opens a popup window
  const startGmailOAuth = async () => {
    if (!gmailFile) { setOauthResult({ success: false, message: 'Please upload candidates.json first.' }); return; }
    setOauthLoading(true); setOauthResult(null);
    const computedOrigin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
    const computedRedirectUri = `${computedOrigin}/api/auth/gmail/callback`;
    const statePayload = {
      clientId: gmailFile.clientId,
      clientSecret: gmailFile.clientSecret,
      label: form.label || '',
      dailyLimit: form.dailyLimit || 400,
      redirectOrigin: computedOrigin,
      // Carry the registered redirect URIs from candidates.json so the backend
      // can match the current deployment against what Google Cloud accepts.
      redirectUris: gmailFile.redirectUris || [],
      // Explicit computed URI for the current deployment (highest priority fallback)
      redirectUri: computedRedirectUri,
    };
    const state = btoa(JSON.stringify(statePayload));
    const oauthUrl = `/api/auth/gmail?state=${encodeURIComponent(state)}`;
    // Open in a centered popup
    const w = 520, h = 700;
    const left = (window.screen.width - w) / 2, top = (window.screen.height - h) / 2;
    const popup = window.open(oauthUrl, 'gmail-oauth', `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`);
    // Listen for the postMessage result from the callback page
    const handler = (event) => {
      if (event.data && event.data.type === 'gmail-oauth-result') {
        window.removeEventListener('message', handler);
        setOauthLoading(false);
        setOauthResult({ success: event.data.success, message: event.data.message });
        if (event.data.success) {
          // Close the form + reload accounts after a short delay
          setTimeout(() => { setShowForm(false); setGmailFile(null); setGmailFileName(''); load(); }, 1500);
        }
      }
    };
    window.addEventListener('message', handler);
    // Fallback timeout — if popup closes without sending a message
    setTimeout(() => {
      if (popup && popup.closed) {
        window.removeEventListener('message', handler);
        setOauthLoading(false);
      }
    }, 120000);
  };

  const load = async () => {
    try {
      // Use GET with ?resource=accounts to list accounts (POST is for mutations only).
      const d = await gatewayApi('/admin/gateway?resource=accounts');
      if (d.success) { setAccounts(d.accounts || []); setConfig(d.config || {}); }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = { resource: 'accounts', action: editing ? 'update' : 'create', account: { ...form, _id: editing?._id } };
      const d = await gatewayApi('/admin/gateway', { method: 'POST', body: JSON.stringify(body) });
      if (d.success) { setShowForm(false); setEditing(null); setForm({ provider: 'GMAIL_OAUTH', email: '', label: '', dailyLimit: 400, credentials: {} }); load(); }
      else alert(d.error || 'Failed');
    } catch (e) { alert(e.message); }
    setSaving(false);
  };
  const del = async (id) => {
    if (!confirm('Delete this account?')) return;
    const d = await gatewayApi('/admin/gateway', { method: 'POST', body: JSON.stringify({ resource: 'accounts', action: 'delete', accountId: id }) });
    if (d.success) load();
  };
  const edit = (a) => { setEditing(a); setForm({ provider: a.provider, email: a.email, label: a.label || '', dailyLimit: a.dailyLimit || 400, credentials: a.credentials || {} }); setShowForm(true); };
  const testAccount = async (a) => {
    setTestResult(t => ({ ...t, [a._id]: 'testing' }));
    try {
      const d = await gatewayApi('/admin/gateway', { method: 'POST', body: JSON.stringify({ resource: 'accounts', action: 'test', accountId: a._id }) });
      setTestResult(t => ({ ...t, [a._id]: d.success ? 'ok' : 'fail' }));
    } catch { setTestResult(t => ({ ...t, [a._id]: 'fail' })); }
  };
  const resetCooldown = async (a) => {
    const d = await gatewayApi('/admin/gateway', { method: 'POST', body: JSON.stringify({ resource: 'accounts', action: 'reset', accountId: a._id }) });
    if (d.success) load();
  };

  // Send a REAL test email from the configured email account to a destination
  // email address (e.g. the admin's own Gmail) to verify the account can send.
  const sendTestEmail = async () => {
    if (!testEmailModal || !testEmailModal.account) return;
    const toEmail = (testEmailModal.toEmail || '').trim();
    if (!toEmail) { setTestEmailResult({ ok: false, message: 'গন্তব্য ইমেইল ঠিকানা দিন।' }); return; }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const d = await gatewayApi('/admin/gateway', {
        method: 'POST',
        body: JSON.stringify({
          resource: 'accounts',
          action: 'sendTestEmail',
          accountId: testEmailModal.account._id,
          toEmail,
          subject: testEmailModal.subject || 'MMS Gateway — Test Email ✉️',
          message: testEmailModal.message || '',
        }),
      });
      if (d.success) {
        setTestEmailResult({ ok: true, message: `✅ সফল! ${testEmailModal.account.email} থেকে ${toEmail} এ টেস্ট ইমেইল পাঠানো হয়েছে।${d.messageId ? ` (Message ID: ${d.messageId})` : ''}` });
      } else {
        setTestEmailResult({ ok: false, message: `❌ ব্যর্থ: ${d.error || 'অজানা ত্রুটি'}${d.bounceType && d.bounceType !== 'UNKNOWN' ? ` (type: ${d.bounceType})` : ''}` });
      }
    } catch (e) {
      setTestEmailResult({ ok: false, message: `❌ নেটওয়ার্ক ত্রুটি: ${e.message}` });
    }
    setSendingTestEmail(false);
  };

  const providerInfo = (id) => PROVIDER_TYPES.find(p => p.id === id) || { label: id, weight: 0, note: '' };

  if (loading) return <SkeletonGrid count={4} />;

  return (
    <div className="space-y-4">
      <DetailBox
        title="Email Sender Accounts"
        subtitle={`${accounts.length} configured • ${accounts.filter(a => a.status === 'ACTIVE').length} active`}
        icon="mail" accent="emerald" live
        action={<button onClick={() => { setShowForm(s => !s); setEditing(null); setForm({ provider: 'GMAIL_OAUTH', email: '', label: '', dailyLimit: 400, credentials: {} }); }} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"><IconByName name="plus" size={14} /> Add Account</button>}
      >
        <div className="mt-3 space-y-2">
          {accounts.map(a => {
            const pi = providerInfo(a.provider);
            return (
              <div key={a._id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${a.status === 'ACTIVE' ? 'bg-emerald-500/20' : a.status === 'COOLDOWN' ? 'bg-amber-500/20' : 'bg-rose-500/20'}`}>
                    <IconByName name="mail" size={18} className={a.status === 'ACTIVE' ? 'text-emerald-400' : a.status === 'COOLDOWN' ? 'text-amber-400' : 'text-rose-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{a.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">{pi.label}</span>
                      <span className="text-[10px] text-slate-500">w={pi.weight}</span>
                      {a.label && <span className="text-[10px] text-slate-400">• {a.label}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-right text-xs mr-2">
                    <p className="text-white font-bold">{a.sentToday || 0}/{a.dailyLimit || 400}</p>
                    <p className="text-slate-500 text-[9px]">sent today</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${a.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : a.status === 'COOLDOWN' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>{a.status}</span>
                  {testResult[a._id] === 'testing' && <BtnSpinner />}
                  {testResult[a._id] === 'ok' && <span className="text-emerald-400 text-xs">✓</span>}
                  {testResult[a._id] === 'fail' && <span className="text-rose-400 text-xs">✗</span>}
                  <button onClick={() => testAccount(a)} title="Test connection" className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"><IconByName name="check" size={12} /></button>
                  <button onClick={() => setTestEmailModal({ account: a, toEmail: '', subject: '', message: '' })} title="Send test email" className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300"><IconByName name="send" size={12} /></button>
                  {a.status === 'COOLDOWN' && <button onClick={() => resetCooldown(a)} title="Reset cooldown" className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"><IconByName name="refresh" size={12} /></button>}
                  <button onClick={() => edit(a)} title="Edit" className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"><IconByName name="edit" size={12} /></button>
                  <button onClick={() => del(a._id)} title="Delete" className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"><IconByName name="trash" size={12} /></button>
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No accounts configured. Click "Add Account" to begin.</p>}
        </div>
      </DetailBox>

      {/* Add/Edit form */}
      {showForm && (
        <DetailBox title={editing ? 'Edit Account' : 'Add Email Account'} subtitle="Configure sender with provider-specific credentials" icon="plus" accent="sky">
          <form onSubmit={save} className="mt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Provider Type</label>
                <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value, credentials: {} })} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {PROVIDER_TYPES.map(p => <option key={p.id} value={p.id} className="bg-slate-800">{p.label} (w={p.weight})</option>)}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">{providerInfo(form.provider).note}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sender@gmail.com" required type="email" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">Label (optional)</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Primary Gmail" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">Daily Send Limit</label>
                <input type="number" value={form.dailyLimit} onChange={e => setForm({ ...form, dailyLimit: Number(e.target.value) })} min="1" max="2000" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
              </div>
            </div>

            {/* Provider-specific credential fields */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-3">Credentials — {providerInfo(form.provider).label}</p>
              {form.provider === 'GMAIL_OAUTH' && (
                <div className="space-y-3">
                  {/* Candidates.json upload — the new OAuth flow */}
                  <div className="bg-emerald-900/15 border border-emerald-700/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                      <IconByName name="upload" size={12} /> Gmail OAuth — candidates.json আপলোড করুন
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client ID →
                      "Download JSON" করে ফাইলটি এখানে আপলোড করুন। তারপপর নিচের "Add" বাটনে চাপ দিলে
                      ডিরেক্ট Google পারমিশন উইন্ডো ওপেন হবে — পারমিশন দিলে অ্যাকাউন্ট অটো-সেটআপ হয়ে যাবে।
                    </p>
                    <label className="flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-emerald-600/40 hover:border-emerald-500/60 rounded-lg py-3 px-3 transition bg-emerald-900/10 hover:bg-emerald-900/20">
                      <IconByName name="upload" size={16} className="text-emerald-400" />
                      <span className="text-xs text-emerald-200">
                        {gmailFileName ? `✓ ${gmailFileName}` : 'candidates.json নির্বাচন করুন (Click to upload)'}
                      </span>
                      <input type="file" accept=".json,application/json" onChange={handleGmailFile} className="hidden" />
                    </label>
                    {gmailFileError && <p className="text-xs text-rose-400">{gmailFileError}</p>}
                    {gmailFile && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={startGmailOAuth} disabled={oauthLoading}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg font-semibold transition">
                          {oauthLoading ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>Waiting for Google permission…</> : <>🔗 Add (Google Permission খুলবে)</>}
                        </button>
                        <span className="text-[10px] text-slate-500">Client ID: {String(gmailFile.clientId).substring(0, 25)}…</span>
                      </div>
                    )}
                    {gmailFile && (
                      <div className="mt-1 rounded-lg border border-amber-600/40 bg-amber-900/15 p-2">
                        <p className="text-[10px] text-amber-300 font-semibold mb-1">⚠️ Google Cloud-এ এই Redirect URI যোগ করা আছে কিনা যাচাই করুন:</p>
                        <code className="block text-[10px] text-amber-100 bg-black/30 rounded px-2 py-1 break-all select-all">{(typeof window !== 'undefined' ? window.location.origin.replace(/\/$/,'') : '') + '/api/auth/gmail/callback'}</code>
                        <p className="text-[9px] text-amber-400/70 mt-1">
                          Google Cloud Console → APIs &amp; Services → Credentials → আপনার OAuth Client → "Authorized redirect URIs" → উপরের URI যোগ করুন। যোগ করা না থাকলে <strong className="text-amber-300">Error 400: redirect_uri_mismatch</strong> দেখাবে।
                        </p>
                        <button type="button" onClick={() => { const uri = (typeof window !== 'undefined' ? window.location.origin.replace(/\/$/,'') : '') + '/api/auth/gmail/callback'; try { navigator.clipboard?.writeText(uri); } catch(e){} }} className="mt-1 text-[10px] text-amber-200 hover:text-amber-100 underline">📋 URI কপি করুন</button>
                      </div>
                    )}
                    {oauthResult && (
                      <div className={`text-xs p-2 rounded-lg ${oauthResult.success ? 'bg-green-900/40 text-green-300 border border-green-700/40' : 'bg-rose-900/40 text-rose-300 border border-rose-700/40'}`}>
                        {oauthResult.success ? '✅' : '❌'} {oauthResult.message}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 border-t border-white/5 pt-2">
                      ⚙️ Manual mode (optional): নিচের ঘরগুলোতা manually clientId / clientSecret / refreshToken বসালেও কাজ করবে।
                    </p>
                  </div>
                  {/* Manual credential fields (fallback) */}
                  <input value={form.credentials.clientId || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, clientId: e.target.value } })} placeholder="OAuth Client ID" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                  <input value={form.credentials.clientSecret || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, clientSecret: e.target.value } })} placeholder="OAuth Client Secret" type="password" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                  <input value={form.credentials.refreshToken || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, refreshToken: e.target.value } })} placeholder="Refresh Token (auto-filled by OAuth)" type="password" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                </div>
              )}
              {form.provider === 'GMAIL_APP_PASSWORD' && (
                <div className="space-y-3">
                  <div className="bg-emerald-900/15 border border-emerald-700/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                      <IconByName name="mail" size={12} /> Gmail App Password — easiest method (no OAuth setup)
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      1. Go to <span className="text-emerald-300 font-mono">myaccount.google.com</span> → Security → 2-Step Verification (must be ON)<br/>
                      2. Visit <span className="text-emerald-300 font-mono">myaccount.google.com/apppasswords</span> → create app password for "Mail"<br/>
                      3. Copy the 16-character password (no spaces) and paste below.
                    </p>
                  </div>
                  <input
                    value={form.credentials.appPassword || ''}
                    onChange={e => setForm({ ...form, credentials: { ...form.credentials, appPassword: e.target.value } })}
                    placeholder="16-character App Password (e.g. abcd efgh ijkl mnop)"
                    type="password"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-500">The email address above is used as the SMTP username. Connection test verifies smtp.gmail.com:465.</p>
                </div>
              )}
              {form.provider === 'OUTLOOK_GRAPH' && (
                <div className="space-y-2">
                  <input value={form.credentials.clientId || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, clientId: e.target.value } })} placeholder="Azure App Client ID" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                  <input value={form.credentials.clientSecret || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, clientSecret: e.target.value } })} placeholder="Azure App Secret" type="password" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                  <input value={form.credentials.tenantId || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, tenantId: e.target.value } })} placeholder="Tenant ID" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                </div>
              )}
              {(form.provider === 'YAHOO' || form.provider === 'AOL') && (
                <div className="space-y-2">
                  <input value={form.credentials.password || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, password: e.target.value } })} placeholder="App Password" type="password" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                </div>
              )}
              {form.provider === 'CUSTOM_SMTP' && (
                <div className="space-y-2">
                  <input value={form.credentials.host || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, host: e.target.value } })} placeholder="SMTP Host (smtp.example.com)" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                  <input type="number" value={form.credentials.port || 587} onChange={e => setForm({ ...form, credentials: { ...form.credentials, port: Number(e.target.value) } })} placeholder="Port" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                  <input value={form.credentials.user || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, user: e.target.value } })} placeholder="SMTP Username" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                  <input value={form.credentials.pass || ''} onChange={e => setForm({ ...form, credentials: { ...form.credentials, pass: e.target.value } })} placeholder="SMTP Password" type="password" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving...' : (editing ? 'Update Account' : 'Add Account')}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Cancel</button>
            </div>
          </form>
        </DetailBox>
      )}

      {/* Send Test Email Modal — send a real email from this account to verify */}
      {testEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { if (!sendingTestEmail) { setTestEmailModal(null); setTestEmailResult(null); } }}>
          <div className="bg-slate-900 border border-cyan-700/40 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><IconByName name="send" size={18} className="text-cyan-400" /> Send Test Email</h3>
                <p className="text-xs text-slate-500 mt-1">From: <span className="text-cyan-300 font-mono">{testEmailModal.account.email}</span> ({testEmailModal.account.provider})</p>
              </div>
              <button onClick={() => { if (!sendingTestEmail) { setTestEmailModal(null); setTestEmailResult(null); } }} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="bg-cyan-900/15 border border-cyan-700/30 rounded-lg p-3 text-xs text-cyan-200/80 leading-relaxed">
              ℹ️ এই টেস্ট ইমেইলটি আপনার কনফিগ করা ইমেইল অ্যাকাউন্ট থেকে সরাসরি পাঠানো হবে। গন্তব্য ইমেইল (আপনার নিজের Gmail) দিন এবং "Send Test Email" বাটনে ক্লিক করুন। ইমেইল এলে অ্যাকাউন্ট কাজ করছে নিশ্চিত হবে।
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">To Email (গন্তব্য) *</label>
                <input type="email" value={testEmailModal.toEmail || ''} onChange={e => setTestEmailModal({ ...testEmailModal, toEmail: e.target.value })} placeholder="your-personal@gmail.com" className="w-full mt-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:border-cyan-500/50" autoFocus />
                <p className="text-[10px] text-slate-500 mt-1">আপনার নিজের Gmail ঠিকানা দিন — টেস্ট ইমেইল এখানে আসবে।</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">Subject (optional)</label>
                <input value={testEmailModal.subject || ''} onChange={e => setTestEmailModal({ ...testEmailModal, subject: e.target.value })} placeholder="MMS Gateway — Test Email ✉️" className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">Message (optional)</label>
                <textarea value={testEmailModal.message || ''} onChange={e => setTestEmailModal({ ...testEmailModal, message: e.target.value })} placeholder="Leave empty to use default test message" rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm resize-none" />
              </div>
            </div>

            {testEmailResult && (
              <div className={`rounded-lg p-3 text-sm ${testEmailResult.ok ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300' : 'bg-rose-900/30 border border-rose-700/40 text-rose-300'}`}>
                {testEmailResult.message}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={sendTestEmail} disabled={sendingTestEmail || !testEmailModal.toEmail} className="flex-1 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                {sendingTestEmail ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>পাঠানো হচ্ছে…</> : <><IconByName name="send" size={16} /> Send Test Email</>}
              </button>
              <button onClick={() => { if (!sendingTestEmail) { setTestEmailModal(null); setTestEmailResult(null); } }} disabled={sendingTestEmail} className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HLR Validator (test number → carrier resolution) ─────────────────────
function GatewayValidator() {
  const [number, setNumber] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const country = resolveCountryFromNumber(number);
  const run = async () => {
    if (!number.trim()) { setError('Enter a phone number'); return; }
    setTesting(true); setError(''); setResult(null);
    try {
      const d = await gatewayApi('/admin/gateway/preview', { method: 'POST', body: JSON.stringify({ phoneNumber: number, text: text || 'Test MMS message from validator' }) });
      if (d.success || d.ok) setResult(d);
      else setError(d.error || d.message || 'Validation failed');
    } catch (e) { setError(e.message); }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <DetailBox title="HLR Carrier Validator" subtitle="Test any number → carrier, MMS domain, E.164, line type, AI rewrite" icon="check" accent="emerald" live>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-semibold">Phone Number</label>
            <input value={number} onChange={e => setNumber(e.target.value)} placeholder="+1 555 123 4567" className="w-full mt-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-mono" />
            {country && number.length > 3 && (
              <div className="mt-2 flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                <span className="text-2xl">{country.flag}</span>
                <div>
                  <p className="text-white font-bold">{country.name}</p>
                  <p className="text-xs text-slate-500">Code: +{country.dial} • MMS: {country.mms ? '✓ supported' : '⚠ check carrier'}</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 font-semibold">Test Message (optional)</label>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter a test message to also see AI rewriting + safety check" rows={2} className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
          </div>
          <button onClick={run} disabled={testing} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {testing ? <><BtnSpinner /> Validating via HLR...</> : <><IconByName name="check" size={18} /> Validate Number + Resolve Carrier</>}
          </button>
        </div>
      </DetailBox>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm"><IconByName name="alert" size={16} className="inline mr-2" />{error}</div>}

      {result && (
        <DetailBox title="Validation Result" subtitle="Full carrier resolution pipeline" icon="info" accent="violet">
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Status', result.ok ? '✓ Valid' : '✗ Blocked', result.ok ? 'emerald' : 'rose'],
              ['E.164 Format', result.e164 || '—', 'sky'],
              ['MMS Address', result.mmsAddress || '—', 'violet'],
              ['Carrier Name', result.carrierName || '—', 'amber'],
              ['Carrier Domain', result.carrierDomain || '—', 'cyan'],
              ['Line Type', result.lineType || '—', 'indigo'],
              ['Carrier Source', result.carrierSource || '—', 'slate'],
              ['AI Source', result.aiSource || '—', 'violet'],
            ].map(([label, val, color]) => (
              <div key={label} className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">{label}</p>
                <p className="text-white text-sm font-mono mt-0.5 break-all">{val}</p>
              </div>
            ))}
          </div>
          {result.rewrittenText && result.rewrittenText !== result.originalText && (
            <div className="mt-3 bg-violet-500/10 border border-violet-500/30 rounded-xl p-3">
              <p className="text-xs text-violet-300 font-semibold mb-1">AI Rewritten Message</p>
              <p className="text-white text-sm">{result.rewrittenText}</p>
            </div>
          )}
          {result.safetyCheck && (
            <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-xs text-amber-300 font-semibold">Safety Check: {typeof result.safetyCheck === 'string' ? result.safetyCheck : JSON.stringify(result.safetyCheck)}</p>
            </div>
          )}
        </DetailBox>
      )}
    </div>
  );
}

// ── Provider & Country Lookup ─────────────────────────────────────────────
function GatewayLookup() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('carriers');

  const filteredCarriers = CARRIER_DOMAINS.filter(c =>
    !query || c.carrier.toLowerCase().includes(query.toLowerCase()) || c.domain.toLowerCase().includes(query.toLowerCase())
  );
  const filteredCountries = COUNTRY_CODES.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()) || String(c.dial).includes(query)
  );
  const supportedCountries = COUNTRY_CODES.filter(c => c.mms);

  return (
    <div className="space-y-4">
      {/* Quick lookup by number */}
      <DetailBox title="Number → Country Lookup" subtitle="Enter any number to detect country, dial code, and MMS support" icon="phone" accent="sky">
        <div className="mt-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="+1 555 123 4567  OR  country name  OR  carrier name" className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-mono" />
          {query && resolveCountryFromNumber(query) && (
            <div className="mt-3 bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex items-center gap-4">
              <span className="text-4xl">{resolveCountryFromNumber(query).flag}</span>
              <div className="flex-1">
                <p className="text-white text-lg font-bold">{resolveCountryFromNumber(query).name}</p>
                <div className="flex items-center gap-3 text-sm mt-1">
                  <span className="text-sky-300 font-mono">+{resolveCountryFromNumber(query).dial}</span>
                  <span className={resolveCountryFromNumber(query).mms ? 'text-emerald-400' : 'text-amber-400'}>{resolveCountryFromNumber(query).mms ? '✓ MMS supported' : '⚠ Limited MMS'}</span>
                  {resolveCountryFromNumber(query).note && <span className="text-slate-500 text-xs">{resolveCountryFromNumber(query).note}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </DetailBox>

      {/* Sub-tab switch */}
      <div className="flex gap-1">
        {[
          { id: 'carriers', label: `Carrier Domains (${CARRIER_DOMAINS.length})` },
          { id: 'countries', label: `Country Codes (${COUNTRY_CODES.length})` },
          { id: 'supported', label: `MMS Supported (${supportedCountries.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {/* Carrier domains table */}
      {tab === 'carriers' && (
        <DetailBox title="Carrier → MMS Domain Mapping" subtitle="Used for email-to-MMS routing" icon="mail" accent="violet">
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-white/10"><th className="py-2 pr-4">Carrier</th><th className="py-2 pr-4">MMS Gateway Domain</th><th className="py-2">Note</th></tr></thead>
              <tbody>
                {filteredCarriers.map(c => (
                  <tr key={c.carrier} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4 text-white font-semibold">{c.carrier}</td>
                    <td className="py-2 pr-4 text-cyan-300 font-mono">{c.domain}</td>
                    <td className="py-2 text-slate-500 text-xs">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailBox>
      )}

      {/* Country codes grid */}
      {tab === 'countries' && (
        <DetailBox title="Country Dial Codes" subtitle="All supported country codes with MMS gateway support flags" icon="globe" accent="emerald">
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredCountries.map(c => (
              <div key={c.code} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-2xl">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 font-mono">+{c.dial}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${c.mms ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{c.mms ? 'MMS ✓' : 'Limited'}</span>
              </div>
            ))}
          </div>
        </DetailBox>
      )}

      {/* MMS supported countries only */}
      {tab === 'supported' && (
        <DetailBox title="Countries with Full MMS Support" subtitle="These countries have confirmed email-to-MMS gateway coverage" icon="check" accent="emerald">
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {supportedCountries.map(c => (
              <div key={c.code} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <span className="text-3xl block">{c.flag}</span>
                <p className="text-white text-xs font-bold mt-1">{c.name}</p>
                <p className="text-emerald-300 text-xs font-mono">+{c.dial}</p>
                {c.note && <p className="text-[9px] text-slate-500 mt-1">{c.note}</p>}
              </div>
            ))}
          </div>
        </DetailBox>
      )}
    </div>
  );
}

// ── Live Logs (preserved logic from existing GatewayLogs) ─────────────────
function GatewayLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const LIMIT = 25;

  const load = async () => {
    try {
      const d = await gatewayApi(`/admin/gateway/logs?page=${page}&limit=${LIMIT}${filter ? `&q=${encodeURIComponent(filter)}` : ''}`);
      if (d.success) { setLogs(d.entries || []); setTotal(d.total || 0); }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [page, filter]);

  if (loading) return <SkeletonGrid count={3} />;
  const pages = Math.ceil(total / LIMIT) || 1;

  const entryClasses = (e) => {
    if (e.level === 'error' || e.status === 'failed') return { dot: 'bg-rose-400', badge: 'bg-rose-500/20 text-rose-300' };
    if (e.level === 'warn' || e.status === 'pending') return { dot: 'bg-amber-400', badge: 'bg-amber-500/20 text-amber-300' };
    if (e.status === 'delivered') return { dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' };
    return { dot: 'bg-sky-400', badge: 'bg-sky-500/20 text-sky-300' };
  };

  return (
    <div className="space-y-4">
      <DetailBox title="Gateway Live Logs" subtitle={`${total} total entries • auto-refresh 5s`} icon="list" accent="slate" live
        action={<input value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} placeholder="Filter..." className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs w-40" />}
      >
        <div className="mt-3 space-y-1.5 max-h-[500px] overflow-auto">
          {logs.map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm">
              {(() => { const ec = entryClasses(e); return <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ec.dot}`} />; })()}
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 truncate">{e.message || e.action || e.text || '—'}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                  {e.phoneNumber && <span className="font-mono">{e.phoneNumber}</span>}
                  {e.carrier && <span>{e.carrier}</span>}
                  {e.provider && <span className="font-mono">{e.provider}</span>}
                  <span>{e.time || (e.createdAt && new Date(e.createdAt).toLocaleTimeString())}</span>
                </div>
              </div>
              {e.status && (() => { const ec = entryClasses(e); return <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${ec.badge} flex-shrink-0`}>{e.status}</span>; })()}
            </div>
          ))}
          {logs.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No logs found</p>}
        </div>
      </DetailBox>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs disabled:opacity-30">← Prev</button>
          <span className="text-slate-400 text-xs">Page {page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}

// ── MMS Preview (dry-run payload builder) ─────────────────────────────────
function GatewayPreview() {
  const [number, setNumber] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!number.trim()) { setError('Enter a phone number'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const d = await gatewayApi('/admin/gateway/preview', { method: 'POST', body: JSON.stringify({ phoneNumber: number, text }) });
      if (d.success || d.ok) setResult(d); else setError(d.error || 'Preview failed');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <DetailBox title="MMS Payload Preview" subtitle="Dry-run the full pipeline without sending — see E.164, carrier domain, AI rewrite" icon="eye" accent="cyan">
        <div className="mt-3 space-y-3">
          <input value={number} onChange={e => setNumber(e.target.value)} placeholder="+1 555 123 4567" className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-mono" />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Message text to preview..." rows={4} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
          <button onClick={run} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><BtnSpinner /> Building payload...</> : <><IconByName name="eye" size={18} /> Generate Preview</>}
          </button>
        </div>
      </DetailBox>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm"><IconByName name="alert" size={16} className="inline mr-2" />{error}</div>}
      {result && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Raw Pipeline Output</p>
          <pre className="text-xs text-emerald-300 font-mono overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ── Deploy (trigger Render webhook + status) ──────────────────────────────
function GatewayDeploy() {
  const [deploying, setDeploying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState('');
  const [renderUrl, setRenderUrl] = useState('');
  const [deploys, setDeploys] = useState([]);
  const [loadingDeploys, setLoadingDeploys] = useState(false);

  const loadConfig = async () => {
    try {
      const d = await gatewayApi('/admin/gateway?resource=config');
      if (d.success && d.config) setRenderUrl(d.config.renderDeployUrl || '');
    } catch {}
  };

  const loadDeploys = async () => {
    setLoadingDeploys(true);
    try {
      const d = await deployHookApi({});
      if (d.success && d.deploys) setDeploys(d.deploys);
    } catch {}
    setLoadingDeploys(false);
  };

  useEffect(() => { loadConfig(); loadDeploys(); }, []);

  const trigger = async (clearCache = false) => {
    if (clearCache) { setClearing(true); } else { setDeploying(true); }
    setStatus(clearCache ? 'Triggering deploy with cache clear...' : 'Triggering Render deploy...');
    try {
      const d = await deployHookApi({ mode: 'direct', clearCache });
      if (d.success) {
        setStatus(`✓ Deploy triggered! ${d.deployId ? 'Deploy ID: ' + d.deployId.slice(0, 12) : ''} — Render rebuilding in ~30-60s`);
        setTimeout(() => loadDeploys(), 5000);
      } else {
        if (renderUrl) {
          setStatus('Direct mode failed, trying webhook...');
          const d2 = await deployHookApi({ url: renderUrl, clearCache });
          setStatus(d2.success ? `✓ Deploy webhook triggered — Render will rebuild in ~30s` : `✗ ${d2.error || d.error || 'Deploy failed'}`);
        } else {
          setStatus(`✗ ${d.error || d.message || 'Deploy failed — set RENDER_API_KEY or a Render Deploy Webhook URL in Gateway Settings'}`);
        }
      }
    } catch (e) { setStatus(`✗ ${e.message}`); }
    setDeploying(false); setClearing(false);
  };

  const statusColor = status.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : status.startsWith('⚠') ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : status.startsWith('✗') ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : 'bg-sky-500/10 text-sky-300 border-sky-500/30';

  return (
    <div className="space-y-4">
      <DetailBox title="Render Headless Deploy" subtitle="One-click rebuild of the backend gateway engine — auto-configured, no manual URL needed" icon="rocket" accent="amber" live>
        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <IconByName name="check" size={16} className="text-emerald-400" />
            <span className="text-emerald-300 text-xs font-semibold">Auto-configured via Render API — just click to deploy</span>
          </div>

          {renderUrl && (
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-semibold mb-1">Webhook URL (fallback, configured in Gateway Settings)</p>
              <p className="text-white text-sm font-mono break-all">{renderUrl.replace(/\/deploy\/[a-z0-9-]+/i, '/deploy/***')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => trigger(false)} disabled={deploying || clearing} className="py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {deploying ? <><BtnSpinner /> Deploying...</> : <><IconByName name="rocket" size={18} /> Trigger Deploy</>}
            </button>
            <button onClick={() => trigger(true)} disabled={deploying || clearing} className="py-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-800 hover:to-rose-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {clearing ? <><BtnSpinner /> Clearing...</> : <><IconByName name="refresh" size={18} /> Deploy + Clear Cache</>}
            </button>
          </div>

          {status && <div className={`rounded-xl p-3 text-sm border ${statusColor}`}>{status}</div>}
        </div>
      </DetailBox>

      <DetailBox title="Recent Deployments" subtitle="Live status from Render API" icon="activity" accent="sky" action={<button onClick={loadDeploys} disabled={loadingDeploys} className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">{loadingDeploys ? <BtnSpinner /> : <><IconByName name="refresh" size={14} /> Refresh</>}</button>}>
        <div className="mt-3 space-y-2">
          {deploys.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No recent deployments — trigger one above</p>}
          {deploys.map((d, i) => (
            <div key={d.id || i} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${d.status === 'live' ? 'bg-emerald-400' : d.status === 'build_in_progress' || d.status === 'created' ? 'bg-amber-400 animate-pulse' : d.status === 'build_failed' || d.status === 'update_failed' ? 'bg-rose-400' : 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-mono truncate">{d.id ? d.id.slice(0, 16) : '—'}</p>
                <p className="text-slate-400 text-xs">{d.status} {d.createdAt ? ' · ' + new Date(d.createdAt).toLocaleString() : ''}</p>
              </div>
              {d.commit && <div className="text-right"><p className="text-sky-400 text-xs font-mono">{d.commit.id}</p><p className="text-slate-500 text-xs truncate max-w-[200px]">{d.commit.message}</p></div>}
            </div>
          ))}
        </div>
      </DetailBox>

      <GatewayKeepAlive />

      <DetailBox title="Deployment Architecture" subtitle="3-platform single-codebase map — same repo, 3 modes" icon="server" accent="indigo">
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: 'Vercel', mode: 'user', desc: 'User Panel (NEXT_PUBLIC_PANEL_MODE=user)', url: 'mms-sender-v01.vercel.app', card: 'bg-sky-500/10 border-sky-500/20', iconBg: 'bg-sky-500/20', iconText: 'text-sky-400' },
            { name: 'Netlify', mode: 'admin', desc: 'Admin Panel (NEXT_PUBLIC_PANEL_MODE=admin)', url: 'mms-sender-v01.netlify.app', card: 'bg-violet-500/10 border-violet-500/20', iconBg: 'bg-violet-500/20', iconText: 'text-violet-400' },
            { name: 'Render', mode: 'api', desc: 'Headless Engine (NEXT_PUBLIC_PANEL_MODE=api)', url: 'mms-gateway-engine.onrender.com', card: 'bg-amber-500/10 border-amber-500/20', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400' },
          ].map(p => (
            <div key={p.name} className={`${p.card} border rounded-xl p-4 text-center`}>
              <div className={`w-12 h-12 mx-auto rounded-xl ${p.iconBg} flex items-center justify-center mb-2`}>
                <IconByName name="server" size={22} className={p.iconText} />
              </div>
              <p className="text-white font-bold text-sm">{p.name}</p>
              <p className="text-slate-400 text-xs mt-1">{p.desc}</p>
              <p className="text-slate-500 text-xs font-mono mt-2 break-all">{p.url}</p>
            </div>
          ))}
        </div>
      </DetailBox>
    </div>
  );
}

// ── Keep-Alive Monitor (Render anti-sleep) ─────────────────────────────────────
function GatewayKeepAlive() {
  const [pinging, setPinging] = useState(false);
  const [autoPing, setAutoPing] = useState(true);
  const [renderStatus, setRenderStatus] = useState(null); // { alive, responseMs, renderTime, renderUptime }
  const [kaStatus, setKaStatus] = useState(null); // keep-alive internal loop status
  const [history, setHistory] = useState([]); // recent ping results
  const [lastChecked, setLastChecked] = useState(null);
  const timerRef = useRef(null);

  const RENDER_URL = 'https://mms-gateway-engine.onrender.com';

  const pingOnce = async () => {
    setPinging(true);
    try {
      const d = await systemApi({ action: 'pingRender' });
      const entry = {
        alive: d.alive,
        responseMs: d.responseMs,
        at: new Date().toLocaleTimeString(),
        error: d.error || null,
      };
      setRenderStatus(d);
      setLastChecked(new Date().toLocaleString());
      setHistory(prev => [entry, ...prev].slice(0, 8));
    } catch (e) {
      setHistory(prev => [{ alive: false, responseMs: 0, at: new Date().toLocaleTimeString(), error: e.message }].concat(prev).slice(0, 8));
    }
    setPinging(false);
  };

  const loadKaStatus = async () => {
    try {
      const d = await systemApi({ action: 'getKeepAliveStatus' });
      if (d.success && d.keepAlive) setKaStatus(d.keepAlive);
    } catch {}
  };

  useEffect(() => {
    pingOnce();
    loadKaStatus();
    if (autoPing) {
      timerRef.current = setInterval(() => { pingOnce(); }, 4 * 60 * 1000); // every 4 min
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoPing]);

  const alive = renderStatus && renderStatus.alive;
  const ms = renderStatus ? renderStatus.responseMs : null;
  const uptime = renderStatus && renderStatus.renderUptime != null ? renderStatus.renderUptime : null;
  const loopActive = kaStatus && kaStatus.active;
  const pingCount = kaStatus ? kaStatus.pingCount : null;
  const lastSelfPing = kaStatus ? kaStatus.lastPingAt : null;

  const renderStateLabel = !renderStatus ? 'Checking…' : alive ? (ms > 1000 ? 'Awake (cold-start ' + ms + 'ms)' : 'Awake · Warm') : 'Asleep / Unreachable';
  const renderStateColor = !renderStatus ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : alive ? (ms > 1000 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30') : 'bg-rose-500/10 text-rose-300 border-rose-500/30';

  return (
    <div className="space-y-4">
      <DetailBox title="Render Keep-Alive Monitor" subtitle="Prevents the free-tier instance from sleeping (15-min inactivity → 50s cold start)" icon="activity" accent="emerald" live>
        <div className="mt-3 space-y-4">
          {/* Live status banner */}
          <div className={`rounded-xl p-4 border ${renderStateColor} flex items-center gap-3`}>
            <div className={`w-3 h-3 rounded-full ${alive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <div className="flex-1">
              <p className="font-bold text-sm">{renderStateLabel}</p>
              <p className="text-xs opacity-80">{ms != null ? 'Response: ' + ms + 'ms' : 'No response yet'} {uptime != null ? ' · Uptime: ' + Math.round(uptime/60) + 'min' : ''}</p>
            </div>
            <button onClick={pingOnce} disabled={pinging} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              {pinging ? <BtnSpinner /> : <><IconByName name="refresh" size={14} /> Ping Now</>}
            </button>
          </div>

          {/* Auto-ping toggle */}
          <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">Auto-Ping from Admin Panel</p>
              <p className="text-slate-400 text-xs mt-0.5">Pings Render every 4 minutes while this tab is open — keeps it warm while you work</p>
            </div>
            <button onClick={() => setAutoPing(a => !a)} className={`relative w-12 h-6 rounded-full transition-colors ${autoPing ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoPing ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Server-side self-ping loop status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-slate-400 text-xs font-semibold mb-1">Server Self-Ping</p>
              <p className={`text-sm font-bold ${loopActive ? 'text-emerald-400' : 'text-slate-500'}`}>{loopActive ? '● Active' : '○ Inactive'}</p>
              <p className="text-slate-500 text-xs mt-1">{kaStatus ? 'every ' + Math.round(kaStatus.intervalMs/1000) + 's' : '—'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-slate-400 text-xs font-semibold mb-1">Total Pings</p>
              <p className="text-white text-sm font-bold">{pingCount != null ? pingCount : '—'}</p>
              <p className="text-slate-500 text-xs mt-1">{kaStatus ? 'since boot' : 'server-side'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-slate-400 text-xs font-semibold mb-1">Last Self-Ping</p>
              <p className="text-white text-sm font-bold">{lastSelfPing ? new Date(lastSelfPing).toLocaleTimeString() : '—'}</p>
              <p className="text-slate-500 text-xs mt-1">{kaStatus && kaStatus.lastPingOk === true ? '✓ ok' : kaStatus && kaStatus.lastPingOk === false ? '✗ failed' : '—'}</p>
            </div>
          </div>

          {/* Ping history */}
          <div>
            <p className="text-slate-400 text-xs font-semibold mb-2">Recent Pings (from this panel)</p>
            <div className="space-y-1.5">
              {history.length === 0 && <p className="text-slate-500 text-xs text-center py-2">No pings yet</p>}
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                  <div className={`w-2 h-2 rounded-full ${h.alive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="text-white text-xs font-mono">{h.at}</span>
                  <span className={`text-xs font-semibold ${h.alive ? (h.responseMs > 1000 ? 'text-amber-400' : 'text-emerald-400') : 'text-rose-400'}`}>{h.alive ? h.responseMs + 'ms' : 'timeout'}</span>
                  {h.error && <span className="text-rose-400/70 text-xs truncate">{h.error}</span>}
                </div>
              ))}
            </div>
          </div>

          {lastChecked && <p className="text-slate-500 text-xs text-center">Last checked: {lastChecked}</p>}
        </div>
      </DetailBox>

      <DetailBox title="How Keep-Alive Works" subtitle="3-layer anti-sleep defense for Render free tier" icon="shield" accent="sky">
        <div className="mt-3 space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex gap-3">
            <span className="text-emerald-400 font-bold text-sm shrink-0">①</span>
            <div>
              <p className="text-white text-sm font-semibold">Server-Side Self-Ping (auto, on Render)</p>
              <p className="text-slate-400 text-xs mt-1">A setInterval inside the Render app pings its own /api/ping every 5 minutes. Started automatically on boot via instrumentation hook. Zero config needed.</p>
            </div>
          </div>
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex gap-3">
            <span className="text-sky-400 font-bold text-sm shrink-0">②</span>
            <div>
              <p className="text-white text-sm font-semibold">Admin Panel Auto-Ping (this tab)</p>
              <p className="text-slate-400 text-xs mt-1">While you have this Deploy tab open, the panel pings Render every 4 minutes. Toggle above to disable. Helps keep it warm during active admin work.</p>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3">
            <span className="text-amber-400 font-bold text-sm shrink-0">③</span>
            <div>
              <p className="text-white text-sm font-semibold">External Cron (recommended, 24/7)</p>
              <p className="text-slate-400 text-xs mt-1">For guaranteed 24/7 uptime, set up a free external monitor on <span className="text-amber-300 font-mono">cron-job.org</span> or <span className="text-amber-300 font-mono">UptimeRobot</span> to GET <span className="text-amber-300 font-mono break-all">{RENDER_URL}/api/ping</span> every 5-14 minutes. This wakes the instance even after a full sleep cycle.</p>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-slate-400 text-xs font-semibold mb-1">Ping Endpoint URL (for external cron):</p>
            <p className="text-white text-sm font-mono break-all select-all">{RENDER_URL}/api/ping</p>
          </div>
        </div>
      </DetailBox>
    </div>
  );
}
