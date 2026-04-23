-- dbo.group_update_log_tables  (42 rows)
CREATE TABLE dbo.group_update_log_tables (
  group_name           char(60) NOT NULL,
  table_name           varchar(60) NOT NULL,
  group_update_log_USN int NOT NULL,
  update_serial_number int NOT NULL,
  status               smallint NOT NULL,
  PRIMARY KEY (group_name, table_name)
);