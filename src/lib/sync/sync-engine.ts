// Core sync engine: Spreadsheet → Supabase (one-way)

import { createServerClient } from "@/lib/supabase/server";
import { fetchSheet, rowToObject } from "@/lib/google-sheets";
import {
  mapKaldikRow,
  mapTemaRow,
  mapKaryawanRow,
  mapHariKhususRow,
  mapPokokDoaRow,
  mapSettingRow,
  mapUnitTextToCode,
} from "./mappers";
import {
  validateKaldik,
  validateTema,
  validateKaryawan,
  validatePokokDoa,
} from "./validators";

export interface SyncResult {
  syncLogId: string;
  status: "success" | "error";
  sheets: SheetSyncResult[];
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  conflictRows: number;
  errorRows: number;
  message: string;
  startedAt: string;
  finishedAt: string;
}

export interface SheetSyncResult {
  sheetName: string;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}

/**
 * Run full sync: read all sheets and upsert to Supabase
 */
export async function runSync(triggerSource: string = "manual"): Promise<SyncResult> {
  const supabase = createServerClient();
  const startedAt = new Date().toISOString();

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from("sync_logs")
    .insert({
      sync_type: triggerSource === "cron" ? "weekly" : "manual",
      trigger_source: triggerSource,
      source_name: "Google Sheets",
      target_name: "Supabase",
      status: "running",
      started_at: startedAt,
    })
    .select()
    .single();

  if (logError) {
    throw new Error(`Failed to create sync log: ${logError.message}`);
  }

  const syncLogId = syncLog.id;
  const sheets: SheetSyncResult[] = [];
  let totalRows = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  let conflictRows = 0;
  let errorRows = 0;

  try {
    // Load unit mapping (code → id)
    const { data: units } = await supabase.from("units").select("id, code");
    const unitMap = new Map<string, string>();
    if (units) {
      units.forEach((u: { id: string; code: string }) => unitMap.set(u.code, u.id));
    }

    // Sync each sheet
    const sheetsToSync = [
      { name: "KALDIK_NORMALIZED", mapper: mapKaldikRow, validator: validateKaldik, table: "kaldik", idField: "kaldik_id" },
      { name: "TEMA_BULANAN", mapper: mapTemaRow, validator: validateTema, table: "tema_bulanan", idField: "tema_id" },
      { name: "KARYAWAN", mapper: mapKaryawanRow, validator: validateKaryawan, table: "karyawan", idField: "karyawan_id" },
      { name: "HARI_KHUSUS", mapper: mapHariKhususRow, validator: null, table: "hari_khusus", idField: "hari_id" },
      { name: "POKOK_DOA", mapper: mapPokokDoaRow, validator: validatePokokDoa, table: "pokok_doa", idField: "doa_id" },
      { name: "SETTING", mapper: mapSettingRow, validator: null, table: "settings", idField: "key" },
    ];

    for (const sheetConfig of sheetsToSync) {
      try {
        const result = await syncSheet(
          supabase,
          sheetConfig.name,
          sheetConfig.table,
          sheetConfig.idField,
          sheetConfig.mapper,
          sheetConfig.validator,
          unitMap
        );
        sheets.push(result);
        totalRows += result.totalRows;
        insertedRows += result.inserted;
        updatedRows += result.updated;
        skippedRows += result.skipped;
        conflictRows += result.conflicts;
        errorRows += result.errors.length;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sheets.push({
          sheetName: sheetConfig.name,
          totalRows: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          conflicts: 0,
          errors: [errorMsg],
        });
        errorRows++;
      }
    }

    // Update sync log
    const finishedAt = new Date().toISOString();
    await supabase
      .from("sync_logs")
      .update({
        status: "success",
        total_rows: totalRows,
        inserted_rows: insertedRows,
        updated_rows: updatedRows,
        skipped_rows: skippedRows,
        conflict_rows: conflictRows,
        error_rows: errorRows,
        message: `Sync completed. ${insertedRows} inserted, ${updatedRows} updated, ${skippedRows} skipped, ${conflictRows} conflicts, ${errorRows} errors.`,
        finished_at: finishedAt,
      })
      .eq("id", syncLogId);

    return {
      syncLogId,
      status: "success",
      sheets,
      totalRows,
      insertedRows,
      updatedRows,
      skippedRows,
      conflictRows,
      errorRows,
      message: `Sync selesai. ${insertedRows} ditambah, ${updatedRows} diperbarui, ${skippedRows} dilewati, ${conflictRows} konflik, ${errorRows} error.`,
      startedAt,
      finishedAt,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();

    await supabase
      .from("sync_logs")
      .update({
        status: "error",
        message: errorMsg,
        finished_at: finishedAt,
      })
      .eq("id", syncLogId);

    throw err;
  }
}

/**
 * Sync a single sheet
 */
async function syncSheet(
  supabase: ReturnType<typeof createServerClient>,
  sheetName: string,
  tableName: string,
  idField: string,
  mapper: (row: Record<string, string>, units: Map<string, string>) => Record<string, unknown>,
  validator: ((row: Record<string, unknown>) => { valid: boolean; errors: string[]; warnings: string[] }) | null,
  unitMap: Map<string, string>
): Promise<SheetSyncResult> {
  const result: SheetSyncResult = {
    sheetName,
    totalRows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
    errors: [],
  };

  // Fetch data from spreadsheet
  const sheetData = await fetchSheet(sheetName);
  result.totalRows = sheetData.totalRows;

  if (sheetData.totalRows === 0) {
    return result;
  }

  // Get existing records for comparison
  const selectCols = `id, ${idField}, updated_at`;
  const { data: existingRecords } = await supabase
    .from(tableName)
    .select(selectCols) as { data: Record<string, unknown>[] | null };

  const existingMap = new Map<string, { id: string; updated_at: string }>();
  if (existingRecords) {
    existingRecords.forEach((r) => {
      existingMap.set(String(r[idField]), {
        id: String(r.id),
        updated_at: String(r.updated_at),
      });
    });
  }

  // Process each row
  for (const row of sheetData.rows) {
    try {
      const rowObj = rowToObject(sheetData.headers, row);
      const mapped = mapper(rowObj, unitMap);

      // Validate
      if (validator) {
        const validation = validator(mapped);
        if (!validation.valid) {
          result.errors.push(`${mapped[idField]}: ${validation.errors.join(", ")}`);
          continue;
        }
      }

      const businessId = String(mapped[idField]);
      if (!businessId) {
        result.errors.push("Row missing ID — skipped");
        continue;
      }

      const existing = existingMap.get(businessId);

      if (!existing) {
        // INSERT — new record
        const { error } = await supabase.from(tableName).insert(mapped);
        if (error) {
          result.errors.push(`Insert ${businessId}: ${error.message}`);
        } else {
          result.inserted++;
        }
      } else {
        // UPDATE — compare updated_at
        const sourceUpdatedAt = mapped.updated_at
          ? new Date(String(mapped.updated_at))
          : new Date();
        const targetUpdatedAt = new Date(existing.updated_at);

        if (sourceUpdatedAt > targetUpdatedAt) {
          // Source is newer → update
          const { error } = await supabase
            .from(tableName)
            .update(mapped)
            .eq(idField, businessId);
          if (error) {
            result.errors.push(`Update ${businessId}: ${error.message}`);
          } else {
            result.updated++;
          }
        } else {
          // Target is newer or equal → skip (potential conflict)
          if (sourceUpdatedAt.getTime() !== targetUpdatedAt.getTime()) {
            // Record conflict
            await supabase.from("sync_conflicts").insert({
              table_name: tableName,
              source_id: businessId,
              spreadsheet_data: mapped,
              supabase_data: existing,
              reason: "Supabase data is newer than spreadsheet",
              status: "Pending",
            });
            result.conflicts++;
          } else {
            result.skipped++;
          }
        }
      }
    } catch (err) {
      result.errors.push(
        `Row processing error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
