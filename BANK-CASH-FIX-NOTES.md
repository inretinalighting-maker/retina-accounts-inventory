# Bank & Cash provisional linkage update

- Bank & Cash now combines posted opening balance lines, identifiable journal cash/bank movements, and imported statement entries.
- Imported statement entries are displayed for reference but **not added** to journal running balances, preventing automatic double-counting.
- Journal transactions with a valid `bankCashAccountId` are assigned to that bank/cash account; transactions marked Cash without an ID are assigned to Cash in Hand. Transfers without a recognized account are excluded rather than guessed.
- Cash/Bank dashboard cards now add identifiable journal movements to posted opening balances as of the selected date. These are **provisional**, not reconciled or audited balances.
- Debit/Credit in the Bank & Cash book follow bank/cash asset convention: receipts debit the bank/cash account; payments credit it. This differs from the expense account debit shown in the journal.
- The original `bankTransactions` sheet is not changed. Existing transaction and opening balance rows are not changed.
- To get accurate balances, every transaction must identify its paid-from/received-in bank or cash account. A complete double-entry general ledger, bank reconciliation, transfers, and accrual accounting are still future work.

Deploy the full project files via GitHub/Vercel. Test against sample transactions and verify account mappings before relying on balances.
