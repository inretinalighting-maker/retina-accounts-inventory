# Masters navigation update

The sidebar now contains one expandable **Masters** group:
- Chart of Accounts (live accounts and staging)
- Parties — Customers & Suppliers
- Projects — Design & Product
- Products & Inventory (opens existing Inventory page)
- Bank & Cash Accounts (opens existing Bank & Cash page)

The standalone Parties, Projects and Chart of Accounts sidebar entries were removed. Existing pages, API endpoints, Google Sheets tabs, IDs and transaction links remain unchanged. The existing Inventory and Bank & Cash primary links remain for quick operational access; their entries under Masters are navigation shortcuts, not new master editors.

## Deploy
Upload the files inside this extracted project folder to the existing GitHub repository's main branch. Do not upload `.env` or credentials. Wait for Vercel Ready and verify the Masters menu. No Google Sheets changes are required.
