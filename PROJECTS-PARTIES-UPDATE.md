# Projects and Parties CRUD update

- Projects and Parties pages now have Add, Edit and Delete actions.
- Save writes to existing `projects` and `parties` Google Sheets tabs, preserving their current headers and record IDs.
- Existing project fields: id, name, status, budget, spent. Existing party fields: id, name, type, city, gstin.
- Optional fields (project division; party address, phone, email) are saved only when their respective Google Sheets header columns exist. To enable these, append `division` to the `projects` header row and `address`, `phone`, `email` to the `parties` header row. Do not reorder existing columns.
- Delete is blocked when a record is referenced by transactions, sales invoices, purchase bills, or inventory movements.
- Existing historical data and sheet rows are not deleted or rewritten by deploying this update.
- Review the changed code before deployment; the frontend build could not be run in this environment because npm dependencies were not available.
