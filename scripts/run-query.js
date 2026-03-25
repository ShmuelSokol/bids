const sql = require('mssql');

const config = {
  server: 'NYEVRVSQL001',
  database: 'llk_db1',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
  driver: 'msnodesqlv8',
};

async function runQuery(queryText, outputFile) {
  try {
    await sql.connect(config);
    const result = await sql.query(queryText);
    if (outputFile) {
      require('fs').writeFileSync(outputFile, JSON.stringify(result.recordset, null, 2));
      console.log(`Saved ${result.recordset.length} rows to ${outputFile}`);
    } else {
      console.log(JSON.stringify(result.recordset, null, 2));
    }
  } catch (err) {
    // Try without msnodesqlv8
    try {
      const config2 = {
        server: 'NYEVRVSQL001',
        database: 'llk_db1',
        options: {
          trustedConnection: true,
          trustServerCertificate: true,
          encrypt: false,
        },
      };
      await sql.close();
      await sql.connect(config2);
      const result = await sql.query(queryText);
      if (outputFile) {
        require('fs').writeFileSync(outputFile, JSON.stringify(result.recordset, null, 2));
        console.log(`Saved ${result.recordset.length} rows to ${outputFile}`);
      } else {
        console.log(JSON.stringify(result.recordset, null, 2));
      }
    } catch (err2) {
      console.error('Error:', err2.message);
    }
  } finally {
    await sql.close();
  }
}

const query = process.argv[2];
const outFile = process.argv[3] || null;
if (!query) {
  console.error('Usage: node run-query.js "SELECT ..." [output.json]');
  process.exit(1);
}
runQuery(query, outFile);
