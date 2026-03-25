import sql from "mssql/msnodesqlv8";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "llk-discovery");

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const queries: { name: string; file: string; sql: string }[] = [
  {
    name: "All tables with row counts",
    file: "tables.json",
    sql: `SELECT s.name AS [Schema], t.name AS [Table], p.row_count AS [RowCount], t.create_date AS [Created], t.modify_date AS [Modified] FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id JOIN sys.dm_db_partition_stats p ON t.object_id = p.object_id AND p.index_id IN (0, 1) ORDER BY p.row_count DESC`,
  },
  {
    name: "All columns with data types",
    file: "columns.json",
    sql: `SELECT t.name AS [Table], c.name AS [Column], tp.name AS [DataType], c.max_length AS [MaxLength], c.is_nullable AS [Nullable], c.column_id AS [Position] FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id ORDER BY t.name, c.column_id`,
  },
  {
    name: "Foreign key relationships",
    file: "foreign-keys.json",
    sql: `SELECT fk.name AS [FK_Name], OBJECT_NAME(fk.parent_object_id) AS [ChildTable], COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS [ChildColumn], OBJECT_NAME(fk.referenced_object_id) AS [ParentTable], COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS [ParentColumn] FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id ORDER BY [ChildTable], [ParentTable]`,
  },
  {
    name: "Stored procedures & views",
    file: "procedures-views.json",
    sql: `SELECT o.name AS [ObjectName], o.type_desc AS [Type], m.definition AS [SourceCode], o.create_date AS [Created], o.modify_date AS [Modified] FROM sys.sql_modules m JOIN sys.objects o ON m.object_id = o.object_id WHERE o.type IN ('P', 'V', 'FN', 'TF') ORDER BY o.type_desc, o.name`,
  },
  {
    name: "Indexes",
    file: "indexes.json",
    sql: `SELECT t.name AS [Table], i.name AS [Index], i.type_desc AS [IndexType], STUFF((SELECT ', ' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')), 1, 2, '') AS [Columns] FROM sys.indexes i JOIN sys.tables t ON i.object_id = t.object_id WHERE i.name IS NOT NULL GROUP BY t.name, i.name, i.type_desc, i.object_id, i.index_id ORDER BY t.name, i.name`,
  },
  {
    name: "Government data columns",
    file: "gov-columns.json",
    sql: `SELECT t.name AS [Table], c.name AS [Column], tp.name AS [DataType], c.max_length AS [MaxLength] FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id WHERE c.name LIKE '%nsn%' OR c.name LIKE '%cage%' OR c.name LIKE '%clin%' OR c.name LIKE '%contract%' OR c.name LIKE '%invoice%' OR c.name LIKE '%solicitation%' OR c.name LIKE '%quote%' OR c.name LIKE '%award%' OR c.name LIKE '%ship%' OR c.name LIKE '%price%' OR c.name LIKE '%vendor%' OR c.name LIKE '%tcn%' OR c.name LIKE '%fsc%' OR c.name LIKE '%dodaac%' ORDER BY t.name, c.name`,
  },
  {
    name: "Blind FK detection",
    file: "implicit-fks.json",
    sql: `SELECT c.name AS [ColumnName], tp.name AS [DataType], COUNT(*) AS [TableCount], STUFF((SELECT ', ' + t2.name FROM sys.columns c2 JOIN sys.tables t2 ON c2.object_id = t2.object_id WHERE c2.name = c.name ORDER BY t2.name FOR XML PATH('')), 1, 2, '') AS [Tables] FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id GROUP BY c.name, tp.name HAVING COUNT(*) >= 2 ORDER BY COUNT(*) DESC`,
  },
  {
    name: "Extended properties",
    file: "extended-props.json",
    sql: `SELECT OBJECT_NAME(ep.major_id) AS [Object], ep.name AS [Property], CAST(ep.value AS NVARCHAR(500)) AS [Value] FROM sys.extended_properties ep WHERE ep.class = 1 ORDER BY [Object]`,
  },
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Connecting to NYEVRVSQL001/llk_db1 (Windows Auth)...");
  const pool = await sql.connect(config);
  console.log("Connected!\n");

  for (const q of queries) {
    console.log(`Running: ${q.name}...`);
    try {
      const result = await pool.request().query(q.sql);
      const rows = result.recordset;
      const outPath = join(OUTPUT_DIR, q.file);
      writeFileSync(outPath, JSON.stringify(rows, null, 2));
      console.log(`  -> ${rows.length} rows saved to ${q.file}\n`);
    } catch (err: any) {
      console.error(`  ERROR on "${q.name}": ${err.message}\n`);
      const outPath = join(OUTPUT_DIR, q.file);
      writeFileSync(outPath, JSON.stringify({ error: err.message }, null, 2));
    }
  }

  await pool.close();
  console.log("Done. All results saved to data/llk-discovery/");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
