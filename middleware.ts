import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Domain configuration
const DOMAINS = {
  // Sales/Landing pages domain
  SALES: ['go.divineacquisition.io', 'go.divineacquisition.com'],
  // Hiring pages domain
  HIRING: ['hiring.divineacquisition.io', 'hiring.divineacquisition.com'],
};

// Routes configuration
const ROUTES = {
  // Sales domain allowed paths
  SALES_PATHS: ['/booking-interface', '/booking-bcs'],
  // Hiring domain allowed paths
  HIRING_PATHS: ['/hiring'],
};

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files like .png, .css, etc.
  ) {
    return NextResponse.next();
  }

  // Check if this is the sales domain (go.divineacquisition.io)
  const isSalesDomain = DOMAINS.SALES.some(domain => 
    hostname.includes(domain) || hostname.startsWith(domain.split('.')[0])
  );
  
  // Check if this is the hiring domain (hiring.divineacquisition.io)
  const isHiringDomain = DOMAINS.HIRING.some(domain => 
    hostname.includes(domain) || hostname.startsWith(domain.split('.')[0])
  );

  // Handle sales domain (go.divineacquisition.io)
  if (isSalesDomain) {
    // Check if trying to access hiring pages
    if (pathname.startsWith('/hiring')) {
      // Redirect to the main sales page or show 404
      return NextResponse.redirect(new URL('/booking-interface', request.url));
    }
    
    // Handle root path - redirect to booking interface
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/booking-interface', request.url));
    }
    
    // Allow sales paths
    const isAllowedSalesPath = ROUTES.SALES_PATHS.some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    
    if (!isAllowedSalesPath && pathname !== '/') {
      // Redirect unknown paths to booking interface
      return NextResponse.redirect(new URL('/booking-interface', request.url));
    }
  }

  // Handle hiring domain (hiring.divineacquisition.io)
  if (isHiringDomain) {
    // Check if trying to access sales/landing pages
    const isSalesPath = ROUTES.SALES_PATHS.some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    
    if (isSalesPath) {
      // Redirect to the hiring page
      return NextResponse.redirect(new URL('/hiring', request.url));
    }
    
    // Handle root path - redirect to hiring
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/hiring', request.url));
    }
    
    // Allow hiring paths
    const isAllowedHiringPath = ROUTES.HIRING_PATHS.some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    
    if (!isAllowedHiringPath && pathname !== '/') {
      // Redirect unknown paths to hiring
      return NextResponse.redirect(new URL('/hiring', request.url));
    }
  }

  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
