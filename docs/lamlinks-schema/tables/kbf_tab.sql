-- dbo.kbf_tab  (18 rows)
CREATE TABLE dbo.kbf_tab (
  idnkbf_kbf           int NOT NULL,
  uptime_kbf           datetime NOT NULL,
  upname_kbf           char(10) NOT NULL,
  pstkap_kbf           int NOT NULL,
  spikbd_kbf           int NOT NULL,
  lbxnam_kbf           char(20) NOT NULL,
  lblxtp_kbf           varchar(240) NOT NULL,
  lblgtp_kbf           varchar(240) NOT NULL,
  prnnam_kbf           varchar(240) NOT NULL,
  porint_kbf           char(16) NOT NULL,
  lblnam_kbf           varchar(240) NOT NULL,
  lbldes_kbf           varchar(240) NOT NULL,
  lbcols_kbf           int NOT NULL,
  lmrgin_kbf           numeric(8,4) NOT NULL,
  htween_kbf           numeric(8,4) NOT NULL,
  vtween_kbf           numeric(8,4) NOT NULL,
  lwidth_kbf           numeric(8,4) NOT NULL,
  lhight_kbf           numeric(8,4) NOT NULL,
  hhight_kbf           numeric(8,4) NOT NULL,
  fhight_kbf           numeric(8,4) NOT NULL,
  PRIMARY KEY (idnkbf_kbf)
);