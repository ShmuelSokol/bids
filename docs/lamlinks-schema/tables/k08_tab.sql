-- dbo.k08_tab  (366232 rows)
CREATE TABLE dbo.k08_tab (
  idnk08_k08           int NOT NULL,
  uptime_k08           datetime NOT NULL,
  upname_k08           char(10) NOT NULL,
  partno_k08           char(32) NOT NULL,
  partrv_k08           char(3) NOT NULL,
  p_cage_k08           char(5) NOT NULL,
  p_desc_k08           char(80) NOT NULL,
  fsc_k08              char(4) NOT NULL,
  niin_k08             char(11) NOT NULL,
  p_up_k08             numeric(12,3) NOT NULL,
  p_um_k08             char(2) NOT NULL,
  doccnt_k08           int NOT NULL,
  i_note_k08           text(2147483647) NOT NULL,
  p_note_k08           text(2147483647) NOT NULL,
  pidtxt_k08           text(2147483647),
  techch_k08           text(2147483647),
  weight_k08           numeric(10,3) NOT NULL,
  classa_k08           char(32) NOT NULL DEFAULT (''),
  dflcnt_k08           int NOT NULL DEFAULT (0),
  PRIMARY KEY (idnk08_k08)
);