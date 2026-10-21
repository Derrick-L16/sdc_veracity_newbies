# Shared evidence test pack

Small synthetic files for every teammate to test Veracity's evidence uploads.
All documents are fictional. The PNG is an illustration, **not a real damage
photo or proof of damage**. No real customer or employee data is included.

## Files

| Folder / file | Where to use it |
| --- | --- |
| `upload-documents/01-sales-summary-TX010.pdf` | Case details → Case documents |
| `upload-documents/02-damage-report-DR004.pdf` | Case details → Case documents |
| `upload-documents/03-damage-illustration-DR004.png` | Case details → Case documents |
| `csv-records/products.csv` | Account → Connected records → Inventory products |
| `csv-records/movements.csv` | Account → Connected records → Unposted stock movements |
| `csv-records/additional-evidence.csv` | Optional later stock-movement import |
| `START-HERE.txt` | Full walkthrough and expected results |

## Quick test

1. Pull the team's latest GitHub changes and open this folder locally.
2. In a clean demo environment, import `products.csv` and `movements.csv`
   as Manager. **Do not import `additional-evidence.csv` yet.**
3. Submit a count of **33** for **Snack Biscuits B** (recorded stock **40**).
4. Open the latest open case as Manager or the Staff member who created it.
5. Upload the two PDFs and PNG individually under **Case documents**.
6. Confirm they remain visible after refreshing and open successfully.

Expected: shortage **7**, sales explain **3**, and **4 remain unexplained**.
The document uploads do not change these numbers, approval eligibility, or stock.

### Optional reassessment and approval test

After human review, import `additional-evidence.csv` as unposted stock movements.
This adds the structured **DR004 damage movement, −4 units**; it does not read
or extract the uploaded PDF. Choose **Refresh evidence & reassess**.

Expected: a new assessment explains **7**, with **0 unexplained**; the old
assessment stays unchanged. Recorded stock remains **40** until a separate
manager approval updates it to **33**. A repeated approval must not change
stock again.

## Shared-data precautions

- These CSVs deliberately match the original sample product and transaction IDs.
  Do not reimport existing records or create a second record for the TX010 sale.
- If the environment already contains a compatible open product B case, reuse it.
  If product B has already been corrected, use a fresh test environment rather
  than deleting or overwriting another teammate's work.
- On a shared instance, coordinate one person to run the mutating CSV/approval
  steps; others can inspect results or upload documents before the case closes.
- Submit the count after **20 October 2026, 08:30 MYT** so both example events
  precede the count.
- Use synthetic data only. Current demo role switching is not production
  authentication.
- Closed cases, historical assessments, and Owner views are read-only.
- AI document reading is not part of this pack or the current explanation draft.

## Keeping the pack consistent

These CSVs are snapshots of `artifacts/veracity/public/examples/`. If those
examples change, update this pack and its documents together so IDs, dates,
quantities, and expected outcomes continue to match.

The files here are intentionally small and shared through Git. The generated
ZIP/build outputs remain outside Git; no publish or app restart is needed to
use this folder.
