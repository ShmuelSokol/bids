import { Database, Search, Table, Key, FileText, AlertCircle } from "lucide-react";

// This page helps reverse-engineer the Lamlinks SQL Server database
// The on-site version runs on our SQL Server — we have full access

const discoveryQueries = [
  {
    name: "List All Tables with Row Counts",
    description: "Get every table in the database with its row count. High-row tables are transactional (quotes, awards). Low-row tables are reference/lookup.",
    sql: `SELECT
  s.name AS [Schema],
  t.name AS [Table],
  p.rows AS [RowCount],
  t.create_date AS [Created],
  t.modify_date AS [Modified]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.dm_db_partition_stats p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
ORDER BY p.rows DESC;`,
  },
  {
    name: "All Columns with Data Types",
    description: "Full column inventory. Look for columns named like NSN, CAGE, CLIN, qty, price, dt, ship.",
    sql: `SELECT
  t.name AS [Table],
  c.name AS [Column],
  tp.name AS [DataType],
  c.max_length AS [MaxLength],
  c.is_nullable AS [Nullable],
  c.column_id AS [Position]
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id
ORDER BY t.name, c.column_id;`,
  },
  {
    name: "Foreign Key Relationships",
    description: "Explicit relationships between tables. Shows how tables connect.",
    sql: `SELECT
  fk.name AS [FK_Name],
  OBJECT_NAME(fk.parent_object_id) AS [ChildTable],
  COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS [ChildColumn],
  OBJECT_NAME(fk.referenced_object_id) AS [ParentTable],
  COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS [ParentColumn]
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
ORDER BY [ChildTable], [ParentTable];`,
  },
  {
    name: "Stored Procedures & Views (Business Logic)",
    description: "THE SHORTCUT: These contain readable business logic that maps cryptic table names to real concepts.",
    sql: `SELECT
  o.name AS [ObjectName],
  o.type_desc AS [Type],
  m.definition AS [SourceCode],
  o.create_date AS [Created],
  o.modify_date AS [Modified]
FROM sys.sql_modules m
JOIN sys.objects o ON m.object_id = o.object_id
WHERE o.type IN ('P', 'V', 'FN', 'TF')  -- Procedures, Views, Functions
ORDER BY o.type_desc, o.name;`,
  },
  {
    name: "Indexes (Important Columns)",
    description: "Heavily indexed columns are important to the application. Reveals primary keys and search patterns.",
    sql: `SELECT
  t.name AS [Table],
  i.name AS [Index],
  i.type_desc AS [IndexType],
  STRING_AGG(c.name, ', ') AS [Columns]
FROM sys.indexes i
JOIN sys.tables t ON i.object_id = t.object_id
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.name IS NOT NULL
GROUP BY t.name, i.name, i.type_desc
ORDER BY t.name, i.name;`,
  },
  {
    name: "Find Government Data Columns",
    description: "Search all columns for government contracting identifiers (NSN, CAGE, CLIN, contract, invoice, etc.)",
    sql: `SELECT
  t.name AS [Table],
  c.name AS [Column],
  tp.name AS [DataType],
  c.max_length AS [MaxLength]
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id
WHERE c.name LIKE '%nsn%'
   OR c.name LIKE '%cage%'
   OR c.name LIKE '%clin%'
   OR c.name LIKE '%contract%'
   OR c.name LIKE '%invoice%'
   OR c.name LIKE '%solicitation%'
   OR c.name LIKE '%quote%'
   OR c.name LIKE '%award%'
   OR c.name LIKE '%ship%'
   OR c.name LIKE '%price%'
   OR c.name LIKE '%vendor%'
   OR c.name LIKE '%tcn%'
   OR c.name LIKE '%fsc%'
   OR c.name LIKE '%dodaac%'
ORDER BY t.name, c.name;`,
  },
  {
    name: "Blind FK Detection (Matching Column Names)",
    description: "When FKs aren't defined, find implicit relationships by matching column names/types across tables.",
    sql: `SELECT
  c.name AS [ColumnName],
  tp.name AS [DataType],
  COUNT(*) AS [TableCount],
  STRING_AGG(t.name, ', ') AS [Tables]
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id
GROUP BY c.name, tp.name, c.max_length, c.precision, c.scale
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC;`,
  },
  {
    name: "Extended Properties (Developer Comments)",
    description: "Check if Lamlinks developers left any embedded documentation.",
    sql: `SELECT
  OBJECT_NAME(ep.major_id) AS [Object],
  ep.name AS [Property],
  CAST(ep.value AS NVARCHAR(500)) AS [Value]
FROM sys.extended_properties ep
WHERE ep.class = 1
ORDER BY [Object];`,
  },
];

export default function LamlinksDbPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Lamlinks Database Explorer</h1>
        <p className="text-muted mt-1">Reverse-engineer the Lamlinks SQL Server database to access solicitation, award, and pricing data</p>
      </div>

      {/* Connection Setup */}
      <div className="rounded-xl border-2 border-accent bg-blue-50/50 p-6 mb-6">
        <div className="flex items-start gap-3">
          <Database className="h-6 w-6 text-accent shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-2">SQL Server Connection</h2>
            <p className="text-sm text-muted mb-4">
              Lamlinks on-site version runs on your SQL Server. Connect to explore the 400+ tables.
              Start with stored procedures and views — they contain business logic that maps cryptic names to real concepts.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Server</label>
                <input type="text" placeholder="localhost\SQLEXPRESS" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Database</label>
                <input type="text" placeholder="LamlinksDB" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Username</label>
                <input type="text" placeholder="sa" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Password</label>
                <input type="password" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
              Test Connection
            </button>
          </div>
        </div>
      </div>

      {/* Also try calling Lamlinks */}
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-800">Before reverse-engineering, try calling Lamlinks first!</p>
            <p className="text-yellow-700">
              Phone: <span className="font-mono font-bold">323-469-4560</span> — Ask for a data dictionary or schema documentation.
              They advertise custom reporting services and may already have this documentation.
            </p>
          </div>
        </div>
      </div>

      {/* Discovery Queries */}
      <div className="space-y-4">
        {discoveryQueries.map((q, i) => (
          <div key={i} className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-accent bg-blue-50 px-2 py-0.5 rounded">#{i + 1}</span>
                    <h3 className="font-semibold">{q.name}</h3>
                  </div>
                  <p className="text-sm text-muted">{q.description}</p>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
                  <Search className="h-4 w-4" />
                  Run Query
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed">
                {q.sql}
              </pre>
              <div className="mt-3 flex gap-2">
                <button className="text-xs text-accent hover:text-accent-hover font-medium">Copy SQL</button>
                <span className="text-xs text-muted">|</span>
                <button className="text-xs text-accent hover:text-accent-hover font-medium">Run in SSMS</button>
                <span className="text-xs text-muted">|</span>
                <button className="text-xs text-accent hover:text-accent-hover font-medium">Export Results</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
