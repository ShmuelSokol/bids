-- dbo.kbe_tab  (7 rows)
CREATE TABLE dbo.kbe_tab (
  idnkbe_kbe           int NOT NULL,
  uptime_kbe           datetime NOT NULL,
  upname_kbe           char(10) NOT NULL,
  afvtbl_kbe           char(3) NOT NULL,
  idnafv_kbe           int NOT NULL,
  afvtyp_kbe           char(48) NOT NULL,
  afvseq_kbe           int NOT NULL,
  afvalu_kbe           varchar(240) NOT NULL,
  afvdfv_kbe           char(1) NOT NULL,
  PRIMARY KEY (idnkbe_kbe)
);