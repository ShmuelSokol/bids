-- dbo.R_ARRC  (1162855 rows)
CREATE TABLE dbo.R_ARRC (
  CUSTMR               char(7) NOT NULL,
  LASSALDAT            datetime,
  ARBAL                numeric(10,2),
  DUEDATOLD            datetime,
  PRIMARY KEY (CUSTMR)
);