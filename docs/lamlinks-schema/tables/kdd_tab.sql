-- dbo.kdd_tab  (0 rows)
CREATE TABLE dbo.kdd_tab (
  idnkdd_kdd           int NOT NULL,
  addtme_kdd           datetime NOT NULL,
  reqtme_kdd           datetime NOT NULL,
  reqkey_kdd           char(64) NOT NULL,
  toutby_kdd           datetime NOT NULL,
  req_by_kdd           char(32) NOT NULL,
  reqsys_kdd           varchar(32) NOT NULL,
  reqfun_kdd           char(32) NOT NULL,
  reqsta_kdd           char(32) NOT NULL,
  reqxml_kdd           text(2147483647) NOT NULL,
  rsptme_kdd           datetime NOT NULL,
  rsp_by_kdd           char(32) NOT NULL,
  rspcod_kdd           int NOT NULL,
  rspmsg_kdd           varchar(160) NOT NULL,
  rspxml_kdd           varchar(7000) NOT NULL,
  reqj05_kdd           int,
  PRIMARY KEY (idnkdd_kdd)
);