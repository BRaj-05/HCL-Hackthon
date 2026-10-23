# HCL Hackathon – Loan Recovery Management System (Frontend)

## Overview

This is the frontend of the Loan Recovery Management System developed for the HCL Hackathon.

The application aims to simplify loan recovery operations by providing role-based dashboards, loan account information, collection tracking, and management workflows through a user-friendly interface.

## Tech Stack

- **React.js** – Building reusable UI components
- **JavaScript** – Frontend functionality
- **CSS** – Responsive design and styling
- **REST APIs** – Communication with the Express.js backend

## User Roles

The application is designed around four roles:

- **Collector:** View assigned accounts, track collections, record customer interactions, and manage Promise-to-Pay (PTP).
- **Manager:** Monitor team performance, review collection activities, and handle approvals.
- **Head:** Manage collection rules and oversee recovery operations.
- **Auditor:** Review activities and audit records with read-only access.

## Planned Features

- Role-based login and dashboards
- Loan account overview
- Collection worklist and account details
- Customer contact and PTP tracking
- Settlement approval workflows
- Collection performance dashboards
- API integration with the backend
- Responsive and reusable UI components

## Project Structure

The frontend will be organized into reusable components, pages, API services, and other supporting files to keep the code modular and maintainable.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

## Backend Integration

The frontend will communicate with the Express.js backend using REST APIs.

The backend is responsible for authentication, authorization, business rules, loan calculations, and other server-side operations.

## Project Status

🚧 **Under Development** – Frontend implementation and backend integration are in progress.

---

**Developed for HCL Hackathon 2026.**