import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(req) {
  const token = req.cookies.get('token')?.value;
  const url = req.nextUrl.pathname;

  if (url.startsWith('/admin') || url.startsWith('/user')) {
    if (!token) return NextResponse.redirect(new URL('/', req.url));
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-enterprise');
      const { payload } = await jwtVerify(token, secret);
      
      if (url.startsWith('/admin') && payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/user', req.url));
      }
      if (url.startsWith('/user') && payload.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
    } catch (err) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*'],
};
