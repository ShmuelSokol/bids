-- dbo.kcp_tab  (0 rows)
CREATE TABLE dbo.kcp_tab (
  idnkcp_kcp           int NOT NULL,
  adtime_kcp           datetime NOT NULL,
  uptime_kcp           datetime NOT NULL,
  qai_no_kcp           int NOT NULL,
  qainum_kcp           char(16) NOT NULL,
  qaista_kcp           char(16) NOT NULL,
  qaixml_kcp           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcp_kcp)
);