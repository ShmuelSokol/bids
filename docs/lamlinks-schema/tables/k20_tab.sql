-- dbo.k20_tab  (48316 rows)
CREATE TABLE dbo.k20_tab (
  idnk20_k20           int NOT NULL,
  uptime_k20           datetime NOT NULL,
  upname_k20           char(10) NOT NULL,
  susnam_k20           char(32) NOT NULL,
  msgtno_k20           int NOT NULL,
  msgcls_k20           char(20) NOT NULL,
  logmsg_k20           char(80) NOT NULL,
  llptyp_k20           char(3) NOT NULL,
  idnllp_k20           int NOT NULL,
  logtxt_k20           text(2147483647) NOT NULL
);