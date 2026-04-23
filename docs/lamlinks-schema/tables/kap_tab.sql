-- dbo.kap_tab  (136 rows)
CREATE TABLE dbo.kap_tab (
  idnkap_kap           int NOT NULL,
  adddte_kap           datetime NOT NULL,
  idnkbd_kap           int NOT NULL,
  kbdseq_kap           int NOT NULL,
  catype_kap           char(80) NOT NULL,
  catutp_kap           char(32) NOT NULL,
  catitl_kap           char(80) NOT NULL,
  catdes_kap           varchar(240) NOT NULL,
  PRIMARY KEY (idnkap_kap)
);