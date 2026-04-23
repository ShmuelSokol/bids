-- dbo.kak_tab  (0 rows)
CREATE TABLE dbo.kak_tab (
  idnkak_kak           int NOT NULL,
  adddte_kak           datetime NOT NULL,
  idnk85_kak           int NOT NULL,
  rsttbl_kak           char(3) NOT NULL,
  idnrst_kak           int NOT NULL,
  rsvqty_kak           numeric(16,5) NOT NULL,
  rsxqty_kak           numeric(16,5) NOT NULL,
  lnkqty_kak           numeric(16,5) NOT NULL,
  rmlqty_kak           numeric(16,5) NOT NULL,
  rsoqty_kak           numeric(16,5) NOT NULL,
  PRIMARY KEY (idnkak_kak)
);