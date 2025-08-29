# Overview

This is a fishing permit management Progressive Web Application (PWA) built for government use in Côte d'Ivoire. The system digitizes the collection and management of fishing permits, replacing traditional paper-based processes. It enables field agents to create permits offline, generate physical permit cards with QR codes for verification, and provides administrative dashboards for permit management and statistics.

The application is designed to work in areas with limited internet connectivity, featuring offline-first functionality with automatic synchronization when online. It includes camera integration for photo capture, QR code generation and scanning for permit verification, and PDF generation for printable permit cards.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with **React 18** using **TypeScript** and **Vite** for build tooling. The UI leverages **shadcn/ui** components built on **Radix UI primitives** and styled with **Tailwind CSS**. Navigation is handled by **Wouter** for client-side routing, and state management uses **React Hook Form** with **Zod** for validation and **TanStack Query** for server state management.

The application implements a **Progressive Web App (PWA)** architecture with service worker registration for offline functionality. The offline-first approach uses **IndexedDB** for local data storage, allowing permit creation without internet connectivity and automatic synchronization when online.

## Backend Architecture
The server is built with **Express.js** and **TypeScript**, using ES modules. It implements a RESTful API architecture with middleware for request logging, error handling, and file upload support via **Multer**. The development environment integrates **Vite's middleware mode** for hot module replacement and seamless full-stack development.

Authentication is simplified for demonstration purposes but includes middleware structure for bearer token validation. The API provides endpoints for permit CRUD operations, statistics, QR code verification, and PDF generation.

## Data Storage Solutions
The application uses **PostgreSQL** as the primary database with **Drizzle ORM** for type-safe database operations and migrations. The database schema supports fishing permits with related entities including fishers, vessels, techniques, media attachments, and audit logs.

For offline functionality, the client implements **IndexedDB** storage with automatic synchronization queues. This dual-storage approach ensures data persistence in offline scenarios while maintaining consistency with the server database.

## Security and Verification
QR code generation uses **Ed25519 cryptographic signatures** to ensure permit authenticity and prevent forgery. Each permit card includes a signed QR code that can be verified using the system's public key. The cryptographic approach provides tamper-proof verification without requiring internet connectivity during validation.

## Media and Document Generation
The system integrates camera functionality for photo capture using the **MediaDevices API** with fallback handling for unsupported browsers. PDF generation uses **PDFKit** to create standardized permit cards with embedded QR codes, photos, and government branding. The cards are designed for professional printing at 300 DPI resolution.

## Mobile and PWA Features
The application is optimized for mobile devices with responsive design, touch-friendly interfaces, and bottom navigation. PWA features include app manifest configuration, service worker for caching, and offline indicators. The camera integration supports both front and rear-facing cameras with automatic orientation handling.

# External Dependencies

## Database and ORM
- **@neondatabase/serverless** - PostgreSQL serverless driver for database connectivity
- **drizzle-orm** and **drizzle-kit** - Type-safe ORM with migration support
- **connect-pg-simple** - PostgreSQL session store for Express sessions

## UI and Component Libraries
- **@radix-ui/react-*** - Headless UI primitives for accessible components
- **shadcn/ui** - Pre-built component library based on Radix UI
- **class-variance-authority** - Component variant management
- **tailwindcss** - Utility-first CSS framework

## Form and State Management
- **react-hook-form** with **@hookform/resolvers** - Form handling and validation
- **zod** - Schema validation library
- **@tanstack/react-query** - Server state management and caching

## Media and Document Processing
- **html5-qrcode** - QR code scanning functionality
- **qrcode** - QR code generation
- **pdfkit** - PDF document generation for permit cards
- **multer** - File upload middleware for photo handling

## Authentication and Security
- **bcrypt** - Password hashing (though simplified auth is currently implemented)
- **crypto** (Node.js built-in) - Cryptographic functions for QR code signing

## Development and Build Tools
- **vite** - Build tool and development server
- **typescript** - Type safety and enhanced development experience
- **@replit/vite-plugin-runtime-error-modal** - Development error handling
- **tsx** - TypeScript execution for server-side development