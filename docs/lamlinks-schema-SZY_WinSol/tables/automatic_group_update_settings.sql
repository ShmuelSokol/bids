-- dbo.automatic_group_update_settings  (1 rows)
CREATE TABLE dbo.automatic_group_update_settings (
  groupName            varchar(100) NOT NULL,
  update               bit NOT NULL,
  lastUpdateStart      datetime,
  updateSort           int NOT NULL DEFAULT (1000),
  lastUpdateAttempt    datetime,
  lastUpdateDuration   datetime,
  lastUpdateResult     int NOT NULL DEFAULT ((-100)),
  last_context_info    binary(128),
  PRIMARY KEY (groupName)
);