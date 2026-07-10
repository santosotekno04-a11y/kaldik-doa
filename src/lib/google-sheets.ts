// Google Sheets API client
// Supports both public CSV export and authenticated API access

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "1bCTg-5wSpZ_z_Eg-aocRumYVnERJkx7AK-skMyaBvyM";

export interface SheetData {
  headers: string[];
  rows: string[][];
  sheetName: string;
  totalRows: number;
}

/**
 * Fetch sheet data via public CSV export (no auth required)
 * Works when spreadsheet is shared as "Anyone with the link"
 */
export async function fetchSheetCsv(sheetName: string): Promise<SheetData> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "KaldikDoa/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet "${sheetName}": ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const parsed = parseCsv(csvText);

  if (parsed.length === 0) {
    return { headers: [], rows: [], sheetName, totalRows: 0 };
  }

  const headers = parsed[0].map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));

  return {
    headers,
    rows,
    sheetName,
    totalRows: rows.length,
  };
}

/**
 * Fetch sheet data using Google Sheets API (authenticated)
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars
 */
export async function fetchSheetApi(sheetName: string, range?: string): Promise<SheetData> {
  const { google } = await import("googleapis");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const sheetRange = range || `${sheetName}`;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange,
  });

  const data = result.data.values || [];

  if (data.length === 0) {
    return { headers: [], rows: [], sheetName, totalRows: 0 };
  }

  const headers = data[0].map((h: string) => String(h).trim());
  const rows = data.slice(1).map((row: string[]) =>
    row.map((cell: string) => String(cell || "").trim())
  );

  return {
    headers,
    rows,
    sheetName,
    totalRows: rows.length,
  };
}

/**
 * Smart fetch: try API first, fallback to CSV
 */
export async function fetchSheet(sheetName: string): Promise<SheetData> {
  const hasApiCredentials =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY;

  if (hasApiCredentials) {
    try {
      return await fetchSheetApi(sheetName);
    } catch {
      // Fallback to CSV if API fails
      return await fetchSheetCsv(sheetName);
    }
  }

  return await fetchSheetCsv(sheetName);
}

/**
 * Simple CSV parser (handles quoted fields)
 */
function parseCsv(text: string): string[][] {
  const cleanText = text.replace(/\r/g, "");
  const lines = cleanText.split("\n").filter((line) => line.trim() !== "");
  const delimiter = detectDelimiter(cleanText);

  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

/**
 * Parse spreadsheet row to object using headers
 */
export function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] || "";
  });
  return obj;
}
