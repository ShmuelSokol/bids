-- dbo.winsol_table_import_log  (22 rows)
CREATE TABLE dbo.winsol_table_import_log (
  table_name           nvarchar(100) NOT NULL,
  table_source         nvarchar(100),
  last_update          datetime,
  update_result        int,
  column_list          varchar(2000),
  where_condition      varchar(2000),
  update_serial_number int,
  PRIMARY KEY (table_name)
);