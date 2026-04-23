-- dbo.k80_tab  (174700 rows)
CREATE TABLE dbo.k80_tab (
  idnk80_k80           int NOT NULL,
  addtme_k80           datetime NOT NULL,
  upname_k80           char(10) NOT NULL,
  idnk79_k80           int NOT NULL,
  idnk06_k80           int NOT NULL,
  clnact_k80           int NOT NULL,
  clnoct_k80           int NOT NULL,
  rlssta_k80           char(15) NOT NULL,
  rlsdte_k80           datetime NOT NULL,
  rel_no_k80           char(6) NOT NULL,
  reldte_k80           datetime NOT NULL,
  relext_k80           numeric(13,2) NOT NULL,
  cntpri_k80           char(8) NOT NULL,
  faspay_k80           char(4) NOT NULL,
  fmscno_k80           char(3) NOT NULL,
  critcl_k80           char(1) NOT NULL,
  tacode_k80           char(4) NOT NULL,
  piidno_k80           varchar(22) NOT NULL DEFAULT (''),
  docntr_k80           varchar(6) NOT NULL DEFAULT (''),
  PRIMARY KEY (idnk80_k80)
);