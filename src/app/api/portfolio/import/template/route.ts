export async function GET() {
  return new Response("Date,Type,Ticker,ISIN,Name,Quantity,Price,Currency,FX Rate to Base,Fees\n2026-01-15,BUY,NVDA,,NVIDIA,0.25,180,EUR,,0\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=investment-dashboard-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
