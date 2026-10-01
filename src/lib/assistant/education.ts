const EDUCATION_REFERENCE: Record<string, string> = {
  "forward p/e": "Forward P/E is the current share price divided by an estimate of future earnings per share. It is an estimate, not a guaranteed outcome, and depends on the earnings forecast.",
  "p/e": "P/E is the share price divided by earnings per share. It expresses how much investors pay for one unit of current earnings.",
  "free cash flow": "Free cash flow is cash generated after the operating and capital expenditure needs represented by the available data. It can help assess financial flexibility, but definitions and periods must be checked.",
  "fx": "FX matters because assets, transactions, and portfolio reporting can use different currencies. Exchange-rate moves can change the value translated into the portfolio base currency even when the local asset price is unchanged.",
};

export function educationReference(query: string) {
  const normalized = query.toLowerCase();
  const match = Object.entries(EDUCATION_REFERENCE).find(([term]) => normalized.includes(term));
  return match?.[1] ?? "Explain the requested investment concept in plain language, state what it measures, and mention the main limitation or uncertainty.";
}

