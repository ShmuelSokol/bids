-- dbo.kad_tab  (253831 rows)
CREATE TABLE dbo.kad_tab (
  idnkad_kad           int NOT NULL,
  uptime_kad           datetime NOT NULL,
  upname_kad           char(10) NOT NULL,
  idnk31_kad           int NOT NULL,
  idnk06_kad           int NOT NULL,
  cin_no_kad           int NOT NULL,
  cinnum_kad           char(22) NOT NULL,
  cindte_kad           datetime NOT NULL,
  cinact_kad           int NOT NULL,
  cinsta_kad           char(15) NOT NULL,
  cisdte_kad           datetime NOT NULL,
  pinval_kad           numeric(13,2) NOT NULL,
  xinval_kad           numeric(13,2) NOT NULL,
  mslval_kad           numeric(13,2) NOT NULL,
  nmsval_kad           numeric(13,2) NOT NULL,
  ppcval_kad           numeric(13,2) NOT NULL,
  cshval_kad           numeric(13,2) NOT NULL,
  crmval_kad           numeric(13,2) NOT NULL,
  otcval_kad           numeric(13,2) NOT NULL,
  ar_val_kad           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnkad_kad)
);