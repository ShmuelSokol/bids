-- dbo.report_tables  (40 rows)
CREATE TABLE dbo.report_tables (
  report_name          char(60) NOT NULL,
  table_name           varchar(60) NOT NULL,
  PRIMARY KEY (report_name, table_name)
);