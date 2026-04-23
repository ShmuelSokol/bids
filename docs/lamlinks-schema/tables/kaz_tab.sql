-- dbo.kaz_tab  (33874 rows)
CREATE TABLE dbo.kaz_tab (
  idnkaz_kaz           int NOT NULL,
  adddte_kaz           datetime NOT NULL,
  xcstbl_kaz           char(3) NOT NULL,
  idnxcs_kaz           int NOT NULL,
  x_wsno_kaz           int NOT NULL,
  x_wnam_kaz           char(32) NOT NULL,
  x_mcag_kaz           char(5) NOT NULL,
  x_msno_kaz           char(32) NOT NULL,
  x_ucag_kaz           char(5) NOT NULL,
  x_usno_kaz           int NOT NULL,
  x_rhdr_kaz           char(8) NOT NULL,
  x_rflt_kaz           char(4) NOT NULL,
  x_rcag_kaz           char(5) NOT NULL,
  x_rsno_kaz           int NOT NULL,
  x_rhex_kaz           char(24) NOT NULL,
  msltyp_kaz           char(10) NOT NULL,
  xcsseq_kaz           int NOT NULL,
  PRIMARY KEY (idnkaz_kaz)
);