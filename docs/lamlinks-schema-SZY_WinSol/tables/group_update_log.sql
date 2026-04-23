-- dbo.group_update_log  (7 rows)
CREATE TABLE dbo.group_update_log (
  group_name           char(60) NOT NULL,
  last_updated         datetime NOT NULL,
  update_serial_number int NOT NULL,
  status               smallint NOT NULL,
  table_count          smallint NOT NULL,
  PRIMARY KEY (group_name)
);