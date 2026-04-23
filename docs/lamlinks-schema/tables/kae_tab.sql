-- dbo.kae_tab  (258305 rows)
CREATE TABLE dbo.kae_tab (
  idnkae_kae           int NOT NULL,
  uptime_kae           datetime NOT NULL,
  upname_kae           char(10) NOT NULL,
  idnkad_kae           int NOT NULL,
  cilcls_kae           char(16) NOT NULL,
  cil_no_kae           int NOT NULL,
  cildes_kae           varchar(240) NOT NULL,
  pinval_kae           numeric(13,2) NOT NULL,
  xinval_kae           numeric(13,2) NOT NULL,
  cilqty_kae           int NOT NULL,
  cil_up_kae           numeric(13,4) NOT NULL,
  cil_ui_kae           char(2) NOT NULL,
  cilext_kae           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkae_kae)
);