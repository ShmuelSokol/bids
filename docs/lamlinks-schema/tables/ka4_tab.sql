-- dbo.ka4_tab  (262872 rows)
CREATE TABLE dbo.ka4_tab (
  idnka4_ka4           int NOT NULL,
  uptime_ka4           datetime NOT NULL,
  idnk93_ka4           int NOT NULL,
  idnkak_ka4           int NOT NULL,
  irutbl_ka4           char(3) NOT NULL,
  idniru_ka4           int NOT NULL,
  postfl_ka4           char(1) NOT NULL,
  posdte_ka4           datetime NOT NULL,
  dspqty_ka4           numeric(16,5) NOT NULL,
  ufsval_ka4           numeric(13,2) NOT NULL,
  ucrval_ka4           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnka4_ka4)
);